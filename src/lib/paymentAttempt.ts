import { v4 as uuid } from "uuid";

const memory = new Map<string, string>();

export async function paymentAttempt(scope: "transfer" | "contribution", owner: string, details: unknown[]) {
  // Persist only an opaque fingerprint and the attempt ID. The PIN and recipient details are never saved.
  const input = new TextEncoder().encode(JSON.stringify([scope, owner, ...details]));
  const digest = await crypto.subtle.digest("SHA-256", input);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const key = "collectipay-payment-attempt:" + fingerprint;
  let attemptId = memory.get(key);
  if (!attemptId) {
    try { attemptId = sessionStorage.getItem(key) || undefined; } catch { /* Storage may be unavailable. */ }
    if (!attemptId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(attemptId)) attemptId = uuid();
    memory.set(key, attemptId);
    try { sessionStorage.setItem(key, attemptId); } catch { /* Keep it in memory for this page. */ }
  }
  return {
    id: attemptId,
    finish() {
      if (memory.get(key) !== attemptId) return;
      memory.delete(key);
      try { if (sessionStorage.getItem(key) === attemptId) sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    },
  };
}
