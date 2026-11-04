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
    const filters = []; const call = { table, filters, columns: "" }; calls.push(call);
    const q = {
      select(columns) { call.columns = columns; return q; }, eq(key, value) { filters.push([key, value]); return q; },
      in(key, value) { filters.push([key, value]); return q; },
      gt(key, value) { filters.push([key, 'gt', value]); return q; },
      lt(key, value) { filters.push([key, 'lt', value]); return q; },
      not(key, op, value) { filters.push([key, op, value]); return q; },
      or(value) { filters.push(['or', value]); return q; }, order() { return q; }, limit(value) { call.limit = value; return q; },
      async single() { return { data: { id: '11111111-1111-4111-8111-111111111111' }, error: null }; },
      then(resolve) { resolve({ data: table === 'properties' || call.columns.includes('title') ? [] : null, count: table === 'service_jobs' ? 1234 : 2345, error: null }); },
    }; return q;
  } };
  const original = db.sessionDb; db.sessionDb = () => client;
  const user = { id: 'staff', organizationId: 'org', isOrganizationAdmin: false, rights: ['module:hospitality', 'module_access:configured'] };
  const get = (u, params = '') => db.workspaceContext.run({ user: u, client }, () => route.GET(new NextRequest('http://localhost/api/operations/summary' + params)));
  try {
    const response = await get(user), json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(json.active, 1234); assert.equal(json.resolved, 1234); assert.equal(json.feedback, null);
    assert.ok(!calls.some(call => call.table === 'feedback'));
    assert.deepEqual(json.alerts, []);
    assert.equal(json.mine, 1234); assert.equal(json.overdue, 1234); assert.equal(json.cleaning, 2345); assert.equal(json.inHouse, 2345);
    assert.deepEqual(calls[5].filters, [['status', ['open', 'in_progress']], ['assigned_to', 'staff']]);
    assert.ok(calls[1].filters.some(filter => filter[0] === 'or' && filter[1].includes('assigned_to.eq.staff')));
    assert.ok(!calls[1].columns.includes('guest_name'));
    assert.equal(calls[1].limit, 5);
    assert.deepEqual(calls[3].filters, [['status', 'completed']]);
    assert.deepEqual(calls[4].filters, [['status', ['open', 'in_progress']], ['escalation_level', 'gt', 0]]);
    calls.length = 0;
    const admin = await get({ ...user, isOrganizationAdmin: true });
    assert.equal((await admin.json()).feedback, 2345);
    calls.length = 0;
    const property = '11111111-1111-4111-8111-111111111111';
    assert.equal((await get(user, '?property=' + property)).status, 200);
    for (const call of calls.filter(call => call.table !== 'properties')) assert.ok(call.filters.some(([key,value]) => key === 'property_id' && value === property));
    calls.length = 0;
    assert.equal((await get({ ...user, rights: ['module:feedback', 'module_access:configured'] })).status, 403);
    assert.equal(calls.length, 0);
  } finally { db.sessionDb = original; }
});
