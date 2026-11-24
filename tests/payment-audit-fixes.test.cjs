const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { webcrypto, randomUUID } = require("node:crypto");
const ts = require("typescript");

function load(file, dependencies, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: (name) => dependencies[name], URL, URLSearchParams, Request, Response,
    AbortSignal, console, ...globals,
  });
  return exports;
}

const baseUrl = "https://provider.fixture/v3";
const config = { secretKey: "fixture-key", webhookHash: "fixture-signature" };
const charge = {
  id: "12931", amount: 250.12, tx_ref: "GROUP_fixture_VA", flw_ref: "fixture-flw-reference",
  currency: "NGN", payment_type: "bank_transfer", status: "successful",
};

test("only matching successful NGN charges can be applied", async () => {
  let record = charge;
  const calls = [];
  const inbound = load("supabase/functions/_shared/verifiedInbound.ts", {
    "./flutterwaveConfig.ts": { FLUTTERWAVE_BASE_URL: baseUrl },
  }, { fetch: async (url, options) => {
    calls.push(url);
    assert.equal(options.method, "GET");
    return Response.json({ status: "success", data: record });
  } });
  assert.equal((await inbound.fetchVerifiedInbound(config, charge.id)).amount, charge.amount);
  assert.equal(calls[0], baseUrl + "/transactions/" + charge.id + "/verify");
  for (const patch of [{ id: "13936" }, { currency: "USD" }, { amount: 100.001 }, { status: "pending" }]) {
    record = { ...charge, ...patch };
    assert.equal(await inbound.fetchVerifiedInbound(config, charge.id), null);
  }
  const checked = calls.length;
  assert.equal(await inbound.fetchVerifiedInbound(config, undefined, charge.tx_ref), null);
  assert.equal(calls.length, checked);
});

test("verified group deposits use the canonical provider identity and hold unmatched destinations", async () => {
  const inbound = load("supabase/functions/_shared/verifiedInbound.ts", {
    "./flutterwaveConfig.ts": { FLUTTERWAVE_BASE_URL: baseUrl },
  });
  let recipient = null;
  const credits = [];
  const queued = [];
  const db = {
    async rpc(name, args) {
      if (name === "service_resolve_virtual_account_payment") {
        assert.equal(args.p_reference, charge.tx_ref);
        assert.equal(args.p_account, null);
        return { data: recipient };
      }
      assert.equal(name, "service_apply_verified_group_bank_payment");
      credits.push(args);
      return { data: { transactionId: "fixture-ledger-entry" } };
    },
    from(table) {
      assert.equal(table, "inbound_payment_review");
      return {
        async upsert(details) { queued.push(details); return { error: null }; },
        update() { return { eq() { return { is: async () => ({ error: null }) }; } }; },
      };
    },
  };
  assert.equal((await inbound.applyVerifiedInbound(db, charge)).queued, true);
  assert.equal(queued[0].reason, "destination_unresolved");
  assert.equal(credits.length, 0);
  recipient = { kind: "group", id: "fixture-group", account: "0000012345" };
  assert.equal((await inbound.applyVerifiedInbound(db, charge, 1)).queued, false);
  assert.equal(credits.length, 1);
  assert.equal(credits[0].p_provider_id, charge.id);
  assert.equal(credits[0].p_destination, recipient.account);
});

test("the webhook verifies legacy incoming events before passing data to settlement", async () => {
  let handler;
  let result = null;
  const verified = [];
  const applied = [];
  load("supabase/functions/webhook-contribution/index.ts", {
    "jsr:@supabase/supabase-js@2": { createClient: () => ({}) },
    "../_shared/flutterwaveConfig.ts": { getFlutterwaveConfig: async () => config },
    "../_shared/reconcileBankTransfer.ts": {},
    "../_shared/verifiedInbound.ts": {
      async fetchVerifiedInbound(_config, id) { verified.push(id); return result; },
      async applyVerifiedInbound(_db, payload) { applied.push(payload); return { queued: false }; },
    },
  }, { Deno: { env: { get: () => "" }, serve: (next) => { handler = next; } } });
  const send = (type, signature = config.webhookHash) => handler(new Request("https://fixture.example", {
    method: "POST",
    headers: { "verif-hash": signature },
    body: JSON.stringify({ type, data: { id: charge.id, amount: 300 }, meta_data: { originatorname: "Fixture sender" } }),
  }));
  assert.equal((await send("virtual_account_credit", "wrong")).status, 401);
  assert.equal(verified.length, 0);
  assert.equal((await send("virtual_account_credit")).status, 503);
  assert.equal(applied.length, 0);
  result = charge;
  assert.equal((await send("contribution_received")).status, 200);
  assert.deepEqual(applied, [charge]);
});

