const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText, file);
const { NextRequest } = require('next/server');
const db = require('../lib/platform/db.ts');
const auth = require('../lib/auth/serverAuth.ts');
const { readJson, readFormData, errorResponse } = require('../lib/platform/http.ts');
const { isAllowedMutation } = require('../lib/security/requestPolicy.ts');
const { createPropertyFeedbackToken, resolvePublicFeedbackLink } = require('../lib/feedback/public-links.ts');
const { hashToken } = require('../lib/platform/secrets.ts');
const feedback = require('../app/api/feedback/route.ts');
const questions = require('../app/api/questions/route.ts');
const links = require('../app/api/feedback-links/route.ts');
const service = require('../lib/services/guestExperienceService.ts');
const audit = require('../lib/services/auditLogService.ts');
const messages = require('../lib/services/guestMessaging.ts');
const propA = '11111111-1111-4111-8111-111111111111', propB = '22222222-2222-4222-8222-222222222222';
const stayToken = 'a'.repeat(64), inviteToken = 'b'.repeat(64), expiredToken = 'c'.repeat(64);
const owner = { id: 'owner', organizationId: 'org-a', isOrganizationAdmin: true, rights: [], propertyIds: [propA], accessToken: 'valid' };
const staff = { ...owner, id: 'staff', isOrganizationAdmin: false, rights: ['module:feedback', 'manage_questionnaire'], propertyIds: [propA] };
function client() {
  const calls = [];
  const tables = {
    properties: [{ id: propA, name: 'Authorized hotel', code: 'A', organization_id: 'org-a', is_active: true }, { id: propB, name: 'Other tenant hotel', code: 'B', organization_id: 'org-b', is_active: true }],
    stays: [{ id: 'stay', public_token: stayToken, property_id: propA, organization_id: 'org-a', status: 'active', room_number: '101', guests: { full_name: 'Canonical guest' } }],
    guest_invitations: [{ id: 'invite', token_hash: hashToken(inviteToken), organization_id: 'org-a', property_id: propA, status: 'pending', expires_at: new Date(Date.now() + 60000).toISOString(), guest_name: 'Invited guest', room_number: '102' }, { id: 'expired', token_hash: hashToken(expiredToken), property_id: propA, status: 'pending', expires_at: 'invalid' }],
    feedback_questions: [{ id: 'q-a', organization_id: 'org-a', property_id: propA, is_active: true, question_type: 'text', question_text: 'A question', is_required: false }, { id: 'q-b', organization_id: 'org-b', property_id: propB, is_active: true, question_text: 'Private B question' }],
  };
  return { calls, tables, from(table) {
    calls.push(table); const filters = []; let inserted = null, upserted = false;
    const values = () => (tables[table] || []).filter(row => filters.every(([key, value]) => (row[key] ?? null) === value));
    const q = { upsert(value) { upserted=true; if (!(tables[table] || []).some(row=>row.token_hash===value.token_hash)) (tables[table] ||= []).push({id:'new-link',is_active:true,...value});return q; }, insert(value) { inserted = { id: 'new-link', is_active: true, ...value }; (tables[table] ||= []).push(inserted); return q; }, select() { return q; }, is(key, value) { filters.push([key, value]); return q; }, eq(key, value) { filters.push([key, value]); return q; }, or() { return q; }, order() { return q; },
      async maybeSingle() { return { data: values()[0] || null, error: null }; }, async single() { return { data: values()[0] || null, error: null }; },
      then(resolve) { resolve({ data: upserted ? null : values(), error: null }); } };
    return q;
  } };
}
function post(url, body, headers = {}) { return new NextRequest('http://localhost' + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); }

test('Property links are bound by authenticated encryption; metadata and questions disclose only their property', async () => {
  const mock = client(), original = db.serviceDb; db.serviceDb = () => mock;
  try {
    const token = createPropertyFeedbackToken({ propertyId: propA, room: '301', department: 'Front Desk', demo: false });
    assert.ok(!token.includes(propA));
    const resolved = await resolvePublicFeedbackLink(token);
    assert.equal(resolved.details.propertyId, propA); assert.equal(resolved.details.roomNumber, '301');
    assert.ok(!JSON.stringify(resolved.details).includes('Other tenant'));
    for (const invalid of [null, '', 'verified', propA, token + '.extra', token.slice(0, -1) + (token.endsWith('0') ? '1' : '0')]) await assert.rejects(resolvePublicFeedbackLink(invalid));
    const result = await questions.GET(new NextRequest('http://localhost/api/questions?public=true&token=' + encodeURIComponent(token) + '&propertyId=' + propB));
    assert.equal(result.status, 200); assert.deepEqual((await result.json()).questions.map(q => q.id), ['q-a']);
    assert.equal((await questions.GET(new NextRequest('http://localhost/api/questions?public=true&propertyId=' + propA))).status, 403);
    mock.tables.stays.push({...mock.tables.stays[0],public_token:propB});
    for (const legacy of [stayToken, inviteToken, propB]) assert.equal((await resolvePublicFeedbackLink(legacy)).property.id, propA);
    await assert.rejects(resolvePublicFeedbackLink(expiredToken), error => error.status === 410);
  } finally { db.serviceDb = original; }
});

