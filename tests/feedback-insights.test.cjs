const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/feedback/insights.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, { exports: exportsObject });
const { matchesTopic, summarizeTopics, needsFollowUp, prioritizeFollowUps } = exportsObject;
const now = Date.parse('2026-11-03T12:00:00Z');
const row = (values = {}) => ({ id: 'a', status: 'under_review', rating: 3, comment: null, wantsContact: false, firstResponseAt: '2026-11-02', assignedTo: 'Team', createdAt: '2026-11-01', ...values });

test('Topic matching handles overlapping topics, missing comments and word boundaries', () => {
  const review = row({ comment: 'Clean room, helpful staff, but slow Wi-Fi.' });
  for (const topic of ['cleanliness', 'comfort', 'service', 'connectivity']) assert.equal(matchesTopic(review, topic), true);
  assert.equal(matchesTopic(row({ comment: 'The bedroom artwork was priceless.' }), 'value'), false);
  assert.equal(matchesTopic(row(), 'other'), true);
  assert.equal(matchesTopic(review, 'other'), false);
  assert.equal(matchesTopic(review, 'unknown'), false);
});

test('Topic counts use reviews once per topic and ratings rather than assumed sentiment', () => {
  const result = summarizeTopics([row({ comment: 'Clean clean clean', rating: 5 }), row({ comment: 'Not clean', rating: 1 }), row({ comment: 'Clean', rating: 3 })]);
  const clean = result.find(item => item.id === 'cleanliness');
  assert.equal(clean.count, 3); assert.equal(clean.positive, 1); assert.equal(clean.negative, 1); assert.equal(clean.average, 3);
  assert.equal(result.find(item => item.id === 'value').average, null);
  assert.equal(summarizeTopics([]).every(item => item.count === 0 && item.average === null), true);
});

test('Resolved cases never enter follow-up queues and invalid deadlines are not overdue', () => {
  for (const view of ['all', 'overdue', 'contact', 'unacknowledged', 'unassigned']) assert.equal(needsFollowUp(row({ status: 'resolved', wantsContact: true, firstResponseAt: null, assignedTo: null, deadline: '2026-11-01' }), view, now), false);
  assert.equal(needsFollowUp(row({ deadline: 'invalid' }), 'overdue', now), false);
  assert.equal(needsFollowUp(row({ deadline: '2026-11-04' }), 'overdue', now), false);
  assert.equal(needsFollowUp(row({ deadline: new Date(now).toISOString() }), 'overdue', now), false);
  assert.equal(needsFollowUp(row({ deadline: '2026-11-01' }), 'overdue', now), true);
  assert.equal(needsFollowUp(row(), 'all', now), false);
  assert.equal(needsFollowUp(row({ wantsContact: true }), 'contact', now), true);
  assert.equal(needsFollowUp(row({ firstResponseAt: null }), 'unacknowledged', now), true);
  assert.equal(needsFollowUp(row({ assignedTo: '  ' }), 'unassigned', now), true);
});

test('Follow-up priority is overdue, escalated, contact requested, then oldest; input stays unchanged', () => {
  const input = [row({ id: 'normal' }), row({ id: 'contact', wantsContact: true }), row({ id: 'escalated', status: 'escalated' }), row({ id: 'overdue', deadline: '2026-11-01' }), row({ id: 'older', createdAt: '2026-10-01' })];
  assert.equal(prioritizeFollowUps(input, now).map(item => item.id).join(','), 'overdue,escalated,contact,older,normal');
  assert.equal(input[0].id, 'normal');
});

test('Feedback pages retain authorization while the old insights route redirects to Analytics', () => {
  for (const section of ['insights', 'follow-ups']) {
    const page = fs.readFileSync(`app/dashboard/(feedback)/${section}/page.tsx`, 'utf8');
    assert.match(page, /requireFeedbackPage\("view_feedback"\)/);
    if (section === 'insights') {
      assert.match(page, /redirect\("\/dashboard\/analytics"\)/);
      assert.ok(!fs.readFileSync('components/Dashboard.tsx', 'utf8').includes('/dashboard/insights'));
    } else {
      assert.ok(page.includes(`section="${section}"`));
      assert.ok(fs.readFileSync('components/Dashboard.tsx', 'utf8').includes(`/dashboard/${section}`));
    }
    assert.ok(fs.readFileSync('lib/feedback/sections.ts', 'utf8').includes(section));
  }
});

test('Persisted workspace preferences hydrate from the same initial state as the server', () => {
  function render(file, hook, browser) {
    const effects = [];
    const changes = [];
    const exports = {};
    const react = { useState: initial => [typeof initial === 'function' ? initial() : initial, value => changes.push(value)], useCallback: fn => fn, useEffect: effect => effects.push(effect) };
    const context = { exports, require: () => react, ...(browser ? { window: { addEventListener() {}, removeEventListener() {} }, localStorage: { getItem: key => key.includes('property') ? '["hotel-a"]' : null } } : {}) };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText, context);
    const initial = exports[hook](4);
    return { initial, hydrate: () => { effects.forEach(effect => effect()); return changes; } };
  }
  const file = 'lib/platform/notificationsStore.ts';
  assert.equal(render(file, 'useComplaintBadge', false).initial.badgeCount, 0);
  const badge = render(file, 'useComplaintBadge', true);
  assert.equal(badge.initial.badgeCount, 0);
  assert.equal(badge.hydrate()[0], 1);
  const filter = render('lib/platform/propertyFilterStore.ts', 'useSharedPropertyFilter', true);
  assert.equal(filter.initial.selectedIds.join(','), 'all');
  assert.equal(filter.hydrate()[0].join(','), 'hotel-a');
});