test("verified legacy card charges preserve existing receipts and queue new charges without crediting metadata", async () => {
  const inbound = load("supabase/functions/_shared/verifiedInbound.ts", {
    "./flutterwaveConfig.ts": { FLUTTERWAVE_BASE_URL: baseUrl },
  });
  const card = { ...charge, payment_type: "card", tx_ref: "legacy_checkout", meta: { user_id: randomUUID(), group_id: randomUUID() } };
  const queue = [];
  const resolved = [];
  let receipt = null;
  const db = {
    async rpc(name, args) {
      assert.equal(name, "service_find_settled_inbound");
      assert.equal(args.p_provider_id, card.id);
      assert.equal(args.p_amount, card.amount);
      return { data: receipt };
    },
    from(table) {
      assert.equal(table, "inbound_payment_review");
      return {
        async upsert(record) { queue.push(record); return { error: null }; },
        update: () => ({ eq: (_column, id) => ({ is: async () => { resolved.push(id); return { error: null }; } }) }),
      };
    },
  };
  const first = await inbound.applyVerifiedInbound(db, card);
  assert.equal(first.queued, true);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].reason, "missing_checkout_intent");
  assert.equal(queue[0].amount, card.amount);
  assert.equal(queue[0].user_id, undefined);
  receipt = { transactionId: randomUUID(), alreadyProcessed: true };
  const second = await inbound.applyVerifiedInbound(db, card);
  assert.equal(second.queued, false);
  assert.equal(second.data.transactionId, receipt.transactionId);
  assert.deepEqual(resolved, [card.id]);
  assert.equal(queue.length, 1);
});

test("ambiguous transfer and contribution attempts survive module reload and clear after confirmation", async () => {
  const records = new Map();
  const globals = {
    crypto: webcrypto, TextEncoder,
    sessionStorage: {
      getItem: (key) => records.get(key),
      setItem: (key, value) => records.set(key, value),
      removeItem: (key) => records.delete(key),
    },
  };
  const fresh = () => load("src/lib/paymentAttempt.ts", { uuid: { v4: randomUUID } }, globals).paymentAttempt;
  for (const scope of ["transfer", "contribution"]) {
    const original = await fresh()(scope, "account-owner", ["fixture-intent", 200]);
    const reloaded = await fresh()(scope, "account-owner", ["fixture-intent", 200]);
    const different = await fresh()(scope, "account-owner", ["fixture-intent", 250]);
    assert.equal(reloaded.id, original.id);
    assert.notEqual(different.id, original.id);
    reloaded.finish();
    assert.notEqual((await fresh()(scope, "account-owner", ["fixture-intent", 200])).id, original.id);
  }
  assert.ok([...records.keys()].every(key => /^collectipay-payment-attempt:[a-f0-9]{64}$/.test(key)));
});

