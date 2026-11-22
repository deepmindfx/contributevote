import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lagosMonthRange, loadWalletMonth } from "@/services/supabase/monthlyLedger";
import { supabase } from "@/integrations/supabase/client";

export function useMonthlyLedger(userId: string | undefined, month: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["workspace", userId, "monthly-ledger", month],
    queryFn: ({ signal }) => loadWalletMonth(userId!, month, signal),
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!userId) return;
    const { start, end } = lagosMonthRange(month);
    const rangeStart = Date.parse(start);
    const rangeEnd = Date.parse(end);
    let timer: number | undefined;
    const channel = supabase.channel(`wallet-month-${crypto.randomUUID()}`)
      .on("postgres_changes", { schema: "public", table: "transactions", event: "*", filter: `user_id=eq.${userId}` }, (event) => {
        if (event.eventType !== "DELETE") {
          const created = Date.parse(event.new.created_at);
          if (created < rangeStart || created >= rangeEnd) return;
        }
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void client.invalidateQueries({ queryKey: ["workspace", userId, "monthly-ledger", month] });
        }, 180);
      }).subscribe();
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, month, client]);
  return { entries: query.data, error: query.isError && !query.data, reload: () => void query.refetch() };
}
