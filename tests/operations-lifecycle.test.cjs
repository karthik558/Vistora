const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
}).outputText, file);
const { createOperationsRealtimeClient } = require("../lib/omniops/realtime-client.ts");

test("Realtime clients bypass GoTrue and read the latest in-memory token", async () => {
  let token = "initial-token";
  const client = createOperationsRealtimeClient("https://example.supabase.co", "public-test-key", () => token);
  assert.throws(() => client.auth.getSession, /accessToken option/);
  assert.equal(await client.accessToken(), "initial-token");
  token = "refreshed-token";
  assert.equal(await client.accessToken(), "refreshed-token");
  token = null;
  assert.equal(await client.accessToken(), null);
  await client.removeAllChannels();
});

test("Operations lifecycle cancels startup and does not reconnect for property filters", () => {
  const source = fs.readFileSync(require.resolve("../lib/omniops/useOperations.ts"), "utf8");
  assert.match(source, /clearTimeout\(connectTimer\)/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /await realtime.realtime.setAuth\(auth.token\);\s*if \(disposed\) return;/);
  assert.match(source, /\}, \[organizationId, client\]\)/);
  assert.doesNotMatch(source, /\[organizationId, property, client\]/);
});

test("Mobile summary counts use full scoped queries, exclude cancelled resolutions and hide unauthorized feedback", async () => {
  const db = require("../lib/platform/db.ts");
  const { NextRequest } = require("next/server");
  const route = require("../app/api/operations/summary/route.ts");
  const calls = [];
  const client = { from(table) {
    const filters = []; calls.push({ table, filters });
    const q = {
      select() { return q; }, eq(key, value) { filters.push([key, value]); return q; },
      in(key, value) { filters.push([key, value]); return q; },
      gt(key, value) { filters.push([key, 'gt', value]); return q; }, order() { return q; },
      then(resolve) { resolve({ data: table === 'properties' ? [] : null, count: table === 'service_jobs' ? 1234 : 2345, error: null }); },
    }; return q;
  } };
  const original = db.sessionDb; db.sessionDb = () => client;
  const user = { id: 'staff', organizationId: 'org', isOrganizationAdmin: false, rights: ['module:hospitality', 'module_access:configured'] };
  const get = u => db.workspaceContext.run({ user: u, client }, () => route.GET(new NextRequest('http://localhost/api/operations/summary')));
  try {
    const response = await get(user), json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(json.active, 1234); assert.equal(json.resolved, 1234); assert.equal(json.feedback, null);
    assert.ok(!calls.some(call => call.table === 'feedback'));
    assert.deepEqual(calls[2].filters, [['status', 'completed']]);
    assert.deepEqual(calls[3].filters, [['status', ['open', 'in_progress']], ['escalation_level', 'gt', 0]]);
    calls.length = 0;
    const admin = await get({ ...user, isOrganizationAdmin: true });
    assert.equal((await admin.json()).feedback, 2345);
    calls.length = 0;
    assert.equal((await get({ ...user, rights: ['module:feedback', 'module_access:configured'] })).status, 403);
    assert.equal(calls.length, 0);
  } finally { db.sessionDb = original; }
});