test("payout recovery withholds the second decision when the latest provider check reports paid or pending", async () => {
  let handler;
  let latest = "SUCCESSFUL";
  const writes = [];
  const user = { id: randomUUID() };
  const reviewId = randomUUID();
  const row = { transaction_id: "fixture-payout", status: "pending", basis: "not_debited", submitted_by: randomUUID() };
  const db = {
    from(name) {
      return { select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: name === "payout_recovery_reviews" ? row : { status: "pending" } }) }),
      }) };
    },
    async rpc(method, args) { writes.push({ method, args }); return { data: { status: "approved" } }; },
  };
  const caller = {
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async () => ({ data: true }),
  };
  load("supabase/functions/admin-payout-recovery/index.ts", {
    "jsr:@supabase/supabase-js@2": { createClient: (_url, _key, opts) => opts ? caller : db },
    "../_shared/flutterwaveConfig.ts": { getFlutterwaveConfig: async () => config },
    "../_shared/reconcileBankTransfer.ts": {
      reconcileBankTransfer: async (_db, _row, _config, { onProviderStatus }) => {
        onProviderStatus(latest);
        return latest === "SUCCESSFUL" ? "completed" : "pending";
      },
    },
  }, { Deno: { env: { get: () => "" }, serve: (next) => { handler = next; } } });

  const request = () => new Request("https://fixture.example", { method: "POST", headers: { Authorization: "Bearer fixture" },
    body: JSON.stringify({ approve: true, review_id: reviewId, pin: "5820" }) });
  assert.equal((await handler(request())).status, 409);
  latest = "PENDING";
  assert.equal((await handler(request())).status, 409);
  latest = "NOT_FOUND";
  assert.equal((await handler(request())).status, 409);
  latest = "REVERSED";
  assert.equal((await handler(request())).status, 409);
  assert.equal(writes.length, 0);
  latest = "FAILED";
  assert.equal((await handler(request())).status, 200);
  assert.equal(writes[0].method, "service_decide_payout_recovery");
  assert.equal(writes[0].args.p_provider_status, "FAILED");
  assert.equal(writes[0].args.p_admin_id, user.id);
});

test("bank account verification checks user eligibility and quota before disclosing the minimum result", async () => {
  let handler;
  let user = null;
  let status = "active";
  let quota = false;
  let lookups = 0;
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status } }) }) }) }),
    rpc: async () => ({ data: quota }),
  };
  load("supabase/functions/flutterwave-resolve-account/index.ts", {
    "jsr:@supabase/supabase-js@2": {
      createClient: (_url, _key, options) => options ? { auth: { getUser: async () => ({ data: { user } }) } } : db,
    },
    "../_shared/flutterwaveConfig.ts": {
      getFlutterwaveConfig: async () => config,
      flutterwaveFetch: async () => {
        lookups++;
        return { response: Response.json({ status: "success", data: {
          account_name: "Fixture Recipient", account_number: "0000012345", provider_only: "internal",
        } }) };
      },
    },
  }, { Deno: { env: { get: () => "" }, serve: (next) => { handler = next; } } });
  const send = (account_number = "0000012345") => handler(new Request("https://fixture.example", {
    method: "POST", headers: { Authorization: "Bearer fixture" },
    body: JSON.stringify({ account_number, bank_code: "011" }),
  }));
  assert.equal((await send()).status, 401);
  user = { id: randomUUID(), email_confirmed_at: "2026-11-24T00:00:00Z" };
  assert.equal((await send("1234")).status, 400);
  status = "suspended";
  assert.equal((await send()).status, 403);
  status = "active";
  assert.equal((await send()).status, 429);
  assert.equal(lookups, 0);
  quota = true;
  assert.deepEqual(await (await send()).json(), { success: true, data: { account_name: "Fixture Recipient", account_number: "0000012345" } });
  assert.equal(lookups, 1);
});

test("only an active admin can inspect relay health or force a bank refresh", async () => {
  let handler;
  let admin = false;
  let calls = 0;
  load("supabase/functions/flutterwave-banks/index.ts", {
    "jsr:@supabase/supabase-js@2": { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: randomUUID() } } }) },
      rpc: async () => ({ data: admin }),
    }) },
    "../_shared/flutterwaveConfig.ts": {
      getFlutterwaveConfig: async () => ({ ...config, mode: "live", source: "db", staticIpAddress: "192.0.2.1" }),
      flutterwaveFetch: async () => {
        calls++;
        return { response: Response.json({ data: [{ name: "Fixture Bank", code: "011" }] }), routedViaStaticIp: true };
      },
    },
  }, { Deno: { env: { get: () => "" }, serve: (next) => { handler = next; } } });
  const send = (query) => handler(new Request("https://fixture.example/" + query, { headers: { Authorization: "Bearer fixture" } }));
  assert.equal((await send("?check_relay=1")).status, 403);
  assert.equal((await send("?fresh=1")).status, 403);
  assert.equal(calls, 0);
  assert.deepEqual((await (await send("")).json()).meta, { count: 1 });
  admin = true;
  assert.equal((await (await send("?fresh=1")).json()).meta.staticIpAddress, "192.0.2.1");
});
