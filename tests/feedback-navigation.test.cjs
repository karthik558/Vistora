const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Feedback destinations share their data layout and retain per-page authorization", () => {
  const rights = { overview: "view_feedback", feedback: "view_feedback", analytics: "view_feedback", directory: "view_feedback", complaints: "manage_complaints", forms: "manage_questionnaire", questionnaire: "manage_questionnaire", "qr-codes": "manage_questionnaire", invitations: "manage_questionnaire", "audit-log": "view_audit_log", reports: "export_reports" };
  for (const [section, right] of Object.entries(rights)) {
    const page = read(`app/dashboard/(feedback)/${section}/page.tsx`);
    assert.ok(page.includes(`requireFeedbackPage("${right}")`));
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
  const dashboard = read("components/Dashboard.tsx");
  assert.match(dashboard, /if \(initialData\) \{\s*setLiveFeedback\(initialData.recentFeedback\);\s*return;/);
  assert.match(dashboard, /onNavigate=/);
  assert.match(dashboard, /prefetch=\{true\}/);
  assert.doesNotMatch(dashboard, /role="progressbar"/);
  assert.doesNotMatch(dashboard, /showNavigationProgress|setIsNavigating/);
});

test("Dashboard cache cannot share RLS data between sessions with identical property filters", () => {
  const service = read("lib/services/guestExperienceService.ts");
  assert.match(service, /createHash\("sha256"\)\.update\(token\)/);
  assert.match(service, /cacheKey = `\$\{sessionKey\}:\$\{propertyId\}/);
  assert.match(service, /dashboardCache.size >= 100/);
});