test('Public submission rejects missing, forged, wrong-property and preview tokens before storage; canonical fields win', async () => {
  const originals = [db.serviceDb, service.createFeedback, audit.logAuditEvent, messages.queueGuestMessage];
  const saved = []; db.serviceDb = () => client(); service.createFeedback = async value => { saved.push(value); return { id: 'saved' }; }; audit.logAuditEvent = async () => {}; messages.queueGuestMessage = async () => {};
  const body = { propertyId: propA, rating: 5, department: 'Front Desk', guestName: 'Forged guest', roomNumber: '999', answers: [] };
  try {
    for (const publicToken of [undefined, 'verified', 'random', propA]) assert.ok((await feedback.POST(post('/api/feedback', { ...body, publicToken }))).status >= 400);
    assert.equal(saved.length, 0);
    assert.equal((await feedback.POST(post('/api/feedback', { ...body, publicToken: stayToken, propertyId: propB }))).status, 403);
    const preview = createPropertyFeedbackToken({ propertyId: propA, room: '', department: '', demo: true });
    assert.equal((await feedback.POST(post('/api/feedback', { ...body, publicToken: preview }))).status, 403);
    const response = await feedback.POST(post('/api/feedback', { ...body, publicToken: stayToken }));
    assert.equal(response.status, 201); assert.equal(saved[0].stayId, 'stay'); assert.equal(saved[0].guestName, 'Canonical guest'); assert.equal(saved[0].roomNumber, '101'); assert.equal(saved[0].organizationId, 'org-a');
    assert.deepEqual(await response.json(), { success: true, id: 'saved' });
    assert.equal((await feedback.POST(post('/api/feedback', { ...body, publicToken: inviteToken }))).status, 201);
    assert.equal(saved[1].invitationId, 'invite');
  } finally { [db.serviceDb, service.createFeedback, audit.logAuditEvent, messages.queueGuestMessage] = originals; }
});

test('Only authorized generators can mint property links, and staff cannot select another property', async () => {
  const mock = client(), original = db.sessionDb, originalService = db.serviceDb; db.sessionDb = () => mock; db.serviceDb = () => mock;
  const generate = (user, propertyId) => db.workspaceContext.run({ user, client: mock }, () => links.POST(post('/api/feedback-links', { propertyId })));
  try {
    assert.equal((await generate(staff, propA)).status, 200);
    assert.equal((await generate(staff, propB)).status, 403);
    assert.equal((await generate({ ...staff, rights: ['module:feedback'] }, propA)).status, 403);
    assert.equal((await generate({ ...staff, rights: ['manage_questionnaire', 'module:hospitality', 'module_access:configured'] }, propA)).status, 403);
  } finally { db.sessionDb = original; db.serviceDb = originalService; }
});

test('Every protected API method denies missing sessions and forged display cookies before storage', async () => {
  const originalSession = db.sessionDb, originalService = db.serviceDb;
  db.sessionDb = () => { throw new Error('Unauthenticated storage access'); }; db.serviceDb = db.sessionDb;
  const methods = [];
  function visit(folder) { for (const entry of fs.readdirSync(folder, { withFileTypes: true })) { const file = path.join(folder, entry.name); if (entry.isDirectory()) visit(file); else if (entry.name === 'route.ts') { const source = fs.readFileSync(file, 'utf8'); for (const match of source.matchAll(/export const (GET|POST|PATCH|DELETE)\s*=\s*withWorkspace/g)) methods.push([file, match[1]]); } } }
  visit(path.resolve(__dirname, '../app/api'));
  try {
    assert.ok(methods.length > 45, 'covers the protected API inventory');
    for (const [file, method] of methods) for (const cookie of ['', 'vistora-user=' + encodeURIComponent(JSON.stringify(owner))]) {
      const route = require(file);
      const request = new NextRequest('http://localhost/api/test', { method, headers: { cookie, 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: '{}' }) });
      const response = await route[method](request, { params: Promise.resolve({ id: propA }) });
      assert.equal(response.status, 401, path.relative(process.cwd(), file) + ':' + method);
    }
    const properties = require('../app/api/properties/route.ts');
    assert.equal((await properties.GET(new NextRequest('http://localhost/api/properties?public=true'))).status, 401);
    assert.equal((await questions.GET(new NextRequest('http://localhost/api/questions'))).status, 401);
  } finally { db.sessionDb = originalSession; db.serviceDb = originalService; }
});

