import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Job = {
  notification_id: string; device_id: string; attempts: number; endpoint: string;
  p256dh: string; auth_key: string; title: string; message: string; kind: string; group_id: string | null;
};

function allowedEndpoint(raw: string) {
  try {
    const url = new URL(raw);
    const host = url.hostname;
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" ||
        host === "push.apple.com" || host.endsWith(".push.apple.com") ||
        host === "notify.windows.com" || host.endsWith(".notify.windows.com"));
  } catch { return false; }
}

Deno.serve(async (request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (request.method !== "POST") return new Response(null, { status: 405 });
  if (!serviceKey || request.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return new Response(null, { status: 401 });
  }
  const publicKey = Deno.env.get("WEB_PUSH_PUBLIC_KEY");
  const privateKey = Deno.env.get("WEB_PUSH_PRIVATE_KEY");
  const subject = Deno.env.get("WEB_PUSH_SUBJECT");
  if (!publicKey || !privateKey || !subject) return new Response("Push is not configured", { status: 503 });
  const db = createClient(Deno.env.get("SUPABASE_URL") || "", serviceKey);
  const { data, error } = await db.rpc("claim_push_delivery_batch");
  if (error) return new Response("Could not claim notifications", { status: 500 });

  const jobs = (data || []) as Job[];
  for (let offset = 0; offset < jobs.length; offset += 10) {
    await Promise.all(jobs.slice(offset, offset + 10).map(async (job) => {
      try {
        if (!allowedEndpoint(job.endpoint)) {
          await db.from("push_devices").delete().eq("id", job.device_id);
          return;
        }
        // Financial details stay limited to the alert's type and amount. Account numbers and sender names remain in the app.
        const amount = job.message.match(/₦[\d,]+(?:\.\d{1,2})?/)?.[0];
        const body = job.kind === "wallet" || job.kind === "group"
          ? [amount, job.kind === "group" ? "Group activity" : "Wallet activity"].filter(Boolean).join(" · ")
          : "Open CollectiPay to view this update.";
        const href = job.group_id ? `/groups/${job.group_id}` : job.kind === "wallet" ? "/wallet-history" : "/dashboard";
        await webpush.sendNotification({ endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth_key } },
          JSON.stringify({ id: job.notification_id, title: job.title.slice(0, 90), body, href }),
          { TTL: 300, urgency: job.kind === "activity" ? "normal" : "high", timeout: 5000,
            vapidDetails: { subject, publicKey, privateKey } });
        await db.from("push_delivery_queue").delete().eq("notification_id", job.notification_id).eq("device_id", job.device_id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("push_devices").delete().eq("id", job.device_id);
        } else {
          const retryAt = new Date(Date.now() + Math.min(30, 2 ** job.attempts) * 60_000).toISOString();
          await db.from("push_delivery_queue").update({ due_at: retryAt }).eq("notification_id", job.notification_id).eq("device_id", job.device_id);
        }
      }
    }));
  }
  return Response.json({ claimed: jobs.length });
});
