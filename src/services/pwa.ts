import { supabase } from "@/integrations/supabase/client";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installPrompt: InstallPrompt | null = null;
let registration: Promise<ServiceWorkerRegistration> | undefined;
const isProductionSite = ["collectipay.com.ng", "www.collectipay.com.ng"].includes(window.location.hostname);
// The public VAPID key can be distributed to browsers. Other sites configure their own key.
const key = (import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined) ||
  (isProductionSite ? "BNB3JWv3QHRl5jMiQJlT_1aU69C7f5f8_M3v_btVbIW-8QuIQM5C-CRQ7ncmSqW2Vc2Iu05KPEVutO8aIjoOMgE" : undefined);

export const pushAvailable = () => typeof window !== "undefined" && window.isSecureContext &&
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const installed = () => window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
export const pushConfigured = Boolean(key || supabaseUrl);

export function initPwa() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    window.dispatchEvent(new Event("collectipay-install-available"));
  });
  if (window.isSecureContext && "serviceWorker" in navigator) {
    registration = navigator.serviceWorker.register("/collectipay-sw.js");
    void registration.catch(() => undefined);
  }
}

export function hasInstallPrompt() { return Boolean(installPrompt); }
export async function promptInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  await prompt.userChoice;
  return true;
}

export async function getPushStatus() {
  if (!pushAvailable() || Notification.permission !== "granted") return null;
  const worker = await navigator.serviceWorker.getRegistration();
  const subscription = await worker?.pushManager.getSubscription();
  if (!subscription) return null;
  const { data, error } = await supabase.rpc("get_my_push_device_status", { p_endpoint: subscription.endpoint });
  if (error) throw new Error(error.message);
  return data as { registered: boolean; last_delivered_at: string | null; last_error: string | null } | null;
}

function applicationKey(value: string) {
  const encoded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded + "=".repeat((4 - encoded.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function readPushKey() {
  if (!supabaseUrl) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(supabaseUrl + "/functions/v1/deliver-web-push", { cache: "no-store", signal: controller.signal });
    return response.ok ? (await response.json()).publicKey as string | null : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function enablePush() {
  if (!pushConfigured || !pushAvailable()) throw new Error("Device notifications are unavailable.");
  if (await Notification.requestPermission() !== "granted") throw new Error("Allow notifications in your browser settings to enable alerts.");
  await registration;
  const [worker, serverKey] = await Promise.all([navigator.serviceWorker.ready, readPushKey()]);
  const configuredKey = serverKey || key;
  if (!configuredKey) throw new Error("Device alerts are awaiting server setup.");
  const expectedKey = applicationKey(configuredKey);
  let existing = await worker.pushManager.getSubscription();
  const previousKey = existing?.options.applicationServerKey;
  if (existing && previousKey && !new Uint8Array(previousKey).every((byte, index, bytes) => bytes.length === expectedKey.length && byte === expectedKey[index])) {
    await disablePush();
    existing = null;
  }
  const subscription = existing ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: expectedKey });
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) { if (!existing) await subscription.unsubscribe(); throw new Error("Couldn’t activate notifications on this device."); }
  const { error } = await supabase.rpc("set_push_device", { p_endpoint: subscription.endpoint, p_key: keys.p256dh, p_auth: keys.auth });
  if (error) {
    if (!existing) await subscription.unsubscribe();
    throw new Error(error.message);
  }
}

export async function sendPushTest() {
  const worker = await navigator.serviceWorker.getRegistration();
  const subscription = await worker?.pushManager.getSubscription();
  if (!subscription) throw new Error("Enable alerts on this device first.");
  const { data, error } = await supabase.rpc("send_my_push_test", { p_endpoint: subscription.endpoint });
  if (error || !data) throw new Error(error?.message || "Reconnect notifications on this device.");
}

export async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  const worker = await navigator.serviceWorker.getRegistration();
  const subscription = await worker?.pushManager.getSubscription();
  if (!subscription) return;
  const results = await Promise.allSettled([
    supabase.rpc("remove_push_device", { p_endpoint: subscription.endpoint }),
    subscription.unsubscribe(),
  ]);
  const [remote, local] = results;
  if ((local.status !== "fulfilled" || !local.value) && (remote.status !== "fulfilled" || remote.value.error)) {
    throw new Error("Couldn’t turn off alerts on this device.");
  }
}
