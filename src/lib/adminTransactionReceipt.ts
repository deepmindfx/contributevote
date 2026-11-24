import type { CollectiPayReceiptData } from "@/components/receipt/CollectiPayReceipt";
import type { Database } from "@/integrations/supabase/types";

export type AdminTransaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  profiles?: { name: string | null; email: string | null };
  contribution_groups?: { name: string | null };
};

const kinds = new Map<string, CollectiPayReceiptData["kind"]>([
  ["deposit", "deposit"], ["withdrawal", "withdrawal"], ["transfer", "transfer"],
  ["contribution", "contribution"], ["refund", "refund"], ["payment", "transfer"],
]);

function isPenaltyTransaction({ metadata }: Pick<AdminTransaction, "metadata">) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) && metadata.category === "admin_penalty";
}

export function adminTransactionReceipt(transaction: AdminTransaction): CollectiPayReceiptData | null {
  const kind = kinds.get(transaction.type);
  if (!kind) return null;
  const debitAdjustment = transaction.type === "payment" && transaction.payment_method === "admin_debit";
  const creditAdjustment = transaction.type === "deposit" && transaction.payment_method === "admin";
  const title = debitAdjustment ? "Wallet debit adjustment"
    : creditAdjustment ? "Wallet credit adjustment"
    : isPenaltyTransaction(transaction) ? "Compliance Penalty" : undefined;

  return {
    kind: debitAdjustment ? "withdrawal" : kind,
    title,
    amount: Number(transaction.amount || 0),
    status: transaction.status || "unknown",
    date: transaction.created_at || "Date unavailable",
    reference: transaction.reference_id || transaction.id,
    transactionId: transaction.id,
    groupName: transaction.contribution_groups?.name || undefined,
    paymentMethod: debitAdjustment || creditAdjustment ? "Wallet adjustment" : transaction.payment_method || "Wallet",
    narration: transaction.description || undefined,
    balanceBefore: typeof transaction.balance_before === "number" ? transaction.balance_before : undefined,
    balanceAfter: typeof transaction.balance_after === "number" ? transaction.balance_after : undefined,
    sender: {
      label: "Account Holder",
      name: transaction.profiles?.name || transaction.profiles?.email || "CollectiPay Member",
      subtitle: transaction.profiles?.email || undefined,
    },
  };
}
