const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, deps = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => deps[name], URL, Request, Response, AbortSignal, console, ...globals });
  return exports;
}

test("post-login navigation preserves an internal destination and rejects external destinations", () => {
  const { safeReturnPath } = load("src/lib/safeReturnPath.ts");
  const origin = "https://fixture.example";
  assert.equal(safeReturnPath("/wallet-history?month=current#activity", origin), "/wallet-history?month=current#activity");
  assert.equal(safeReturnPath("https://another.example", origin), null);
  assert.equal(safeReturnPath(null, origin), null);
  assert.equal(safeReturnPath("/groups/../settings", origin), "/settings");
});

test("virtual-account history is only fetched for the authenticated user's linked references", async () => {
  let fetches = 0;
  let earnedAuth = true;
  let handler;
  const client = {
    auth: { getUser: async () => ({ data: { user: earnedAuth ? { id: "owner" } : null } }) },
    from(name) {
      assert.equal(name, "profiles");
      return {
        select: () => ({
          eq: (column, value) => {
            assert.equal(column, "id");
            assert.equal(value, "owner");
            return { maybeSingle: async () => ({ data: { preferences: { virtualAccount: { accountReference: "owned", accounts: [{ account_reference: "linked" }] } } } }) };
          },
        }),
      };
    },
  };
  load("supabase/functions/flutterwave-transactions/index.ts", {
    "jsr:@supabase/functions-js/edge-runtime.d.ts": {},
    "jsr:@supabase/supabase-js@2": { createClient: () => client },
    "../_shared/flutterwaveConfig.ts": {
      getFlutterwaveConfig: async () => ({ secretKey: "fixture" }),
      flutterwaveFetch: async (url) => {
        fetches++;
        assert.ok(url.includes("/owned/") || url.includes("/linked/"));
        return { response: Response.json({ data: { content: [] } }) };
      },
    },
  }, { Deno: { serve: (callback) => { handler = callback; }, env: { get: () => "fixture" } } });
  const request = (reference) => new Request("https://fixture.example", {
    method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify({ account_reference: reference }),
  });
  for (const reference of ["owned", "linked"]) assert.equal((await handler(request(reference))).status, 200);
  assert.equal((await handler(request("unlinked"))).status, 404);
  earnedAuth = false;
  assert.ok((await handler(request("owned"))).status >= 400);
  assert.equal(fetches, 2);
});

test("the obsolete Netlify payment webhook exits without processing a request", async () => {
  const { handler } = require("../netlify/functions/webhooks-flutterwave.cjs");
  assert.equal((await handler({ httpMethod: "POST" })).statusCode, 410);
});
