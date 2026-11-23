import { getFlutterwaveConfig } from "./flutterwaveConfig.ts";
import { reconcileBankTransfer, transferReconciliationFields, type TransferRow } from "./reconcileBankTransfer.ts";
import { reconcileBulkTransfers } from "./reconcileBulkTransfer.ts";

export async function runPayoutReconciliation(db: any, backup = false) {
  const { data: lease, error: claimError } = await db.rpc("service_claim_payout_reconciliation", { p_backup: backup });
  if (claimError) throw claimError;
  if (!lease) return { ran: false };

  const result = {
    ran: true,
    single: { resolved: 0, pending: 0, failed: 0 },
    bulk: { checked: 0, progressed: 0, failed: 0 },
  };
  const cutoff = new Date(Date.now() - 30_000).toISOString();
  const deadline = Date.now() + 45_000;
  try {
    const config = await getFlutterwaveConfig({ supabaseAdmin: db });
    const checkSingles = async () => {
      const { data, error } = await db.from("transactions").select(transferReconciliationFields)
        .eq("type", "transfer").eq("status", "pending").is("bulk_batch_id", null)
        .filter("metadata->>pricing_reserved", "eq", "true").lt("updated_at", cutoff)
        .order("updated_at").order("id").limit(32);
      if (error) throw error;
      const rows = (data ?? []) as TransferRow[];
      for (let offset = 0; offset < rows.length && Date.now() < deadline; offset += 8) {
        await Promise.all(rows.slice(offset, offset + 8).map(async (row) => {
          try {
            const status = await reconcileBankTransfer(db, row, config, {
              onUnavailable: () => { result.single.failed++; },
            });
            if (status === "pending") result.single.pending++;
            else result.single.resolved++;
          } catch {
            result.single.failed++;
          }
        }));
      }
    };
    const [single, bulk] = await Promise.allSettled([checkSingles(), reconcileBulkTransfers(db, config)]);
    if (single.status === "rejected") result.single.failed++;
    if (bulk.status === "fulfilled") result.bulk = bulk.value;
    else result.bulk.failed++;
  } catch {
    result.single.failed++;
  } finally {
    const { data, error } = await db.rpc("service_finish_payout_reconciliation", { p_lease: lease, p_result: result });
    if (error || data !== true) throw error ?? new Error("Payout reconciliation lease changed");
  }
  if (result.single.failed || result.bulk.failed) console.warn("Payout reconciliation checks failed", result);
  return result;
}
