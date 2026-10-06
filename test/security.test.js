import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { openDb } from '../src/db.js';
import { createApp, hashPw } from '../src/server.js';

const PA = '+919100000001', PB = '+919100000002', PW = 'synthetic-pass-123';
let db, srv, base, outbox, T = {};
const code = () => /(\d{6})/.exec(outbox.at(-1).msg)[1];
async function start(limits) {
  const d = openDb(); outbox = [];
  const app = createApp({ db: d, secret: 'test-secret-0123456789abcdef', limits, send: async (to, msg) => outbox.push({ to, msg }) });
  const s = await new Promise(r => { const x = app.listen(0, () => r(x)); });
  return { d, s, b: `http://127.0.0.1:${s.address().port}` };
}
const call = async (m, p, body, tok, b = base) => {
  const r = await fetch(b + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
async function custLogin(phone) { await call('POST', '/api/auth/otp/request', { phone }); return (await call('POST', '/api/auth/otp/verify', { phone, code: code() })).j.token; }
const partnerLogin = async e => (await call('POST', '/api/auth/partner/login', { email: e, password: PW })).j.token;
const adminLogin = async (e, c) => (await call('POST', '/api/auth/admin/login', { email: e, admin_id: c, password: PW })).j.token;

before(async () => {
  ({ d: db, s: srv, b: base } = await start({ otpReq: 1e4, otpVerify: 1e4, login: 1e4, lookup: 1e4, support: 1e4, delivery: 1e4 }));
  const id = () => crypto.randomUUID();
  T.p1 = id(); T.p2 = id();
  db.prepare('INSERT INTO partners VALUES(?,?,?,?)').run(T.p1, 'p1@example.test', hashPw(PW), 'P One');
  db.prepare('INSERT INTO partners VALUES(?,?,?,?)').run(T.p2, 'p2@example.test', hashPw(PW), 'P Two');
  db.prepare('INSERT INTO admins VALUES(?,?,?,?,?)').run(id(), 'full@example.test', 'ADM-1', hashPw(PW), 'orders,support,audit');
  db.prepare('INSERT INTO admins VALUES(?,?,?,?,?)').run(id(), 'help@example.test', 'ADM-2', hashPw(PW), 'support');
  T.admin = await adminLogin('full@example.test', 'ADM-1'); T.help = await adminLogin('help@example.test', 'ADM-2');
  const mk = async (ph, n) => (await call('POST', '/api/admin/orders', { customer_phone: ph, recipient_name: n, address: '12 Test Lane, Sampletown', item: 'Synthetic parcel' }, T.admin)).j.id;
  T.oA = await mk(PA, 'Asha Rao'); T.oB = await mk(PB, 'Bala Iyer');
  T.cA = await custLogin(PA); T.cB = await custLogin(PB);
  T.pt1 = await partnerLogin('p1@example.test'); T.pt2 = await partnerLogin('p2@example.test');
});
after(() => srv.close());

test('Customer A cannot read or write Customer B order, support chat is isolated', async () => {
  assert.equal((await call('GET', '/api/orders/' + T.oB, null, T.cA)).s, 404);
  assert.equal((await call('GET', `/api/orders/${T.oB}/support`, null, T.cA)).s, 404);
  assert.equal((await call('POST', `/api/orders/${T.oB}/support`, { body: 'hi' }, T.cA)).s, 404);
  const list = (await call('GET', '/api/orders', null, T.cA)).j;
  assert.deepEqual(list.map(o => o.id), [T.oA]);
  assert.equal((await call('POST', `/api/orders/${T.oA}/support`, { body: 'Where is it?' }, T.cA)).s, 201);
  assert.equal((await call('GET', `/api/orders/${T.oA}/support`, null, T.cB)).s, 404);
});
test('Order enumeration: missing, foreign and malformed ids look identical', async () => {
  const a = await call('GET', '/api/orders/' + crypto.randomUUID(), null, T.cA);
  const b = await call('GET', '/api/orders/' + T.oB, null, T.cA);
  const c = await call('GET', '/api/orders/1', null, T.cA);
  assert.deepEqual([a.s, b.s, c.s], [404, 404, 404]); assert.deepEqual(a.j, b.j); assert.deepEqual(b.j, c.j);
});
test('Role separation: customer and partner cannot use admin functions, unauthenticated rejected', async () => {
  for (const [m, p, b] of [['GET', '/api/admin/orders'], ['GET', '/api/admin/audit'], ['POST', '/api/admin/orders', {}], ['POST', `/api/admin/orders/${T.oA}/assign`, { partner_id: T.p1 }], ['POST', `/api/admin/orders/${T.oA}/cancel`]]) {
    assert.equal((await call(m, p, b, T.cA)).s, 403, p); assert.equal((await call(m, p, b, T.pt1)).s, 403, p); assert.equal((await call(m, p, b)).s, 401, p);
  }
  assert.equal((await call('GET', '/api/partner/orders', null, T.cA)).s, 403);
  assert.equal((await call('GET', '/api/orders', null, T.admin)).s, 403);
});
test('Admin least privilege: support-only admin cannot assign, list orders or read audit', async () => {
  assert.equal((await call('GET', '/api/admin/audit', null, T.help)).s, 403);
  assert.equal((await call('GET', '/api/admin/orders', null, T.help)).s, 403);
  assert.equal((await call('POST', `/api/admin/orders/${T.oA}/assign`, { partner_id: T.p1 }, T.help)).s, 403);
  assert.equal((await call('GET', '/api/admin/support', null, T.help)).s, 200);
  assert.equal((await call('GET', '/api/admin/audit', null, T.admin)).s, 200);
});
test('Admin login needs matching email, admin ID and password', async () => {
  assert.equal((await call('POST', '/api/auth/admin/login', { email: 'full@example.test', admin_id: 'WRONG', password: PW })).s, 401);
  assert.equal((await call('POST', '/api/auth/admin/login', { email: 'full@example.test', admin_id: 'ADM-1', password: 'bad' })).s, 401);
  assert.equal((await call('POST', '/api/auth/admin/login', { email: 'nobody@example.test', admin_id: 'ADM-1', password: PW })).s, 401);
});
test('Partner: unassigned order is not accessible', async () => {
  assert.equal((await call('GET', '/api/partner/orders/' + T.oA, null, T.pt1)).s, 404);
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/status`, { status: 'picked_up' }, T.pt1)).s, 404);
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/deliver`, { code: '123456' }, T.pt1)).s, 404);
});
test('Invalid and skipped status transitions are rejected by API and by database', async () => {
  await call('POST', `/api/admin/orders/${T.oA}/assign`, { partner_id: T.p1 }, T.admin);
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/status`, { status: 'out_for_delivery' }, T.pt1)).s, 409); // skips picked_up
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/status`, { status: 'delivered' }, T.pt1)).s, 400); // needs code
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/status`, { status: 'hacked' }, T.pt1)).s, 400);
  assert.throws(() => db.prepare("UPDATE orders SET status='delivered' WHERE id=?").run(T.oA), /invalid transition/); // direct DB write
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(T.oA).status, 'assigned');
});
test('Address hidden until pickup, phone never exposed, delivery code flow, replay, and revocation after delivery', async () => {
  let v = (await call('GET', '/api/partner/orders/' + T.oA, null, T.pt1)).j;
  assert.equal(v.address, undefined);
  await call('POST', `/api/partner/orders/${T.oA}/status`, { status: 'picked_up' }, T.pt1);
  v = (await call('GET', '/api/partner/orders/' + T.oA, null, T.pt1)).j;
  assert.ok(v.address); assert.ok(!JSON.stringify(v).includes(PA)); assert.equal(v.recipient_first_name, 'Asha');
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/deliver`, { code: '000000' }, T.pt1)).s, 404); // not out for delivery yet
  await call('POST', `/api/partner/orders/${T.oA}/status`, { status: 'out_for_delivery' }, T.pt1);
  const dc = code(); // delivery code SMS to customer, distinct from login OTP
  assert.equal(outbox.at(-1).to, PA); assert.match(outbox.at(-1).msg, /delivery code/);
  const wrong = dc === '111111' ? '222222' : '111111';
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/deliver`, { code: wrong }, T.pt1)).s, 400);
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/deliver`, { code: dc }, T.pt2)).s, 404); // other partner
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/deliver`, { code: dc }, T.pt1)).s, 200);
  assert.equal((await call('POST', `/api/partner/orders/${T.oA}/deliver`, { code: dc }, T.pt1)).s, 404); // replay
  assert.equal((await call('GET', '/api/partner/orders/' + T.oA, null, T.pt1)).s, 404); // old address revoked
  const hist = (await call('GET', '/api/partner/history', null, T.pt1)).j;
  assert.equal(hist.length, 1); assert.deepEqual(Object.keys(hist[0]).sort(), ['completed_at', 'id', 'status']);
  assert.ok(!JSON.stringify(hist).match(/Asha|Test Lane|\+91/));
  const notes = (await call('GET', '/api/notifications', null, T.cA)).j.map(n => n.text).join(' ');
  assert.ok(!/\d{6}/.test(notes) && !notes.includes('Test Lane') && !notes.includes(PA)); // no code or PII in notifications
});
test('Reassignment revokes the previous partner', async () => {
  await call('POST', `/api/admin/orders/${T.oB}/assign`, { partner_id: T.p1 }, T.admin);
  assert.equal((await call('GET', '/api/partner/orders/' + T.oB, null, T.pt1)).s, 200);
  await call('POST', `/api/admin/orders/${T.oB}/assign`, { partner_id: T.p2 }, T.admin);
  assert.equal((await call('GET', '/api/partner/orders/' + T.oB, null, T.pt1)).s, 404);
  assert.equal((await call('GET', '/api/partner/orders/' + T.oB, null, T.pt2)).s, 200);
  await call('POST', `/api/admin/orders/${T.oB}/cancel`, null, T.admin);
  assert.equal((await call('GET', '/api/partner/orders/' + T.oB, null, T.pt2)).s, 404);
  assert.equal((await call('POST', `/api/admin/orders/${T.oB}/assign`, { partner_id: T.p1 }, T.admin)).s, 409); // cancelled is final
});
test('SQL injection strings and malformed input are inert', async () => {
  const sqli = ["' OR '1'='1", "1; DROP TABLE orders;--", "\" OR 1=1 --"];
  for (const s of sqli) {
    assert.equal((await call('GET', '/api/orders/' + encodeURIComponent(s), null, T.cA)).s, 404);
    assert.equal((await call('POST', '/api/auth/otp/request', { phone: s })).s, 400);
    assert.equal((await call('POST', '/api/auth/partner/login', { email: s, password: s })).s, 401);
    assert.equal((await call('POST', '/api/auth/admin/login', { email: s, admin_id: s, password: s })).s, 401);
    assert.equal((await call('POST', `/api/orders/${T.oA}/support`, { body: s }, T.cA)).s, 201); // stored as plain text
  }
  const o = (await call('POST', '/api/admin/orders', { customer_phone: PA, recipient_name: "Robert'); DROP TABLE orders;--", address: '1 Test Rd, X', item: 'x' }, T.admin));
  assert.equal(o.s, 201);
  assert.ok(db.prepare('SELECT COUNT(*) c FROM orders').get().c >= 3);
  for (const bad of [{}, { customer_phone: 5 }, { customer_phone: PA, recipient_name: {}, address: [], item: null }, '[]'])
    assert.equal((await call('POST', '/api/admin/orders', bad, T.admin)).s, 400);
  assert.equal((await call('POST', `/api/orders/${T.oA}/support`, { body: 'x'.repeat(5000) }, T.cA)).s, 400);
  const big = await fetch(base + '/api/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: 'x'.repeat(50000) }) });
  assert.equal(big.status, 413);
  const mal = await fetch(base + '/api/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
  assert.equal(mal.status, 400);
});
test('OTP: expiry, replay, attempt limit, unknown phone gives same response', async () => {
  await call('POST', '/api/auth/otp/request', { phone: PA }); const c1 = code();
  assert.equal((await call('POST', '/api/auth/otp/verify', { phone: PA, code: c1 })).s, 200);
  assert.equal((await call('POST', '/api/auth/otp/verify', { phone: PA, code: c1 })).s, 401); // replay
  await call('POST', '/api/auth/otp/request', { phone: PA }); const c2 = code();
  db.prepare('UPDATE otps SET expires_at=1 WHERE phone=?').run(PA);
  assert.equal((await call('POST', '/api/auth/otp/verify', { phone: PA, code: c2 })).s, 401); // expired
  await call('POST', '/api/auth/otp/request', { phone: PA }); const c3 = code(); const w = c3 === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/auth/otp/verify', { phone: PA, code: w })).s, 401);
  assert.equal((await call('POST', '/api/auth/otp/verify', { phone: PA, code: c3 })).s, 401); // locked after 5 failures
  const n = outbox.length; const u = await call('POST', '/api/auth/otp/request', { phone: '+919199999999' });
  assert.equal(u.s, 202); assert.equal(outbox.length, n);
  assert.ok(!db.prepare('SELECT group_concat(action) a FROM audit_events').get().a?.includes(c3));
});
test('Audit log records sensitive actions and is append only', async () => {
  const acts = (await call('GET', '/api/admin/audit', null, T.admin)).j.map(e => e.action);
  for (const a of ['assign', 'reassign', 'cancel', 'view_address', 'status:delivered', 'create_order']) assert.ok(acts.includes(a), a);
  assert.throws(() => db.prepare('DELETE FROM audit_events').run(), /append only/);
  assert.throws(() => db.prepare("UPDATE audit_events SET action='x'").run(), /append only/);
});
test('Rate limits: OTP request, OTP verify, login, lookup, support, delivery return 429', async () => {
  const { s, b } = await start({ otpReq: 2, otpVerify: 2, login: 2, lookup: 3, support: 2, delivery: 2 });
  const pick = async (path, body, tok) => { const r = []; for (let i = 0; i < 4; i++) r.push((await call('POST', path, body, tok, b)).s); return r; };
  assert.ok((await pick('/api/auth/otp/request', { phone: PA })).includes(429));
  assert.ok((await pick('/api/auth/otp/verify', { phone: PA, code: '123456' })).includes(429));
  assert.ok((await pick('/api/auth/partner/login', { email: 'a@example.test', password: 'x' })).includes(429));
  assert.ok((await pick('/api/auth/admin/login', { email: 'a@example.test', admin_id: 'x', password: 'x' })).includes(429));
  const r = []; for (let i = 0; i < 5; i++) r.push((await call('GET', '/api/orders', null, 'x'.repeat(30), b)).s);
  assert.ok(r.includes(429));
  assert.ok((await pick(`/api/orders/${crypto.randomUUID()}/support`, { body: 'x' }, 'x'.repeat(30))).includes(429));
  assert.ok((await pick(`/api/partner/orders/${crypto.randomUUID()}/deliver`, { code: '123456' }, 'x'.repeat(30))).includes(429));
  s.close();
});
