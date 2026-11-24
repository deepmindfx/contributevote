import { FLUTTERWAVE_BASE_URL, type FlutterwaveRuntimeConfig } from "./flutterwaveConfig.ts";

type VerifiedCharge = {
  id: string;
  amount: number;
  tx_ref: string;
  flw_ref?: string;
  currency: "NGN";
  payment_type?: string;
  account_number?: string;
  meta?: Record<string, unknown>;
  meta_data?: Record<string, unknown>;
  customer?: { name?: string; email?: string };
};

const providerId = /^[1-9][0-9]{0,19}$/;
const bankNumber = /^[0-9]{10}$/;
const metadataText = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 180) : "";

export async function fetchVerifiedInbound(config: FlutterwaveRuntimeConfig, transactionId: unknown, merchantRef: unknown = null): Promise<VerifiedCharge | null> {
  if (!config.secretKey) throw new Error("Payment verification is unavailable");
  const id = String(transactionId ?? "");
  const reference = metadataText(merchantRef);
  const byId = providerId.test(id);
  // Virtual-account merchant references can repeat. Only a checkout intent is unique per payment.
  if (!byId && !/^CP_CHECKOUT_[a-z0-9-]{10,100}$/i.test(reference)) return null;
  const endpoint = byId ? "/transactions/" + id + "/verify"
    : "/transactions/verify_by_reference?" + new URLSearchParams({ tx_ref: reference });
  const response = await fetch(FLUTTERWAVE_BASE_URL + endpoint, {
    method: "GET", headers: { Authorization: "Bearer " + config.secretKey },
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return null;
  const result = await response.json();
  const charge = result?.data;
  if (result?.status !== "success" || charge?.status !== "successful" || charge?.currency !== "NGN"
    || !providerId.test(String(charge.id)) || (byId ? String(charge.id) !== id : charge.tx_ref !== reference)) return null;
  const amount = Number(charge.amount);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 9999999999999.99
    || !/^\d+(?:\.\d{1,2})?$/.test(String(charge.amount))) return null;
  return { ...charge, id: String(charge.id), amount, tx_ref: metadataText(charge.tx_ref) };
}

type InboundReviewReason = "destination_unresolved" | "settlement_failed" | "missing_checkout_intent";

export async function findSettledInbound(db: any, charge: VerifiedCharge, expectedUser?: string) {
  const { data, error } = await db.rpc("service_find_settled_inbound", {
    p_provider_id: charge.id,
    p_reference: metadataText(charge.flw_ref),
    p_amount: charge.amount,
    p_expected_user: expectedUser ?? null,
  });
  if (error) throw error;
  return data;
}

export async function queueInboundReview(db: any, charge: VerifiedCharge, reason: InboundReviewReason, attempt = 0) {
  const { error } = await db.from("inbound_payment_review").upsert({
    provider_id: charge.id, provider_reference: metadataText(charge.flw_ref) || charge.id, amount: charge.amount, reason,
    next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** Math.min(attempt, 6)) * 60_000).toISOString(),
    ...(attempt > 0 ? { attempts: attempt } : {}),
  }, { onConflict: "provider_id", ignoreDuplicates: attempt === 0 });
  if (error) throw error;
  return { queued: true };
}

export async function applyVerifiedInbound(db: any, charge: VerifiedCharge, attempt = 0): Promise<{ queued: boolean; data?: unknown }> {
  const reference = metadataText(charge.flw_ref) || charge.id;
  const track = (reason: InboundReviewReason) => queueInboundReview(db, charge, reason, attempt);
  const complete = async (data: unknown) => {
    const { error } = await db.from("inbound_payment_review").update({ resolved_at: new Date().toISOString() })
      .eq("provider_id", charge.id).is("resolved_at", null);
    if (error) throw error;
    return { queued: false, data };
  };

  if (charge.tx_ref.startsWith("CP_CHECKOUT_")) {
    const { data, error } = await db.rpc("service_apply_checkout", {
      p_reference: charge.tx_ref, p_provider_reference: charge.id, p_amount: charge.amount,
      p_currency: charge.currency, p_method: charge.payment_type || null,
    });
    return error || !data ? track("settlement_failed") : complete(data);
  }

  const method = metadataText(charge.payment_type).toLowerCase();
  const meta = { ...charge.meta_data, ...charge.meta };
  if (method !== "bank_transfer") {
    const existing = await findSettledInbound(db, charge);
    return existing ? complete(existing) : track("missing_checkout_intent");
  }

  const account = [
    meta.virtualaccountnumber, meta.virtual_account_number, meta.accountNumber, meta.account_number, charge.account_number,
  ].map(metadataText).find(value => bankNumber.test(value));
  const { data: recipient, error: lookupError } = await db.rpc("service_resolve_virtual_account_payment", {
    p_account: account ?? null, p_reference: charge.tx_ref || null,
  });
  if (lookupError) throw lookupError;
  if (!recipient) return track("destination_unresolved");

  const senderAccount = metadataText(meta.originatoraccountnumber);
  const details = {
    senderName: metadataText(meta.originatorname || charge.customer?.name) || null,
    senderBank: metadataText(meta.bankname) || null,
    senderAccount: senderAccount ? "••••" + senderAccount.slice(-4) : null,
    txRef: charge.tx_ref,
  };
  const args = { p_provider_id: charge.id, p_reference: reference, p_amount: charge.amount, p_currency: charge.currency,
    p_destination: recipient.account, p_metadata: details };
  const { data, error } = recipient.kind === "group"
    ? await db.rpc("service_apply_verified_group_bank_payment", { ...args, p_group_id: recipient.id })
    : await db.rpc("service_apply_verified_inbound", { ...args, p_user_id: recipient.id, p_group_id: null, p_method: "bank_transfer" });
  return error || !data ? track("settlement_failed") : complete(data);
}
