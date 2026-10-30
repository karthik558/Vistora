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