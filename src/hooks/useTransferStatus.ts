import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTransferStatus(reference: string | undefined, status: string | undefined, userId: string | undefined,
  onStatus: (status: string) => void) {
  const pending = ["new", "initiated", "pending", "processing", ""].includes(status?.toLowerCase() || "");
  useEffect(() => {
    if (!reference?.startsWith("TRF_") || !userId || !pending) return;
    let stopped = false;
    let lastCheck = 0;
    let checking = false;
    const update = (value: unknown) => {
      if (!stopped && typeof value === "string" && ["completed", "failed", "successful"].includes(value.toLowerCase())) onStatus(value);
    };
    const check = async () => {
      if (stopped || checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const { data } = await supabase.from("transactions").select("status")
          .eq("user_id", userId).eq("reference_id", reference).maybeSingle();
        if (data?.status && ["completed", "failed", "successful"].includes(data.status.toLowerCase())) {
          update(data.status);
        } else if (!stopped && Date.now() - lastCheck >= 30_000) {
          lastCheck = Date.now();
          const { data: result } = await supabase.functions.invoke("flutterwave-transfer", { body: { action: "status", reference } });
          update(result?.status);
        }
      } catch {
        // A temporary network failure is retried at the next check.
      } finally {
        checking = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 8_000);
    document.addEventListener("visibilitychange", check);
    const channel = supabase.channel(`transfer-status-${reference}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions", filter: `reference_id=eq.${reference}` },
        ({ new: row }) => { if (row.user_id === userId) update(row.status); })
      .subscribe();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      void supabase.removeChannel(channel);
    };
  }, [reference, pending, userId, onStatus]);
}
