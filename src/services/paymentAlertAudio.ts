import { defaultPaymentSounds, paymentSoundUrl } from "./supabase/paymentAlertSoundService";
import type { PaymentSoundKind, PaymentSoundOverrides } from "./supabase/paymentAlertSoundService";

const waitForInteractionMs = 12_000;
let context: AudioContext | undefined;
let source: AudioBufferSourceNode | undefined;
let pending: { kind: PaymentSoundKind; expires: number } | undefined;
let enabled = false;
let overrides: PaymentSoundOverrides = { wallet: null, group: null };
let playVersion = 0;
const buffers = new Map<string, Promise<AudioBuffer>>();

export function setPaymentSoundOverrides(next: PaymentSoundOverrides) {
  for (const kind of ["wallet", "group"] as const) {
    if (overrides[kind] !== next[kind]) buffers.delete(paymentSoundUrl(kind, overrides[kind]));
  }
  overrides = next;
}

function stopSound() {
  if (source) {
    source.stop();
    source.disconnect();
    source = undefined;
  }
}

function readBuffer(audio: AudioContext, url: string) {
  const cached = buffers.get(url);
  if (cached) return cached;
  const request = (async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!response.ok) throw new Error("Payment sound unavailable");
    return audio.decodeAudioData(await response.arrayBuffer());
  })();
  buffers.set(url, request);
  void request.catch(() => { if (buffers.get(url) === request) buffers.delete(url); });
  return request;
}

async function playPendingSound() {
  const alert = pending;
  const audio = context;
  if (!alert || !enabled || audio?.state !== "running" || document.visibilityState !== "visible") return;
  pending = undefined;
  if (Date.now() > alert.expires) return;
  const version = ++playVersion;
  try {
    const customPath = overrides[alert.kind];
    const fallback = defaultPaymentSounds[alert.kind];
    const buffer = customPath
      ? await readBuffer(audio, paymentSoundUrl(alert.kind, customPath)).catch(() => readBuffer(audio, fallback))
      : await readBuffer(audio, fallback);
    if (version !== playVersion || !enabled || document.visibilityState !== "visible" || audio.state !== "running") return;
    stopSound();
    const next = audio.createBufferSource();
    next.buffer = buffer;
    next.connect(audio.destination);
    next.onended = () => {
      if (source === next) source = undefined;
      next.disconnect();
    };
    next.start();
    source = next;
  } catch { /* Keep the visual payment alert available if audio is unavailable. */ }
}

function unlockSound() {
  if (!enabled) return;
  try {
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    if (context.state === "running") void playPendingSound();
    else void context.resume().then(playPendingSound, () => undefined);
  } catch { /* Some devices disable audio playback. */ }
}

export function enablePaymentAlertAudio() {
  enabled = true;
  document.addEventListener("pointerup", unlockSound, { passive: true });
  document.addEventListener("keydown", unlockSound);
  if (navigator.userActivation?.hasBeenActive) unlockSound();
  return () => {
    enabled = false;
    pending = undefined;
    playVersion++;
    stopSound();
    document.removeEventListener("pointerup", unlockSound);
    document.removeEventListener("keydown", unlockSound);
  };
}

export function playPaymentAlertSound(kind: PaymentSoundKind) {
  if (!enabled || document.visibilityState !== "visible") return;
  pending = { kind, expires: Date.now() + waitForInteractionMs };
  if (context?.state === "running") void playPendingSound();
  else if (navigator.userActivation?.hasBeenActive) unlockSound();
}
