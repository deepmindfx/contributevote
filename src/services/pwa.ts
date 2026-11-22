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
export const pushConfigured = Boolean(key);

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

export async function hasPushSubscription() {
  if (!pushAvailable()) return false;
  const worker = await navigator.serviceWorker.getRegistration();
  return Boolean(await worker?.pushManager.getSubscription()) && Notification.permission === "granted";
}

function applicationKey(value: string) {
  const encoded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded + "=".repeat((4 - encoded.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function enablePush() {
  if (!key || !pushAvailable()) throw new Error("Device notifications are unavailable.");
  if (await Notification.requestPermission() !== "granted") throw new Error("Allow notifications in your browser settings to enable alerts.");
  await registration;
  const worker = await navigator.serviceWorker.ready;
  const existing = await worker.pushManager.getSubscription();
  const subscription = existing ?? await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(key) });
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) { if (!existing) await subscription.unsubscribe(); throw new Error("Couldn’t activate notifications on this device."); }
  const { error } = await supabase.rpc("set_push_device", { p_endpoint: subscription.endpoint, p_key: keys.p256dh, p_auth: keys.auth });
  if (error) {
    if (!existing) await subscription.unsubscribe();
    throw new Error(error.message);
  }
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
  if (local.status !== "fulfilled" && (remote.status !== "fulfilled" || remote.value.error)) {
    throw new Error("Couldn’t turn off alerts on this device.");
  }
}
