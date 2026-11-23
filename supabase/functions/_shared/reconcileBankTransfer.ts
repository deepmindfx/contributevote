import { getFlutterwaveTransfer, listFlutterwaveTransfers, type FlutterwaveRuntimeConfig } from "./flutterwaveConfig.ts";

export type TransferRow = {
  user_id: string; status: string; amount: number | string; reference_id: string; bulk_batch_id?: string | null;
  created_at: string; updated_at?: string | null; metadata?: Record<string, unknown>;
};

type PayoutLookup = { recordId?: string; issue?: string; onUnavailable?: () => void };
const validProviderId = /^[1-9][0-9]{0,19}$/;

export async function reconcileBankTransfer(
  db: any, row: TransferRow, config: FlutterwaveRuntimeConfig, lookup: PayoutLookup = {},
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
  const pending = (issue?: string) => writeTransferStatus(db, row, "pending", issue ? { provider_batch_issue: issue } : {});
  if (!config.secretKey) {
    lookup.onUnavailable?.();
    return pending();
  }

  let unavailable = false;
  const verifyById = async (id: string) => {
    const result = await getFlutterwaveTransfer(id, config);
    if (!result) {
      unavailable = true;
      return null;
    }
    if (Array.isArray(result.data) || String(result.data?.id) !== id) return null;
    return matchingBankTransfers(row, [result.data])[0] ?? null;
  };

  const hint = String(lookup.recordId ?? meta.payout_lookup_id ?? "");
  if (validProviderId.test(hint)) {
    const match = await verifyById(hint);
    if (match) return settleVerifiedBankTransfer(db, row, match);
  }
  // A stale hint can never settle a transfer. Recover through the original reference.
  const remote = await listFlutterwaveTransfers(new URLSearchParams({ reference }), AbortSignal.timeout(9000), config).catch(() => null);
  const result = remote?.response.ok ? await remote.response.json().catch(() => null) : null;
  if (result?.status === "success") {
    const ids = findMatchingProviderIds(row, Array.isArray(result.data) ? result.data : [result.data]);
    if (ids.length === 1 && ids[0] !== hint) {
      const match = await verifyById(ids[0]);
      if (match) return settleVerifiedBankTransfer(db, row, match);
    }
    if (ids.length > 1) return pending("Flutterwave returned multiple records for this payout. It is under review.");
  } else unavailable = true;
  if (unavailable) lookup.onUnavailable?.();
  return pending(lookup.issue);
}

function matchingBankTransfers(row: TransferRow, candidates: any[]) {
  const meta = row.metadata ?? {};
  const account = String(meta.account_number ?? "");
  if (!/^\d{10}$/.test(account) || !meta.account_bank) return [];
  return candidates.filter((item) =>
    item?.reference === row.reference_id && item.currency === "NGN" &&
    Number(item.amount) === Number(row.amount) && String(item.account_number) === account &&
    (!item.bank_code || String(item.bank_code) === String(meta.account_bank))
  );
}

export function findMatchingProviderIds(row: TransferRow, candidates: any[]) {
  const ids = matchingBankTransfers(row, candidates).map((candidate) => String(candidate.id));
  return [...new Set(ids.filter((id) => validProviderId.test(id)))];
}

async function settleVerifiedBankTransfer(db: any, row: TransferRow, match: any) {
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
    flutterwave_id: match.id,
    ...(status === "pending" ? { payout_lookup_id: String(match.id) } : {}),
    ...(bankName ? { bank_name: bankName } : {}),
    ...(completeMessage ? { complete_message: completeMessage } : {}),
  });
}

export async function rememberPayoutId(db: any, row: TransferRow, acknowledgement: unknown) {
  const ids = findMatchingProviderIds(row, [acknowledgement]);
  if (ids.length === 1) await writeTransferStatus(db, row, "pending", { payout_lookup_id: ids[0] });
}

async function writeTransferStatus(db: any, row: TransferRow, status: string, details: Record<string, unknown>) {
  const { data, error } = await db.rpc("service_settle_priced_transfer", {
    p_reference: row.reference_id, p_status: status, p_details: details,
  });
  if (error) throw error;
  return data?.status || row.status;
}

export const transferReconciliationFields = "user_id,status,amount,reference_id,created_at,updated_at,metadata,bulk_batch_id";
