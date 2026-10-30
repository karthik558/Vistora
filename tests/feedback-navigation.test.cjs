const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Workspace entry prefetches public links and keeps login pending through navigation", () => {
  assert.equal((read("app/page.tsx").match(/prefetch=\{true\}/g) || []).length, 2);
  const login = read("components/LoginForm.tsx");
  assert.match(login, /startNavigation\(\(\) => router.replace/);
  assert.match(login, /disabled=\{loading \|\| openingWorkspace\}/);
  assert.doesNotMatch(login, /window.location|router.prefetch/);
  const auth = read("lib/auth/serverAuth.ts");
  assert.match(auth, /\[profileResult, memberResult\] = await Promise.all/);
  assert.match(auth, /membership.organization_id !== profile.organization_id/);
});

test("Administration shares its shell and hotel operations starts without waiting for legacy data", () => {
  for (const section of ["workspace", "users", "settings", "properties", "role-mapping"]) {
    assert.match(read(`app/dashboard/${section}/page.tsx`), /AdministrationWorkspace/);
  }
  const admin = read("components/AdministrationWorkspace.tsx");
  assert.match(admin, /window.history.pushState/);
  assert.match(admin, /visible.filter\(allowed\)/);
  assert.match(admin, /hidden=\{name!==section\}/);
  const hotel = read("components/HospitalityPage.tsx");
  assert.ok(hotel.indexOf("<OperationsSuite") < hotel.indexOf("{data&&<>"));
  assert.equal((hotel.match(/<OperationsSuite/g) || []).length, 1);
  const jobs = read("components/OperationsJobBoard.tsx");
  assert.match(jobs, /<details className="ops-alert-preferences">/);
  assert.match(jobs, /disabled=\{pushBusy\}/);
});

test("Guest link origins are identical during SSR and initial hydration", () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const source = ts.transpileModule(read("lib/useBrowserOrigin.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText;
  function render(browserOrigin) {
    const effects = [];
    let value;
    const exports = {};
    const context = {
      exports,
      require: () => ({
        useState: initial => [initial, next => { value = next; }],
        useEffect: effect => effects.push(effect),
      }),
      ...(browserOrigin ? { window: { location: { origin: browserOrigin } } } : {}),
    };
    vm.runInNewContext(source, context);
    const initial = exports.useBrowserOrigin();
    return { initial, hydrate: () => { effects.forEach(effect => effect()); return value; } };
  }
  assert.equal(render().initial, "");
  for (const host of ["http://localhost:3000", "https://hotel.example"]) {
    const browser = render(host);
    assert.equal(browser.initial, render().initial);
    assert.equal(browser.hydrate(), host);
  }
  const qr = read("components/OperationsPage.tsx");
  assert.match(qr, /const origin = useBrowserOrigin\(\)/);
  assert.match(qr, /if \(!origin\) return;\s*let active = true;/);
  assert.doesNotMatch(qr, /const origin = typeof window/);
  assert.doesNotMatch(read("components/GuestInvitationsPage.tsx"), /const origin = typeof window/);
});

test("Feedback destinations share their data layout and retain per-page authorization", () => {
  const rights = { overview: "view_feedback", feedback: "view_feedback", analytics: "view_feedback", directory: "view_feedback", complaints: "manage_complaints", forms: "manage_questionnaire", questionnaire: "manage_questionnaire", "qr-codes": "manage_questionnaire", invitations: "manage_questionnaire", "audit-log": "view_audit_log", reports: "export_reports" };
  for (const [section, right] of Object.entries(rights)) {
    const page = read(`app/dashboard/(feedback)/${section}/page.tsx`);
    assert.ok(section === "overview" ? page.includes("feedbackSectionRights[section]") : page.includes(`requireFeedbackPage("${right}")`));
    assert.ok(page.includes(`section="${section}"`));
    assert.ok(!page.includes("getDashboardData"));
    assert.ok(!fs.existsSync(path.join(root, `app/dashboard/${section}/page.tsx`)));
  }
  assert.match(read("app/dashboard/(feedback)/layout.tsx"), /getDashboardData\("all", allowed\)/);
  const access = read("lib/feedback/page-access.ts");
  assert.match(access, /hasModuleAccess\(user, "feedback"\)/);
  assert.match(access, /user\.rights\.includes\(right\)/);
});

test("Feedback shell persists, refreshes independently of navigation, and avoids duplicate overview fetches", () => {
  const workspace = read("components/FeedbackWorkspace.tsx");
  assert.match(workspace, /FeedbackShellContext.Provider value=\{true\}/);
  assert.match(workspace, /setInterval\(refresh, 60_000\)/);
  assert.match(workspace, /clearInterval\(timer\)/);
  assert.doesNotMatch(workspace, /router\.refresh\(|addEventListener\("focus"/);
  assert.match(workspace, /fetch\("\/api\/metrics"/);
  const dashboard = read("components/Dashboard.tsx");
  assert.match(dashboard, /if \(initialData\) \{\s*setLiveFeedback\(initialData.recentFeedback\);\s*return;/);
  assert.match(dashboard, /onClick=\{\(\) => setMobileNavOpen\(false\)\}/);
  assert.match(dashboard, /feedbackSection\(item.href\) \? false : true/);
  assert.doesNotMatch(dashboard, /role="progressbar"/);
  assert.doesNotMatch(dashboard, /showNavigationProgress|setIsNavigating/);
  assert.match(dashboard, /return "\/dashboard\/overview\?section="/);
});

test("Feedback section switching updates history without a server navigation", () => {
  const workspace = read("components/FeedbackWorkspace.tsx");
  assert.match(workspace, /window.history.pushState\(null/);
  assert.match(workspace, /event.preventDefault\(\)/);
  assert.match(workspace, /event.metaKey \|\| event.ctrlKey/);
  assert.match(workspace, /workspace.user.rights\?\.includes\(feedbackSectionRights\[section\]\)/);
  assert.match(workspace, /searchParams.get\("section"\) \|\| initialSection/);
});

test("Dashboard cache cannot share RLS data between sessions with identical property filters", () => {
  const service = read("lib/services/guestExperienceService.ts");
  assert.match(service, /createHash\("sha256"\)\.update\(token\)/);
  assert.match(service, /cacheKey = `\$\{sessionKey\}:\$\{propertyId\}/);
  assert.match(service, /dashboardCache.size >= 100/);
});