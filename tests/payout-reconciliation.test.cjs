const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, deps, fetch) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, "../supabase/functions/_shared", `${file}.ts`), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => deps[name], fetch, console, URLSearchParams, AbortSignal, Response });
  return exports;
}

const row = {
  reference_id: "TRF_fixture", user_id: "fixture", status: "pending", amount: 100, created_at: new Date(0).toISOString(),
  metadata: { dispatch_guard: true, dispatched_at: "now", account_number: "0000001234", account_bank: "100004" },
};
const config = { secretKey: "fixture", staticIpProxyUrl: "https://relay.fixture", staticIpProxySecret: "relay-fixture" };
const payout = {
  id: 987, reference: row.reference_id, amount: 100, account_number: row.metadata.account_number,
  bank_code: row.metadata.account_bank, currency: "NGN", status: "SUCCESSFUL",
};

function fixture(send) {
  const calls = [];
  const writes = [];
  const cfg = load("flutterwaveConfig", { "jsr:@supabase/supabase-js@2": {} }, async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    return send(url);
  });
  const bank = load("reconcileBankTransfer", { "./flutterwaveConfig.ts": cfg });
  const db = { rpc: async (method, args) => {
    assert.equal(method, "service_settle_priced_transfer");
    assert.equal(args.p_reference, row.reference_id);
    writes.push(args);
    return { data: { status: args.p_status === "failed" ? "pending" : args.p_status } };
  } };
  return { calls, writes, bank, cfg, db };
}

test("a missed webhook can recover by original reference without using the relay's list route", async () => {
  const f = fixture((url) => url.search
    ? Response.json({ status: "success", data: [payout] })
    : Response.json({ status: "success", data: payout }));
  assert.equal(await f.bank.reconcileBankTransfer(f.db, row, config), "completed");
  assert.equal(f.calls[0].url.host, "api.flutterwave.com");
  assert.equal(f.calls[0].url.searchParams.get("reference"), row.reference_id);
  assert.equal(f.calls[0].init.headers["X-Relay-Secret"], undefined);
  assert.equal(f.calls[1].url.pathname, "/v3/transfers/987");
  assert.ok(f.calls.every(({ init }) => init.method === "GET"));
});

test("a saved ID recovers through an individual direct lookup if the relay is down", async () => {
  const f = fixture((url) => url.host === "relay.fixture"
    ? new Response(null, { status: 403 })
    : Response.json({ status: "success", data: payout }));
  await f.bank.rememberPayoutId(f.db, row, payout);
  const saved = f.writes[0].p_details.payout_lookup_id;
  assert.equal(f.writes[0].p_status, "pending");
  assert.equal(await f.bank.reconcileBankTransfer(f.db, { ...row, metadata: { ...row.metadata, payout_lookup_id: saved } }, config), "completed");
  assert.deepEqual(f.calls.map(({ url }) => url.host), ["relay.fixture", "api.flutterwave.com"]);
  assert.ok(f.calls.every(({ url, init }) => url.pathname === "/v3/transfers/987" && init.method === "GET"));
});

test("an unrelated ID falls back to the original reference and an unverified amount stays held", async () => {
  const f = fixture((url) => {
    if (url.search) return Response.json({ status: "success", data: [payout] });
    if (url.pathname.endsWith("/123")) return Response.json({ status: "success", data: { ...payout, id: 123, reference: "other" } });
    return Response.json({ status: "success", data: { ...payout, amount: 101 } });
  });
  assert.equal(await f.bank.reconcileBankTransfer(f.db, row, config, { recordId: "123" }), "pending");
  assert.deepEqual(f.writes.map(({ p_status }) => p_status), ["pending"]);
});

test("an unavailable lookup is reported while the original debit stays pending", async () => {
  const f = fixture(() => new Response(null, { status: 503 }));
  let unavailable = 0;
  assert.equal(await f.bank.reconcileBankTransfer(f.db, row, config, { recordId: "987", onUnavailable: () => unavailable++ }), "pending");
  assert.equal(unavailable, 1);
  assert.deepEqual(f.writes.map(({ p_status }) => p_status), ["pending"]);
});

test("payout submission still uses the static-IP relay", async () => {
  const f = fixture(() => Response.json({ status: "success", data: payout }));
  await f.cfg.flutterwaveFetch("/transfers", { method: "POST", body: { reference: row.reference_id } }, config);
  assert.equal(f.calls[0].url.host, "relay.fixture");
  assert.equal(f.calls[0].init.method, "POST");
});

test("an overlapping or fresh backup run leaves the active worker alone", async () => {
  const worker = load("runPayoutReconciliation", {
    "./flutterwaveConfig.ts": {}, "./reconcileBankTransfer.ts": {}, "./reconcileBulkTransfer.ts": {},
  });
  let called = 0;
  const result = await worker.runPayoutReconciliation({ async rpc(name, args) {
    assert.equal(name, "service_claim_payout_reconciliation");
    assert.equal(args.p_backup, true);
    called++;
    return { data: null };
  } }, true);
  assert.equal(called, 1);
  assert.equal(result.ran, false);
});

test("the worker records a failed lookup and releases its lease for the next check", async () => {
  const worker = load("runPayoutReconciliation", {
    "./flutterwaveConfig.ts": { getFlutterwaveConfig: async () => config },
    "./reconcileBankTransfer.ts": { reconcileBankTransfer: async (_db, _row, _config, opts) => {
      opts.onUnavailable();
      return "pending";
    } },
    "./reconcileBulkTransfer.ts": { reconcileBulkTransfers: async () => ({ checked: 0, progressed: 0, failed: 0 }) },
  });
  let reported;
  const result = await worker.runPayoutReconciliation({
    async rpc(name, args) {
      if (name === "service_claim_payout_reconciliation") return { data: "lease" };
      assert.equal(name, "service_finish_payout_reconciliation");
      assert.equal(args.p_lease, "lease");
      reported = args.p_result;
      return { data: true };
    },
    from() {
      const query = {
        select: () => query, eq: () => query, is: () => query, filter: () => query, lt: () => query,
        order: () => query, limit: async () => ({ data: [row] }),
      };
      return query;
    },
  });
  assert.equal(result, reported);
  assert.equal(result.single.pending, 1);
  assert.equal(result.single.failed, 1);
});