test('Forged access tokens are verified by the identity provider; revoked membership is checked on every request', async () => {
  const originalSession = db.sessionDb, originalService = db.serviceDb;
  let active = true, checks = 0;
  db.sessionDb = () => ({ auth: { getUser: async token => token === 'verified-token' ? { data: { user: { id: 'user', email: 'user@example.test' } }, error: null } : { data: { user: null }, error: {} } }, from: () => ({ select: async () => ({ data: [{ id: propA }], error: null }) }) });
  db.serviceDb = () => ({ from: table => { const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { checks++; return { data: table === 'profiles' ? { id: 'user', organization_id: 'org-a', full_name: 'User', role: 'staff', rights: ['view_feedback'], property_id: propA } : active ? { organization_id: 'org-a', role: 'member' } : null, error: null }; } }; return q; } });
  try {
    assert.equal(await auth.getAuthenticatedUser(new NextRequest('http://localhost', { headers: { authorization: 'Bearer forged-token' } })), null);
    const request = () => new NextRequest('http://localhost', { headers: { authorization: 'Bearer verified-token' } });
    assert.ok(await auth.getAuthenticatedUser(request())); active = false; assert.equal(await auth.getAuthenticatedUser(request()), null); assert.equal(checks, 4);
  } finally { db.sessionDb = originalSession; db.serviceDb = originalService; }
});

