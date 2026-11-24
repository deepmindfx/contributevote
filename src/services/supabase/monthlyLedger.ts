import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LedgerEntry = Database["public"]["Tables"]["transactions"]["Row"];
export type FlowDay = { day: number; incoming: number; outgoing: number };
export type MonthlyFlows = {
  incoming: number; outgoing: number; count: number; pending: number; failed: number;
  bankTransfers: number; bankTotal: number; fees: number; daily: FlowDay[];
  breakdown: { label: string; count: number; amount: number }[];
};

const lagosDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
export const currentLagosMonth = () => {
  const parts = lagosDay.formatToParts(new Date());
  return `${parts.find(({ type }) => type === "year")!.value}-${parts.find(({ type }) => type === "month")!.value}`;
};

export function lagosMonthRange(month: string) {
  const [year, value] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, value - 1, 1, -1)).toISOString(),
    end: new Date(Date.UTC(year, value, 1, -1)).toISOString(),
    days: new Date(Date.UTC(year, value, 0)).getUTCDate(),
  };
}

export const completedLedgerEntry = (entry: LedgerEntry) =>
  ["completed", "successful", "success", "paid"].includes(entry.status?.toLowerCase() || "");

const wasReturnedPayout = (entry: LedgerEntry) => entry.type === "transfer" && entry.status === "failed" &&
  typeof (entry.metadata as Record<string, unknown> | null)?.payout_recovery_id === "string";

export const postedWalletEntry = (entry: LedgerEntry) => completedLedgerEntry(entry) || wasReturnedPayout(entry);

export function walletMovement(entry: LedgerEntry) {
  const amount = Number(entry.amount || 0);
  const metadata = (entry.metadata || {}) as Record<string, unknown>;
  if (entry.type === "vote") return 0;
  if (entry.balance_before != null && entry.balance_after != null) {
    return Math.round((Number(entry.balance_after) - Number(entry.balance_before)) * 100) / 100;
  }
  if (entry.type === "deposit" || entry.type === "refund") return amount;
  if (entry.type === "withdrawal" && entry.contribution_id) return amount;
  if (entry.type === "transfer") return -(Number(metadata.total_debited) || (amount + (Number(metadata.fee) || 0)));
  if (entry.type === "withdrawal") return -amount;
  if (entry.type === "contribution" && entry.payment_method === "wallet") return -amount;
  return 0;
}

export async function loadWalletMonth(userId: string, month: string, signal: AbortSignal) {
  const { start, end } = lagosMonthRange(month);
  const entries: LedgerEntry[] = [];
  const size = 500;
  for (let offset = 0; !signal.aborted; offset += size) {
    const { data, error } = await supabase.from("transactions").select("*")
      .eq("user_id", userId).gte("created_at", start).lt("created_at", end)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + size - 1).abortSignal(signal);
    if (error) throw new Error(error.message);
    entries.push(...data);
    if (data.length < size) break;
  }
  return entries;
}

export function analyzeWalletMonth(entries: LedgerEntry[], month: string): MonthlyFlows {
  const daily = Array.from({ length: lagosMonthRange(month).days }, (_, index) => ({ day: index + 1, incoming: 0, outgoing: 0 }));
  const kinds = new Map<string, { label: string; count: number; amount: number }>();
  let incoming = 0, outgoing = 0, count = 0, pending = 0, failed = 0, bankTransfers = 0, bankTotal = 0, fees = 0;
  for (const entry of entries) {
    if (entry.type === "vote") continue;
    count++;
    if (!completedLedgerEntry(entry)) {
      if (["failed", "rejected", "cancelled"].includes(entry.status?.toLowerCase() || "")) failed++;
      else pending++;
      if (!wasReturnedPayout(entry)) continue;
    }
    const delta = walletMovement(entry);
    const dayOfMonth = lagosDay.formatToParts(new Date(entry.created_at)).find(({ type }) => type === "day");
    const day = daily[Number(dayOfMonth?.value) - 1];
    if (delta > 0) {
      incoming += delta;
      if (day) day.incoming += delta;
    } else if (delta < 0) {
      outgoing -= delta;
      if (day) day.outgoing -= delta;
    }
    if (entry.type === "transfer" && !wasReturnedPayout(entry)) {
      bankTransfers++;
      bankTotal += Number(entry.amount);
      fees += Number((entry.metadata as Record<string, unknown> | null)?.fee) || 0;
    }
    const label = wasReturnedPayout(entry) ? "Returned payout debits"
      : entry.payment_method === "bank_payout_recovery" ? "Bank payout returns"
      : entry.payment_method === "fixed_savings" ? "Ice Vault" : entry.type === "withdrawal" && entry.contribution_id ? "Group payouts" : ({
      deposit: "Wallet deposits", transfer: "Bank transfers", withdrawal: "Wallet withdrawals",
      contribution: "Group contributions", refund: "Refunds",
    } as Record<string, string>)[entry.type] || "Other payments";
    const entryTotal = kinds.get(label) || { label, count: 0, amount: 0 };
    entryTotal.count++;
    entryTotal.amount += Number(entry.amount);
    kinds.set(label, entryTotal);
  }
  return { incoming, outgoing, count, pending, failed, bankTransfers, bankTotal, fees, daily, breakdown: [...kinds.values()].sort((a, b) => b.amount - a.amount) };
}

export async function loadGroupMonth(groupId: string, month: string, signal?: AbortSignal) {
  const { start, end } = lagosMonthRange(month);
  const query = supabase.rpc("get_group_transfer_analytics", { p_group_id: groupId, p_start: start, p_end: end });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error || !data) throw new Error(error?.message || "Group analytics are unavailable.");
  return data as MonthlyFlows;
}
