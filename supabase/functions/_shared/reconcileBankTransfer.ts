import { flutterwaveFetch, listFlutterwaveTransfers, type FlutterwaveRuntimeConfig } from "./flutterwaveConfig.ts";

export type TransferRow = {
  user_id: string; status: string; amount: number | string; reference_id: string; bulk_batch_id?: string | null;
  created_at: string; updated_at?: string | null; metadata?: Record<string, unknown>;
};

type BulkLookup = { recordId?: string; issue?: string };
const validProviderId = /^[1-9][0-9]{0,19}$/;

export async function reconcileBankTransfer(
  db: any, row: TransferRow, config: FlutterwaveRuntimeConfig, lookup: BulkLookup = {},
): Promise<string> {
  if (row.status !== "pending") return row.status;
  const reference = row.reference_id;
  const meta = row.metadata ?? {};
  if (meta.dispatch_guard && !meta.dispatched_at) {
    if (Date.now() - Date.parse(row.created_at) < 120_000) return row.status;
    const { data, error } = await db.rpc("service_release_unsent_transfer", { p_reference: reference, p_user_id: row.user_id });
    if (error) throw error;
    return data || row.status;
  }
  if (!config.secretKey) return row.status;

  const recordId = lookup.recordId;
  const signal = AbortSignal.timeout(9000);
  const remote = await (recordId
    ? flutterwaveFetch("/transfers/" + encodeURIComponent(recordId), { method: "GET", signal }, config)
    : listFlutterwaveTransfers(new URLSearchParams({ reference }), signal, config)
  ).catch(() => null);
  const result = remote?.response.ok ? await remote.response.json().catch(() => null) : null;
  // Rotate unreachable transfers to the back of the scheduled queue without changing their outcome.
  if (result?.status !== "success") {
    return writeTransferStatus(db, row, "pending", lookup.issue ? { provider_batch_issue: lookup.issue } : {});
  }
  const candidates = Array.isArray(result.data) ? result.data : [result.data];
  if (recordId) {
    const candidate = !Array.isArray(result.data) && String(result.data?.id) === String(recordId) ? result.data : null;
    return settleVerifiedBankTransfer(db, row, [candidate], lookup.issue);
  }
  // A reference search locates a payout. Only the individual payout lookup can settle it.
  const ids = findMatchingProviderIds(row, candidates);
  if (ids.length === 1) return reconcileBankTransfer(db, row, config, { ...lookup, recordId: ids[0] });
  const issue = ids.length > 1 ? "Flutterwave returned multiple records for this payout. It is under review." : lookup.issue;
  return writeTransferStatus(db, row, "pending", issue ? { provider_batch_issue: issue } : {});
}

function matchingBankTransfers(row: TransferRow, candidates: any[]) {
  const meta = row.metadata ?? {};
  return candidates.filter((item) =>
    item?.reference === row.reference_id && item.currency === "NGN" &&
    Number(item.amount) === Number(row.amount) && String(item.account_number) === String(meta.account_number) &&
    (!item.bank_code || String(item.bank_code) === String(meta.account_bank))
  );
}

export function findMatchingProviderIds(row: TransferRow, candidates: any[]) {
  const ids = matchingBankTransfers(row, candidates).map((candidate) => String(candidate.id));
  return [...new Set(ids.filter((id) => validProviderId.test(id)))];
}

async function settleVerifiedBankTransfer(db: any, row: TransferRow, candidates: any[], providerBatchIssue?: string) {
  const [match] = matchingBankTransfers(row, candidates);
  const state = String(match?.status || "").toUpperCase();
  const status = state === "SUCCESSFUL" ? "completed" : ["FAILED", "CANCELLED", "CANCELED"].includes(state) ? "failed" : "pending";
  const bankName = typeof match?.bank_name === "string" && match.bank_name.trim()
    ? match.bank_name.trim().slice(0, 120)
    : undefined;
  const completeMessage = typeof match?.complete_message === "string" && match.complete_message.trim()
    ? match.complete_message.trim().slice(0, 240)
    : undefined;
  return writeTransferStatus(db, row, status, {
    provider_checked: true,
    ...(match?.id ? { flutterwave_id: match.id } : {}),
    ...(bankName ? { bank_name: bankName } : {}),
    ...(completeMessage ? { complete_message: completeMessage } : {}),
    ...(providerBatchIssue && !match ? { provider_batch_issue: providerBatchIssue } : {}),
  });
}

async function writeTransferStatus(db: any, row: TransferRow, status: string, details: Record<string, unknown>) {
  const { data, error } = await db.rpc("service_settle_priced_transfer", {
    p_reference: row.reference_id, p_status: status, p_details: details,
  });
  if (error) throw error;
  return data?.status || row.status;
}

export const transferReconciliationFields = "user_id,status,amount,reference_id,created_at,updated_at,metadata,bulk_batch_id";