test('Request policy rejects cross-origin, opaque and malformed browser mutations; bounded JSON rejects oversized and invalid bodies', async () => {
  for (const origin of ['https://evil.example', 'null', 'not a URL', 'https://localhost']) assert.equal(isAllowedMutation(post('/api/feedback', {}, { origin })), false);
  assert.equal(isAllowedMutation(post('/api/feedback', {}, { origin: 'http://localhost' })), true);
  assert.equal(isAllowedMutation(post('/api/feedback', {}, { 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(isAllowedMutation(post('/api/feedback', {})), true);
  await assert.rejects(readJson(new NextRequest('http://localhost', { method: 'POST', body: '{}' })), e => e.status === 415);
  for (const value of ['null', '[]', '"hello"', '{']) await assert.rejects(readJson(new NextRequest('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: value })), e => e.status === 400);
  await assert.rejects(readJson(post('/api/feedback', { text: 'a'.repeat(100) }), 30), e => e.status === 413);
  await assert.rejects(readFormData(new NextRequest('http://localhost', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=x' }, body: 'x'.repeat(100) }), 30), e => e.status === 413);
  const sanitized = await errorResponse(new Error('secret database exception')).json(); assert.ok(!sanitized.error.includes('secret'));
});

test('Public submissions and authentication attempts are limited even from loopback; invalid IP strings share a bounded identity', () => {
  const { checkRateLimit, getClientIp } = require('../lib/security/rateLimiter.ts');
  for (let i = 0; i < 15; i++) assert.ok(checkRateLimit('127.0.0.1', 'submission').success);
  assert.equal(checkRateLimit('127.0.0.1', 'submission').success, false);
  for (let i = 0; i < 5; i++) assert.ok(checkRateLimit('198.51.100.17', 'auth').success);
  assert.equal(checkRateLimit('198.51.100.17', 'auth').success, false);
  const original = process.env.TRUSTED_CLIENT_IP_HEADER;
  try {
    delete process.env.TRUSTED_CLIENT_IP_HEADER;
    assert.equal(getClientIp(new Headers({ 'x-forwarded-for': '198.51.100.18' })), 'unknown');
    process.env.TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';
    assert.equal(getClientIp(new Headers({ 'x-real-ip': '198.51.100.19', 'x-forwarded-for': '198.51.100.18' })), '198.51.100.19');
    assert.equal(getClientIp(new Headers({ 'x-real-ip': 'x'.repeat(5000) })), 'unknown');
  } finally { if (original === undefined) delete process.env.TRUSTED_CLIENT_IP_HEADER; else process.env.TRUSTED_CLIENT_IP_HEADER = original; }
});

test('Short property links retain tenant binding and load only the selected property questionnaire and design', async () => {
 const { createShortFeedbackLink }=require('../lib/feedback/public-links.ts');
 const mock=client(),original=db.serviceDb;db.serviceDb=()=>mock;
 const formA={id:'form-a',property_id:propA,organization_id:'org-a',name:'Dining',title:'How was your meal?',introduction:'Tell our restaurant team.',accent_color:'#334455',is_default:true};
 mock.tables.feedback_questionnaires=[formA,{...formA,id:'form-b',property_id:propB,organization_id:'org-b',title:'Other tenant form'}];
 mock.tables.feedback_questions.push({id:'custom-a',questionnaire_id:'form-a',property_id:propA,organization_id:'org-a',is_active:true,question_type:'text',question_text:'Was the meal good?',is_required:false});
 try{
  const token=await createShortFeedbackLink(mock,mock.tables.properties[0],{room:'Table 4',department:'Food & Beverage',demo:false});
  assert.match(token,/^a-table-4-[A-Za-z0-9_-]{22}$/);assert.ok(token.length<45);
  assert.equal(await createShortFeedbackLink(mock,mock.tables.properties[0],{room:'Table 4',department:'Food & Beverage',demo:false}),token);
  assert.equal(mock.tables.guest_feedback_links.length,1);
  const other=await createShortFeedbackLink(mock,mock.tables.properties[0],{room:'Table 5',department:'Food & Beverage',demo:false});assert.notEqual(other,token);
  assert.equal(mock.tables.guest_feedback_links[0].token_hash,hashToken(token));assert.ok(!JSON.stringify(mock.tables.guest_feedback_links).includes(token));
  const resolved=await resolvePublicFeedbackLink(token);
  assert.equal(resolved.property.id,propA);assert.equal(resolved.details.questionnaireTitle,formA.title);assert.equal(resolved.details.accentColor,formA.accent_color);
  const response=await questions.GET(new NextRequest('http://localhost/api/questions?public=true&token='+token));
  assert.deepEqual((await response.json()).questions.map(q=>q.id),['custom-a']);
  await assert.rejects(resolvePublicFeedbackLink('b-'+token.slice(2)),error=>error.status===404);
  mock.tables.guest_feedback_links[0].is_active=false;await assert.rejects(resolvePublicFeedbackLink(token),error=>error.status===404);
  await assert.rejects(createShortFeedbackLink(mock,mock.tables.properties[0],{room:'Table 4',department:'Food & Beverage',demo:false}),error=>error.status===410);
  assert.equal(mock.tables.guest_feedback_links[0].is_active,false);
  const legacy='a-'+'x'.repeat(24);mock.tables.guest_feedback_links.push({token_hash:hashToken(legacy),property_id:propA,organization_id:'org-a',is_active:true,room:'301',department:'Front Desk',demo:false});
  assert.equal((await resolvePublicFeedbackLink(legacy)).property.id,propA);
 }finally{db.serviceDb=original;}
});

test('Question edits validate type, options and translations without accepting property changes', () => {
 const {questionFields}=require('../lib/feedback/question-fields.ts');
 const fields=questionFields({questionText:' Edited question ',questionType:'choice',options:['Yes','No'],isRequired:true,translations:{th:{questionText:'Translated',options:['One','Two']}},propertyId:propB,questionnaireId:'evil'},true);
 assert.equal(fields.question_text,'Edited question');assert.equal(fields.question_type,'choice');assert.deepEqual(fields.options,['Yes','No']);assert.equal(fields.is_required,true);assert.equal(fields.translations.th.questionText,'Translated');
 assert.ok(!('property_id' in fields));assert.ok(!('questionnaire_id' in fields));
 assert.throws(()=>questionFields({questionType:'invalid'},true));assert.throws(()=>questionFields({options:[null]},true));assert.throws(()=>questionFields({translations:{th:{options:'invalid'}}},true));
 assert.equal(questionFields({questionText:'Text',questionType:'long_text',options:[]},false).question_type,'long_text');
});

test('Published links use the current live deployment, never a stale configured domain or localhost', () => {
 const {appOrigin}=require('../lib/platform/appOrigin.ts');
 const prior={APP_URL:process.env.APP_URL,NEXT_PUBLIC_APP_URL:process.env.NEXT_PUBLIC_APP_URL,NODE_ENV:process.env.NODE_ENV};
 try{
  process.env.NODE_ENV='production';process.env.APP_URL='http://localhost:3000';delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(appOrigin('https://vistora.example'),'https://vistora.example');
  process.env.APP_URL='https://guests.vistora.example/path';assert.equal(appOrigin('https://vistora.example'),'https://vistora.example');
  assert.equal(appOrigin('https://vistora-preview.vercel.app'),'https://vistora-preview.vercel.app');
  assert.equal(appOrigin('http://localhost:3000'),'https://guests.vistora.example');
  process.env.APP_URL='http://localhost:3000';assert.throws(()=>appOrigin('http://localhost:3000'));
  process.env.NODE_ENV='development';assert.equal(appOrigin('http://localhost:3000'),'http://localhost:3000');
 }finally{for(const [key,value]of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
