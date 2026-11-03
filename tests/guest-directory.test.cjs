const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText, file);
const { NextRequest } = require('next/server');
const db = require('../lib/platform/db.ts');
const audit = require('../lib/services/auditLogService.ts');
const service = require('../lib/services/guestExperienceService.ts');
const messaging = require('../lib/services/guestMessaging.ts');
const directory = require('../app/api/guest-directory/route.ts');
const feedback = require('../app/api/feedback/route.ts');
const rows = [
 { id: 'stay-1', organization_id: 'org-1', property_id: 'prop-1', status: 'active', room_number: '101', check_in_date: '2026-11-03', check_out_date: '2026-11-06', public_token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', guests: { full_name: 'Alex' }, properties: { name: 'Hotel One', is_active: true }, feedback: [{ count: 0 }] },
 { id: 'stay-2', organization_id: 'org-1', property_id: 'prop-2', status: 'active', room_number: '202', public_token: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', guests: { full_name: 'Bea' }, properties: { name: 'Hotel Two', is_active: true }, feedback: [{ count: 1 }] },
 { id: 'stay-3', organization_id: 'org-2', property_id: 'prop-3', status: 'active', room_number: '301', public_token: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', guests: { full_name: 'Outside' }, properties: { name: 'Outside', is_active: true }, feedback: [{ count: 0 }] },
 { id: 'stay-4', organization_id: 'org-1', property_id: 'prop-1', status: 'checked_out', public_token: 'd' .repeat(64), guests: { full_name: 'Closed' }, properties: { is_active: true }, feedback: [{ count: 0 }] },
];
function client() {
 const calls = [];
 return { calls, async rpc(name, args) {
   calls.push({rpc:name,args});
   if (name !== 'feedback_collection_directory') return {data:'followup-job',error:null};
   const user = db.workspaceUser();
   const allowed = user.isOrganizationAdmin ? null : user.propertyIds;
   const values = rows.filter(row => row.organization_id === user.organizationId && (!allowed || allowed.includes(row.property_id)) && (args.p_status === 'all' || args.p_status === 'pending' && row.status === 'active' && !row.feedback[0].count || args.p_status === 'collected' && row.feedback[0].count));
   return {data:{success:true,guests:values.map(row=>({id:row.id,feedbackCount:row.feedback[0].count,guestName:user.isOrganizationAdmin || user.rights.includes('view_guest_pii') ? row.guests.full_name : 'Guest'})),canTakeFeedback:user.isOrganizationAdmin || user.rights.includes('view_guest_pii')},error:null};
 }, from(table) {
   const filters = []; calls.push({ table, filters });
   let values = table === 'stays' ? rows : table === 'properties' ? [{ id: 'prop-1', organization_id: 'org-1', name: 'Hotel One', is_active: true }, { id: 'prop-2', organization_id: 'org-1', is_active: true }] : [];
   const data = () => values.filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
   const q = {
     select(columns) { calls.at(-1).columns = columns; return q; },
     eq(key, value) { filters.push([key, value]); return q; },
     in(key, value) { filters.push([key, value]); return q; },
     order() { return q; }, or() { return q; }, is() { return q; },
     // Deliberately lower than the API page size to exercise complete pagination.
     async range(start) { return { data: data().slice(start, start + 1), error: null }; },
     async maybeSingle() { return { data: data()[0] || null, error: null }; },
     then(resolve) { resolve({ data: data(), error: null }); },
   }; return q;
 } };
}
const admin = { id: 'owner', organizationId: 'org-1', isOrganizationAdmin: true, fullName: 'Owner', email: 'owner@example.com', role: 'admin', rights: [] };
const staff = { ...admin, id: 'staff', isOrganizationAdmin: false, role: 'staff', propertyIds: ['prop-1'], rights: ['module:feedback', 'module_access:configured', 'view_feedback', 'view_guest_pii'] };
async function request(user, method = 'GET', body, params = '') {
 const mock = client(); const original = db.sessionDb; db.sessionDb = () => mock;
 try {
   const response = await db.workspaceContext.run({ user, client: mock }, () => directory[method](new NextRequest('http://localhost/api/guest-directory' + params, { method, ...(body ? { headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) } : {}) })));
   return { response, json: await response.json(), mock };
 } finally { db.sessionDb = original; }
}
test('Directory defaults to uncollected stays and uses scoped collection RPC without exposing tokens', async () => {
 const { response, json } = await request(admin);
 assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
 assert.deepEqual(json.guests.map(row => row.id), ['stay-1']);
 assert.deepEqual(json.guests.map(row => row.feedbackCount), [0]);
 assert.ok(!JSON.stringify(json).includes('secret')); assert.ok(!JSON.stringify(json).includes('Outside'));
});
test('Directory enforces module, property and guest-data boundaries', async () => {
 assert.equal((await request({ ...staff, rights: ['module:hospitality', 'module_access:configured', 'view_feedback'] })).response.status, 403);
 assert.equal((await request({ ...staff, rights: ['module:feedback'] })).response.status, 403);
 const scoped = await request(staff); assert.deepEqual(scoped.json.guests.map(row => row.id), ['stay-1']);
 const noPii = { ...staff, rights: staff.rights.filter(right => right !== 'view_guest_pii') };
 const redacted = await request(noPii); assert.equal(redacted.json.guests[0].guestName, 'Guest'); assert.equal(redacted.json.canTakeFeedback, false);
 assert.equal((await request(noPii, 'POST', { stayId: 'stay-1' })).response.status, 403);
 assert.deepEqual((await request({ ...staff, propertyIds: [], propertyId: null })).json.guests, []);
});
test('Take feedback resolves a current scoped stay on demand and audits without the token', async () => {
 const original = audit.logAuditEvent; const events = []; audit.logAuditEvent = async event => { events.push(event); };
 try {
   const opened = await request(staff, 'POST', { stayId: 'stay-1' });
   assert.equal(opened.response.status, 200); assert.equal(opened.json.path, '/feedback/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
   assert.equal(events[0].resource, 'stay-1'); assert.ok(!JSON.stringify(events).includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
   for (const stayId of ['stay-2', 'stay-3', 'stay-4', 'missing']) assert.equal((await request(staff, 'POST', { stayId })).response.status, 404);
   assert.equal(events.length, 1);
 } finally { audit.logAuditEvent = original; }
});
test('Public submission keeps canonical guest, room, property and stay identity; rejects wrong-property and closed tokens', async () => {
 const originals = [db.serviceDb, service.createFeedback, audit.logAuditEvent, messaging.queueGuestMessage];
 const saved = []; db.serviceDb = () => client(); service.createFeedback = async value => { saved.push(value); return { id: 'feedback-new', ...value }; }; audit.logAuditEvent = async () => {}; messaging.queueGuestMessage = async () => {};
 const submit = body => feedback.POST(new NextRequest('http://localhost/api/feedback', { method: 'POST', headers: {"Content-Type":"application/json"}, body: JSON.stringify({ rating: 5, department: 'Front Desk', answers: [], guestName: 'Forged name', roomNumber: '999', ...body }) }));
 try {
   assert.equal((await submit({ publicToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', propertyId: 'prop-1' })).status, 201);
   assert.equal(saved[0].stayId, 'stay-1'); assert.equal(saved[0].guestName, 'Alex'); assert.equal(saved[0].roomNumber, '101'); assert.equal(saved[0].propertyId, 'prop-1'); assert.equal(saved[0].organizationId, 'org-1');
   assert.equal((await submit({ publicToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', propertyId: 'prop-2' })).status, 403);
   assert.equal((await submit({ publicToken: 'd' .repeat(64), propertyId: 'prop-1' })).status, 404);
   assert.equal(saved.length, 1);
 } finally { [db.serviceDb, service.createFeedback, audit.logAuditEvent, messaging.queueGuestMessage] = originals; }
});

test('Directory validates dates and collection states before database access', async () => {
 for (const params of ['?day=2026-02-30', '?day=bad', '?day=2026-1-1', '?status=invalid']) {
  const result = await request(admin, 'GET', undefined, params);
  assert.equal(result.response.status, 400); assert.equal(result.mock.calls.length, 0);
 }
 const result = await request(admin, 'GET', undefined, '?day=2026-11-03&status=collected');
 assert.deepEqual(result.mock.calls[0], {rpc:'feedback_collection_directory',args:{p_day:'2026-11-03',p_status:'collected'}});
 assert.deepEqual(result.json.guests.map(row=>row.id), ['stay-2']);
});
