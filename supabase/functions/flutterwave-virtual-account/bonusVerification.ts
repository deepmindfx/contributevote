import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { flutterwaveFetch, type FlutterwaveRuntimeConfig } from "../_shared/flutterwaveConfig.ts";

function directProvider(config: FlutterwaveRuntimeConfig) {
  return { ...config, staticIpProxyUrl: "", staticIpProxySecret: "" };
}

export async function beginBonusVerification(
  db: SupabaseClient, config: FlutterwaveRuntimeConfig, userId: string, name: string, bvn: string,
) {
  const names = name.trim().split(/\s+/);
  if (names.length < 2) return { error: "Add your first and last name to your profile before verifying your BVN." };

  const id = crypto.randomUUID();
  const { data: started, error: startError } = await db.rpc("service_start_wallet_bonus_verification", {
    p_user_id: userId, p_bvn: bvn, p_id: id,
  });
  if (startError || !started) return { error: "We couldn’t start bonus verification. Check the offer and try again in a minute." };

  const callback = new URL("/dashboard", Deno.env.get("COLLECTIPAY_SITE_URL") || "https://collectipay.com.ng");
  if (callback.protocol !== "https:") return { error: "Bonus verification is temporarily unavailable." };
  callback.searchParams.set("wallet", "bank");
  callback.searchParams.set("wallet-verification", id);

  const { response } = await flutterwaveFetch("/bvn/verifications", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    body: { bvn, firstname: names[0], lastname: names.at(-1), redirect_url: callback.href },
  }, directProvider(config));
  const result = await response.json().catch(() => null);
  const reference = result?.data?.reference;
  if (!response.ok || (result?.status !== "success" && result?.success !== true)
    || typeof reference !== "string" || !/^[a-z0-9_-]{8,100}$/i.test(reference)) {
    return { error: "Flutterwave couldn’t open BVN verification. Please try again later." };
  }

  const redirect = result.data.url ?? result.data.redirect_url;
  let verificationUrl: string | undefined;
  if (redirect) {
    const destination = new URL(redirect);
    const returningToWallet = destination.origin === callback.origin && destination.pathname === callback.pathname
      && destination.searchParams.get("wallet-verification") === id;
    if (!returningToWallet) {
      if (destination.protocol !== "https:" || destination.username || destination.password
        || !destination.hostname.endsWith(".myflutterwave.com") || destination.port) {
        return { error: "Flutterwave returned an invalid verification page." };
      }
      verificationUrl = destination.href;
    }
  }
  const { data: saved, error: saveError } = await db.from("wallet_bank_bonus_verifications")
    .update({ provider_reference: reference }).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
  if (saveError || !saved) return { error: "We couldn’t save your verification. Please try again." };
  return { id, verificationUrl };
}

export async function verifyBonusBvn(
  db: SupabaseClient, config: FlutterwaveRuntimeConfig, userId: string, email: string, id: string,
) {
  const { data: request, error } = await db.from("wallet_bank_bonus_verifications")
    .select("provider_reference").eq("id", id).eq("user_id", userId)
    .gt("started_at", new Date(Date.now() - 30 * 60_000).toISOString()).maybeSingle();
  if (error || !request?.provider_reference) return { error: "This BVN verification expired. Start it again from your bank account page." };
  const reference = request.provider_reference;

  const { response } = await flutterwaveFetch("/bvn/verifications/" + encodeURIComponent(reference), {
    signal: AbortSignal.timeout(20_000),
  }, directProvider(config));
  const result = await response.json().catch(() => null);
  const details = result?.data;
  if (!response.ok || result?.status !== "success" || details?.status !== "COMPLETED" || details.reference !== reference) {
    return { error: "BVN verification is still pending. Finish the consent step, then check again." };
  }
  const bvn = details.bvn_data?.bvn;
  const verifiedEmail = details.bvn_data?.email;
  if (typeof bvn !== "string" || !/^\d{11}$/.test(bvn) || typeof verifiedEmail !== "string"
    || verifiedEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { error: "The BVN consent must include your BVN and the confirmed email on your CollectiPay account." };
  }
  const { data: confirmed } = await db.rpc("service_confirm_wallet_bonus_verification", {
    p_user_id: userId, p_id: id, p_bvn: bvn, p_reference: reference,
  });
  if (!confirmed) return { error: "This BVN verification could not be confirmed. Start it again." };
  return { bvn };
}
