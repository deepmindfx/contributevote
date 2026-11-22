import { flutterwaveFetch, type FlutterwaveRuntimeConfig } from "./flutterwaveConfig.ts";

type TransferRow = {
  user_id: string; status: string; amount: number | string; reference_id: string;
  created_at: string; updated_at?: string | null; metadata?: Record<string, unknown>;
};

export async function reconcileBankTransfer(db: any, row: TransferRow, config: FlutterwaveRuntimeConfig) {
  if (row.status !== "pending") return row.status;
  const reference = row.reference_id;
  const meta = row.metadata ?? {};
  if (meta.dispatch_guard && !meta.dispatched_at) {
    if (Date.now() - Date.parse(row.created_at) < 120_000) return row.status;
    const { data } = await db.rpc("service_release_unsent_transfer", { p_reference: reference, p_user_id: row.user_id });
    return data || row.status;
  }
  if (!config.secretKey) return row.status;

  const path = meta.flutterwave_id
    ? "/transfers/" + encodeURIComponent(String(meta.flutterwave_id))
    : "/transfers?reference=" + encodeURIComponent(reference);
  const { response } = await flutterwaveFetch(path, { method: "GET", signal: AbortSignal.timeout(9000) }, config);
  if (!response.ok) return row.status;
  const result = await response.json().catch(() => null);
  if (result?.status !== "success") return row.status;
  const candidates = Array.isArray(result.data) ? result.data : [result.data];
  const match = candidates.find((item) =>
    item?.reference === reference && item.currency === "NGN" &&
    Number(item.amount) === Number(row.amount) && String(item.account_number) === String(meta.account_number) &&
    (!item.bank_code || String(item.bank_code) === String(meta.account_bank))
  );
  const state = String(match?.status || "").toUpperCase();
  const status = state === "SUCCESSFUL" ? "completed" : ["FAILED", "CANCELLED", "CANCELED"].includes(state) ? "failed" : "pending";
  const bankName = typeof match?.bank_name === "string" && match.bank_name.trim()
    ? match.bank_name.trim().slice(0, 120)
    : undefined;
  const completeMessage = typeof match?.complete_message === "string" && match.complete_message.trim()
    ? match.complete_message.trim().slice(0, 240)
    : undefined;
  const { data, error } = await db.rpc("service_settle_priced_transfer", {
    p_reference: reference, p_status: status, p_details: {
      provider_checked: true,
      ...(match?.id ? { flutterwave_id: match.id } : {}),
      ...(bankName ? { bank_name: bankName } : {}),
      ...(completeMessage ? { complete_message: completeMessage } : {}),
    },
  });
  if (error) throw error;
  return data?.status || row.status;
}

export const transferReconciliationFields = "user_id,status,amount,reference_id,created_at,updated_at,metadata";
