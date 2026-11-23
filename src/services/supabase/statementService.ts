import { supabase } from "@/integrations/supabase/client";
import type { LedgerEntry } from "@/services/supabase/monthlyLedger";

export type StatementScope = "wallet" | "bulk";

type StatementAccount = {
  holder: string | null;
  account_number: string | null;
  bank_name: string | null;
  generated_at: string;
};

export type BulkStatementEntry = {
  authorized_at: string;
  batch_name: string;
  reference: string | null;
  status: "completed" | "failed" | "pending";
  recipient_name: string | null;
  bank_code: string | null;
  bank_name: string | null;
  account_number: string | null;
  amount: number;
  fee: number;
  vat: number;
  total: number;
};

export type StatementData = StatementAccount & { month: string } & (
  | { scope: "wallet"; entries: LedgerEntry[] }
  | { scope: "bulk"; entries: BulkStatementEntry[] }
);

export async function prepareStatementExport(scope: StatementScope, month: string, pin: string): Promise<StatementData> {
  const { data, error } = await supabase.rpc("prepare_statement_export", { p_month: `${month}-01`, p_scope: scope, p_pin: pin });
  const result = data as (StatementAccount & { success?: boolean; entries?: unknown[]; error?: string; message?: string }) | null;
  if (error || !result?.success || !Array.isArray(result.entries)) {
    throw new Error(result?.error || result?.message || "Couldn’t prepare your bank statement. Try again.");
  }
  return { ...result, month, scope } as StatementData;
}
