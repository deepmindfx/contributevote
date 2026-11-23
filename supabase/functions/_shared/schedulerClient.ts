import { createClient } from "jsr:@supabase/supabase-js@2";

export async function getSchedulerClient(request: Request) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const token = request.headers.get("x-collectipay-scheduler-token");
  const hasServiceBearer = Boolean(serviceKey && request.headers.get("Authorization") === "Bearer " + serviceKey);
  if (!serviceKey || !url || (!hasServiceBearer && (!token || !/^[a-f0-9]{64}$/.test(token)))) return null;
  const db = createClient(url, serviceKey);
  if (hasServiceBearer) return db;
  const { data, error } = await db.rpc("is_collectipay_scheduler_request", { p_token: token });
  if (error) throw error;
  return data === true ? db : null;
}
