const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), ...globals });
  return exports;
}
const icons = new Proxy({}, { get: () => () => null });
const dateHelpers = load('components/CustomDatePicker.tsx', {});

test('Collection ranges include both boundary dates, exclude other properties, and clear to all dates', () => {
  const range = { preset: 'custom', startDate: '2026-11-01', endDate: '2026-11-03' };
  const rows = [
    ['Before range', '2026-10-31', 'p1'], ['Range start', '2026-11-01', 'p1'],
    ['Range end', '2026-11-03', 'p1'], ['After range', '2026-11-04', 'p1'],
    ['Other property', '2026-11-02', 'p2'],
  ].map(([guestName, checkIn, propertyId], i) => ({ id: String(i), guestName, checkIn, propertyId, propertyName: 'Hotel', roomNumber: '101', collectionStatus: 'pending', checkOut: '2026-11-08', followup: null }));
  let selectedRange = range;
  const Directory = load('components/GuestDirectory.tsx', {
    react: { ...React, useState: initial => React.useState(initial?.preset === 'all' ? selectedRange : initial) },
    '@tanstack/react-query': { useQuery: () => ({ data: { guests: rows, canTakeFeedback: true } }) },
    'next/link': { __esModule: true, default: ({ children }) => React.createElement('a', {}, children) },
    'lucide-react': icons,
    '../lib/platform/propertyFilterStore': { useSharedPropertyFilter: () => ({ selectedIds: ['p1'] }), matchesPropertyFilter: id => id === 'p1' },
    './CustomDatePicker': { __esModule: true, ...dateHelpers, default: () => null },
    './WorkspaceSelect': { __esModule: true, default: () => null },
    './PropertyFilter': { __esModule: true, default: () => null },
  }).default;
  const render = () => renderToStaticMarkup(React.createElement(Directory, { user: { isOrganizationAdmin: true }, properties: [], history: null }));
  const filtered = render();
  assert.match(filtered, /Range start/); assert.match(filtered, /Range end/);
  assert.doesNotMatch(filtered, /Before range|After range|Other property/);
  assert.match(filtered, /Clear filters/);
  assert.doesNotMatch(filtered, /date-field-clear/);
  selectedRange = { preset: 'all', startDate: null, endDate: null };
  const cleared = render();
  assert.match(cleared, /Before range/); assert.match(cleared, /After range/);
  assert.doesNotMatch(cleared, /Other property/);
});

test('Property menu stays within its card at either edge and on narrow screens', () => {
  for (const [cardLeft, cardRight, anchorLeft, viewport] of [[240, 1100, 900, 1280], [240, 1100, 260, 1280], [16, 359, 210, 375]]) {
    const effects = []; let style; let stateCount = 0;
    const trigger = { getBoundingClientRect: () => ({ left: anchorLeft }), closest: () => ({ getBoundingClientRect: () => ({ left: cardLeft, right: cardRight }) }) };
    const Filter = load('components/PropertyFilter.tsx', {
      react: { useState: initial => [stateCount++ === 0 ? true : initial, value => { if (typeof value === 'object') style = value; }], useRef: () => ({ current: trigger }), useEffect: fn => effects.push(fn) },
      'lucide-react': icons, 'framer-motion': { motion: { div: 'div' }, AnimatePresence: 'div' },
    }, { window: { getComputedStyle: () => ({ paddingLeft: "20px", paddingRight: "20px" }), innerWidth: viewport, addEventListener() {}, removeEventListener() {} }, document: { addEventListener() {}, removeEventListener() {} } }).default;
    Filter({ properties: [{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }], onChange() {} });
    effects.forEach(fn => fn());
    assert.ok(style, 'menu has a measured position');
    assert.ok(anchorLeft + style.left >= cardLeft + 28);
    assert.ok(anchorLeft + style.left + style.width <= Math.min(cardRight - 28, viewport - 8));
  }
});
