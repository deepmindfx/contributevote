import { supabase } from "@/integrations/supabase/client";
import walletSound from "@/audio/Payment Received in CollectiPay.mp3";
import groupSound from "@/audio/Contribution payment recieved.mp3";

const bucket = "payment-alert-sounds";
export const MAX_PAYMENT_SOUND_BYTES = 2 * 1024 * 1024;
export const defaultPaymentSounds = { wallet: walletSound, group: groupSound };
export type PaymentSoundKind = keyof typeof defaultPaymentSounds;
export type PaymentSoundOverrides = Record<PaymentSoundKind, string | null>;

export function paymentSoundUrl(kind: PaymentSoundKind, path: string | null) {
  return path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : defaultPaymentSounds[kind];
}

export async function getPaymentSoundOverrides(): Promise<PaymentSoundOverrides> {
  const { data, error } = await supabase.from("payment_alert_sounds").select("kind, object_path");
  if (error) throw error;
  const overrides: PaymentSoundOverrides = { wallet: null, group: null };
  for (const row of data) {
    if (row.kind === "wallet" || row.kind === "group") overrides[row.kind] = row.object_path;
  }
  return overrides;
}

async function validateMp3(file: File) {
  if (!/\.mp3$/i.test(file.name) || !file.size || file.size > MAX_PAYMENT_SOUND_BYTES) {
    throw new Error("Choose an MP3 file up to 2 MB.");
  }
  const [a, b, c] = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  if (!(a === 0x49 && b === 0x44 && c === 0x33) && !(a === 0xff && (b & 0xe0) === 0xe0)) {
    throw new Error("This file does not appear to be an MP3.");
  }
  if (typeof AudioContext !== "undefined") {
    const context = new AudioContext();
    try { await context.decodeAudioData(await file.arrayBuffer()); }
    catch { throw new Error("This MP3 could not be played. Try another file."); }
    finally { void context.close().catch(() => undefined); }
  }
}

export async function setPaymentAlertSound(kind: PaymentSoundKind, file: File | null): Promise<string | null> {
  const storage = supabase.storage.from(bucket);
  let path: string | null = null;
  if (file) {
    await validateMp3(file);
    path = `${kind}/${crypto.randomUUID()}.mp3`;
    const { error } = await storage.upload(path, file, { contentType: "audio/mpeg", cacheControl: "31536000" });
    if (error) throw error;
  }
  const { data: previous, error } = await supabase.rpc("admin_set_payment_alert_sound", { p_kind: kind, p_object_path: path });
  if (error) {
    if (path) void storage.remove([path]).catch(() => undefined);
    throw error;
  }
  if (previous && previous !== path) void storage.remove([previous]).catch(() => undefined);
  return path;
}
