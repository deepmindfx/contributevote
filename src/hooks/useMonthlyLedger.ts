import { useEffect, useState } from "react";
import { loadWalletMonth } from "@/services/supabase/monthlyLedger";
import type { LedgerEntry } from "@/services/supabase/monthlyLedger";
import { supabase } from "@/integrations/supabase/client";

export function useMonthlyLedger(userId: string | undefined, month: string) {
  const [outcome, setOutcome] = useState<{ key: string; entries?: LedgerEntry[]; error?: true }>();
  const [loadId, setLoadId] = useState(0);
  const key = `${userId}/${month}/${loadId}`;
  useEffect(() => {
    if (!userId) return;
    let controller: AbortController | undefined;
    const getRows = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const entries = await loadWalletMonth(userId, month, request.signal);
        if (!request.signal.aborted) setOutcome({ key, entries });
      } catch {
        if (!request.signal.aborted) setOutcome({ key, error: true });
      }
    };
    void getRows();
    let timer: number | undefined;
    const channel = supabase.channel(`wallet-month-${crypto.randomUUID()}`)
      .on("postgres_changes", { schema: "public", table: "transactions", event: "*", filter: `user_id=eq.${userId}` }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void getRows(), 250);
      }).subscribe();
    return () => {
      controller?.abort();
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, month, key]);
  const current = outcome?.key === key ? outcome : undefined;
  return { entries: current?.entries, error: current?.error, reload: () => setLoadId((id) => id + 1) };
}
