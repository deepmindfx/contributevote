import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { flutterwaveFetch, getFlutterwaveConfig, type FlutterwaveRuntimeConfig } from "../_shared/flutterwaveConfig.ts";
import { reconcileBulkTransfers } from "../_shared/reconcileBulkTransfer.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const providerId = /^[1-9][0-9]{0,19}$/;
type Recipient = { account_bank: string; account_number: string; amount: number; narration: string };
type QuotedRecipient = Recipient & { reference: string };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors });
}

function parseRecipients(raw: unknown): Recipient[] {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 50) throw new Error("Enter between 2 and 50 recipients.");
  return raw.map((row, index) => {
    const { account_bank, account_number, amount, narration = "" } = row ?? {};
    if (typeof account_bank !== "string" || !/^[0-9a-z]{2,12}$/i.test(account_bank) ||
      typeof account_number !== "string" || !/^\d{10}$/.test(account_number) ||
      typeof amount !== "number" || !Number.isFinite(amount) || amount < 100 || amount > 500000 ||
      amount !== Math.round(amount * 100) / 100 || typeof narration !== "string" || narration.length > 120) {
      throw new Error(`Review the bank details and amount in row ${index + 1}.`);
    }
    return { account_bank, account_number, amount, narration: narration.trim() };
  });
}

async function verifyRecipients(rows: Recipient[], config: FlutterwaveRuntimeConfig) {
  const verified = [];
  const lookups = new Map<string, Promise<string>>();
  const resolve = async (row: Recipient) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remote = await flutterwaveFetch("/accounts/resolve", {
        method: "POST", signal: AbortSignal.timeout(6000),
        body: { account_bank: row.account_bank, account_number: row.account_number },
      }, config).catch(() => null);
      if (!remote || remote.response.status === 429 || remote.response.status >= 500) {
        if (!attempt) await new Promise((done) => setTimeout(done, 350));
        continue;
      }
      const payload = await remote.response.json().catch(() => null);
      const name = typeof payload?.data?.account_name === "string" ? payload.data.account_name.trim() : "";
      return remote.response.ok && payload?.status === "success" && String(payload?.data?.account_number) === row.account_number
        ? name.slice(0, 120) : "";
    }
    return "";
  };
  for (let offset = 0; offset < rows.length; offset += 6) {
    const results = await Promise.all(rows.slice(offset, offset + 6).map(async (row, index) => {
      const key = row.account_bank + ":" + row.account_number;
      let account = lookups.get(key);
      if (!account) {
        account = resolve(row);
        lookups.set(key, account);
      }
      const name = await account;
      if (!name) throw new Error(`Couldn’t verify recipient ${offset + index + 1}. Check their bank and account number, then try again.`);
      return { ...row, beneficiary_name: name };
    }));
    verified.push(...results);
  }
  return verified;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Sign in to continue." }, 401);
  const origin = Deno.env.get("SUPABASE_URL") ?? "";
  const client = createClient(origin, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
  const db = createClient(origin, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user?.email_confirmed_at) return json({ error: "Sign in with a confirmed email to continue." }, 401);
    const { data: profile } = await db.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
    if (!profile || (profile.status ?? "active") !== "active") return json({ error: "Your account is restricted." }, 403);
    const body = await req.json().catch(() => null);
    const action = body?.action;
    if (!["quote", "submit", "reconcile"].includes(action)) return json({ error: "Unknown bulk transfer action." }, 400);
    const config = await getFlutterwaveConfig({ supabaseAdmin: db });
    if (action === "quote") {
      if (!config.secretKey) return json({ error: "Bank transfers are temporarily unavailable." }, 503);
      if (!config.transfersEnabled) return json({ error: "Bank transfers are paused." }, 409);
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 80) return json({ error: "Enter a batch name up to 80 characters." }, 400);
      const rows = parseRecipients(body.recipients);
      const { data: settings } = await db.from("bulk_transfer_settings").select("enabled,max_recipients,max_batch_amount").eq("singleton", true).maybeSingle();
      if (!settings?.enabled) return json({ error: "Bulk transfers are paused." }, 409);
      if (rows.length > settings.max_recipients || rows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) > Math.round(Number(settings.max_batch_amount) * 100)) {
        return json({ error: "The batch exceeds the configured recipient or amount limit." }, 400);
      }
      const verified = await verifyRecipients(rows, config);
      const { data: batchId, error } = await db.rpc("service_create_bulk_transfer_quote", {
        p_user_id: user.id, p_title: title, p_recipients: verified,
      });
      if (error || !batchId) throw new Error(error?.message || "Couldn’t prepare the quote.");
      return json({ batch_id: batchId });
    }

    const id = body.batch_id;
    if (typeof id !== "string" || !uuid.test(id)) return json({ error: "Choose a valid batch." }, 400);
    if (action === "reconcile") {
      const { data: batch, error } = await db.from("bulk_transfer_batches").select("user_id,authorized_at").eq("id", id).maybeSingle();
      if (error || !batch?.authorized_at || (batch.user_id !== user.id && profile.role !== "admin")) return json({ error: "Batch not found." }, 404);
      const result = await reconcileBulkTransfers(db, config, id);
      if (result.failed) return json({ error: "Couldn’t check every payout. We’ll retry automatically." }, 503);
      if (!result.checked) return json({ error: "No new check ran. If any payouts are pending, we’ll check them automatically." }, 409);
      return json({ batch_id: id });
    }

    if (!config.secretKey) return json({ error: "Bank transfers are temporarily unavailable." }, 503);
    if (!config.transfersEnabled) return json({ error: "Bank transfers are paused." }, 409);
    const { data: reservation, error: reserveError } = await db.rpc("service_authorize_bulk_transfer", {
      p_user_id: user.id, p_batch_id: id, p_pin: typeof body.transaction_pin === "string" ? body.transaction_pin : null,
    });
    if (reserveError || !reservation?.success) return json({ error: reservation?.error ?? "Couldn’t reserve this batch." }, 409);

    const { data: claim, error: claimError } = await db.rpc("service_claim_bulk_transfer", { p_user_id: user.id, p_batch_id: id });
    if (claimError) return json({ error: "Your batch is saved. Open it to check the current status." }, 503);
    if (!Array.isArray(claim)) return json({ batch_id: id });
    const items: QuotedRecipient[] = claim;
    const { response } = await flutterwaveFetch("/bulk-transfers", {
      method: "POST", signal: AbortSignal.timeout(20_000),
      body: {
        currency: "NGN", title: `CollectiPay ${id}`, error_reporting: true,
        bulk_data: items.map((row) => ({ bank_code: row.account_bank, account_number: row.account_number,
          amount: Number(row.amount), currency: "NGN", reference: row.reference,
          narration: row.narration || "Transfer from CollectiPay", callback_url: config.webhookUrl })),
      },
    }, config).catch(() => ({ response: new Response(null, { status: 503 }) }));
    const provider = await response.json().catch(() => null);
    const providerBatchId = String(provider?.data?.id ?? "");
    if (response.ok && provider?.status === "success" && providerId.test(providerBatchId)) {
      const { error } = await db.rpc("service_set_bulk_provider_id", { p_batch_id: id, p_provider_id: providerBatchId });
      if (error) console.warn("Couldn’t store the provider bulk batch ID", { code: error.code });
    }
    // The provider can accept a batch before an error or timeout reaches us.
    return json({ batch_id: id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Couldn’t check this batch. Try again." }, 400);
  }
});
