import { listFlutterwaveTransfers, type FlutterwaveRuntimeConfig } from "./flutterwaveConfig.ts";
import { findMatchingProviderIds, reconcileBankTransfer, transferReconciliationFields, type TransferRow } from "./reconcileBankTransfer.ts";

type Job = { id: string; provider_batch_id: string | null; lease: string };
const providerId = /^[1-9][0-9]{0,19}$/;
const resolved = (status: string | undefined) => status === "completed" || status === "failed";

async function reconcileJob(db: any, job: Job, config: FlutterwaveRuntimeConfig) {
  const { data, error } = await db.from("transactions").select(transferReconciliationFields)
    .eq("bulk_batch_id", job.id).eq("status", "pending").order("updated_at").order("reference_id");
  if (error) throw error;
  const pending = (data ?? []) as TransferRow[];
  if (!pending.length) return { progress: false, failures: 0 };

  // The first check releases all undispatched rows atomically once the reservation expires.
  if (pending[0].metadata?.dispatch_guard && !pending[0].metadata?.dispatched_at) {
    return { progress: resolved(await reconcileBankTransfer(db, pending[0], config)), failures: 0 };
  }
  if (!config.secretKey) throw new Error("Flutterwave is unavailable");

  const candidates: any[] = [];
  const issues = new Map<string, string>();
  if (job.provider_batch_id && providerId.test(job.provider_batch_id)) {
    const deadline = Date.now() + 12_000;
    for (let page = 1; page <= 10 && Date.now() < deadline; page++) {
      const query = new URLSearchParams({ batch_id: job.provider_batch_id, page: String(page) });
      const signal = AbortSignal.timeout(Math.max(1, Math.min(6000, deadline - Date.now())));
      const remote = await listFlutterwaveTransfers(query, signal, config).catch(() => null);
      const result = remote?.response.ok ? await remote.response.json().catch(() => null) : null;
      if (result?.status !== "success" || !Array.isArray(result.data)) break;
      candidates.push(...result.data);
      if (Array.isArray(result.meta?.errors)) {
        for (const item of result.meta.errors) {
          if (typeof item?.reference === "string" && typeof item?.message === "string") issues.set(item.reference, item.message.trim().slice(0, 240));
        }
      }
      if (page >= Number(result.meta?.page_info?.total_pages || 1)) break;
    }
  }

  // Check the oldest pending rows first. Each recorded check advances updated_at.
  // Batch-list statuses may lag; use the listing only to locate individual payouts.
  const outcomes = await Promise.allSettled(pending.slice(0, 8).map((row) => {
    const ids = findMatchingProviderIds(row, candidates);
    return reconcileBankTransfer(db, row, config, {
      recordId: ids.length === 1 ? ids[0] : undefined,
      issue: issues.get(row.reference_id),
    });
  }));
  return {
    progress: outcomes.some((outcome) => outcome.status === "fulfilled" && resolved(outcome.value)),
    failures: outcomes.filter((outcome) => outcome.status === "rejected").length,
  };
}

export async function reconcileBulkTransfers(db: any, config: FlutterwaveRuntimeConfig, batchId?: string) {
  const { data, error } = await db.rpc("service_claim_bulk_reconciliation", { p_batch_id: batchId ?? null, p_limit: batchId ? 1 : 4 });
  if (error) throw error;
  const jobs = (data ?? []) as Job[];
  const counts = { checked: jobs.length, progressed: 0, failed: 0 };
  for (let offset = 0; offset < jobs.length; offset += 2) {
    await Promise.all(jobs.slice(offset, offset + 2).map(async (job) => {
      let progress = false;
      try {
        const result = await reconcileJob(db, job, config);
        progress = result.progress;
        if (result.failures) {
          counts.failed++;
          console.warn("Bulk transfer recipient checks failed", { batch: job.id, count: result.failures });
        }
        if (progress) counts.progressed++;
      } catch (error) {
        counts.failed++;
        console.warn("Bulk transfer reconciliation failed", { batch: job.id, code: (error as { code?: string })?.code });
      } finally {
        const { error } = await db.rpc("service_finish_bulk_reconciliation", {
          p_batch_id: job.id, p_lease: job.lease, p_progress: progress,
        });
        if (error) {
          counts.failed++;
          console.warn("Couldn’t release reconciliation lease", { batch: job.id, code: error.code });
        }
      }
    }));
  }
  return counts;
}
