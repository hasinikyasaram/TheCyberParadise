'use strict';
const http = require('node:http'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NEXT = { created: ['assigned', 'cancelled'], assigned: ['picked_up', 'assigned', 'cancelled'], picked_up: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'failed'], failed: ['assigned', 'cancelled'], delivered: [], cancelled: [] };
const ADMIN_PERMS = { ops: ['orders', 'support'], support: ['support'], auditor: ['audit'] };
const LIMITS = { otp_request: [5, 600e3], login: [10, 600e3], lookup: [120, 60e3], support: [20, 60e3], delivery: [30, 60e3] };

function hash(secret, v) { return crypto.createHmac('sha256', secret).update(String(v)).digest('hex'); }
function pw(p, salt = crypto.randomBytes(16).toString('hex')) { return salt + ':' + crypto.scryptSync(p, salt, 32).toString('hex'); }
function pwOk(p, stored) { const [s, h] = stored.split(':'); const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(p, s, 32); return a.length === b.length && crypto.timingSafeEqual(a, b); }

function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE users(id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN('customer','partner','admin')), name TEXT, phone TEXT UNIQUE, email TEXT UNIQUE,
    login_id TEXT, pw TEXT, admin_role TEXT);
  CREATE TABLE orders(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id), partner_id TEXT REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'created', recipient_name TEXT NOT NULL, address TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, delivered_at TEXT);
  CREATE TRIGGER order_transition BEFORE UPDATE OF status ON orders WHEN OLD.status<>NEW.status OR NEW.status='assigned' BEGIN
    SELECT RAISE(ABORT,'invalid transition') WHERE NOT (
      (OLD.status='created' AND NEW.status IN('assigned','cancelled')) OR (OLD.status='assigned' AND NEW.status IN('picked_up','assigned','cancelled')) OR
      (OLD.status='picked_up' AND NEW.status IN('out_for_delivery','cancelled')) OR (OLD.status='out_for_delivery' AND NEW.status IN('delivered','failed')) OR
      (OLD.status='failed' AND NEW.status IN('assigned','cancelled'))); END;
  CREATE TABLE otps(phone TEXT PRIMARY KEY, h TEXT, expires INTEGER, attempts INTEGER DEFAULT 0, used INTEGER DEFAULT 0);
  CREATE TABLE delivery_codes(order_id TEXT PRIMARY KEY REFERENCES orders(id), h TEXT, expires INTEGER, attempts INTEGER DEFAULT 0, used INTEGER DEFAULT 0);
  CREATE TABLE messages(id TEXT PRIMARY KEY, order_id TEXT REFERENCES orders(id), sender_id TEXT, body TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE notifications(id TEXT PRIMARY KEY, user_id TEXT, body TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, action TEXT, target TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP);`);
  return db;
}

function createApp({ db = openDb(), secret = process.env.APP_SECRET || crypto.randomBytes(32).toString('hex'), production = process.env.NODE_ENV === 'production' } = {}) {
  const sessions = new Map(), hits = new Map(), outbox = [];
  const audit = (actor, action, target) => db.prepare('INSERT INTO audit(actor_id,action,target) VALUES(?,?,?)').run(actor, action, target ?? null);
  const notify = (uid, body) => db.prepare('INSERT INTO notifications(id,user_id,body) VALUES(?,?,?)').run(crypto.randomUUID(), uid, body);
  const limited = (kind, key) => { const [max, win] = LIMITS[kind], k = kind + key, now = Date.now(), a = (hits.get(k) || []).filter(t => now - t < win);
    a.push(now); hits.set(k, a); return a.length > max; };
  class HttpErr extends Error { constructor(s, m) { super(m); this.s = s; } }
  const NOTFOUND = () => new HttpErr(404, 'Order not found');

  function orderFor(u, id) {
    if (!UUID.test(id || '')) throw NOTFOUND();
    const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if (!o) throw NOTFOUND();
    if (u.role === 'customer' && o.customer_id === u.id) return o;
    if (u.role === 'partner' && o.partner_id === u.id && ['assigned', 'picked_up', 'out_for_delivery'].includes(o.status)) return o;
    if (u.role === 'admin') return o;
    throw NOTFOUND();
  }
  const view = (u, o) => u.role === 'partner' ? { id: o.id, status: o.status, recipient_name: o.recipient_name.split(' ')[0], address: o.address }
    : u.role === 'customer' ? { id: o.id, status: o.status, created_at: o.created_at, delivered_at: o.delivered_at, partner_assigned: !!o.partner_id }
    : { ...o };
  const need = (u, role, perm) => { if (!u || u.role !== role) throw new HttpErr(403, 'Forbidden'); if (perm && !ADMIN_PERMS[u.admin_role]?.includes(perm)) throw new HttpErr(403, 'Forbidden'); };
  const session = u => { const t = crypto.randomBytes(32).toString('hex'); sessions.set(hash(secret, t), { id: u.id, role: u.role, admin_role: u.admin_role, exp: Date.now() + 8 * 3600e3 }); return t; };
  const str = (v, max, min = 1) => { if (typeof v !== 'string' || v.length < min || v.length > max) throw new HttpErr(400, 'Invalid input'); return v; };

  const routes = [];
  const R = (m, re, fn) => routes.push([m, new RegExp('^' + re + '$'), fn]);

  R('POST', '/api/auth/otp/request', ({ b, ip }) => {
    const phone = str(b.phone, 14, 10); if (!/^\+?[0-9]{10,13}$/.test(phone)) throw new HttpErr(400, 'Invalid input');
    if (limited('otp_request', ip + phone)) throw new HttpErr(429, 'Too many requests');
    if (db.prepare("SELECT 1 FROM users WHERE phone=? AND role='customer'").get(phone)) {
      const code = String(crypto.randomInt(100000, 1000000));
      db.prepare('INSERT OR REPLACE INTO otps VALUES(?,?,?,0,0)').run(phone, hash(secret, code), Date.now() + 300e3);
      if (!production) outbox.push({ kind: 'login_otp', phone, code });
    }
    return { ok: true };
  });
  R('POST', '/api/auth/otp/verify', ({ b, ip }) => {
    const phone = str(b.phone, 14, 10), code = str(b.code, 6, 6);
    if (limited('login', ip + phone)) throw new HttpErr(429, 'Too many requests');
    const r = db.prepare('SELECT * FROM otps WHERE phone=?').get(phone), bad = new HttpErr(401, 'Invalid or expired code');
    if (!r || r.used || r.attempts >= 5 || Date.now() > r.expires) throw bad;
    db.prepare('UPDATE otps SET attempts=attempts+1 WHERE phone=?').run(phone);
    if (hash(secret, code) !== r.h) throw bad;
    db.prepare('UPDATE otps SET used=1 WHERE phone=?').run(phone);
    const u = db.prepare("SELECT * FROM users WHERE phone=? AND role='customer'").get(phone);
    audit(u.id, 'login', 'customer'); return { token: session(u), role: 'customer' };
  });
  const pwLogin = (role, find, label) => ({ b, ip }) => {
    if (limited('login', ip + label)) throw new HttpErr(429, 'Too many requests');
    const u = find(b), dummy = pw('x');
    const ok = pwOk(str(b.password, 128), u ? u.pw : dummy);
    if (!u || !ok) throw new HttpErr(401, 'Invalid credentials');
    audit(u.id, 'login', role); return { token: session(u), role };
  };
  R('POST', '/api/auth/partner', pwLogin('partner', b => db.prepare("SELECT * FROM users WHERE role='partner' AND login_id=?").get(str(b.username, 40)), 'p'));
  R('POST', '/api/auth/admin', pwLogin('admin', b => db.prepare("SELECT * FROM users WHERE role='admin' AND email=? AND login_id=?").get(str(b.email, 120), str(b.adminId, 40)), 'a'));

  R('GET', '/api/orders', ({ u, ip }) => {
    if (limited('lookup', u.id)) throw new HttpErr(429, 'Too many requests');
    const rows = u.role === 'customer' ? db.prepare('SELECT * FROM orders WHERE customer_id=? ORDER BY created_at DESC').all(u.id)
      : u.role === 'partner' ? db.prepare("SELECT * FROM orders WHERE partner_id=? AND status IN('assigned','picked_up','out_for_delivery')").all(u.id)
      : (need(u, 'admin', 'orders'), db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all());
    return rows.map(o => view(u, o));
  });
  R('GET', '/api/orders/([^/]+)', ({ u, m }) => {
    if (limited('lookup', u.id)) throw new HttpErr(429, 'Too many requests');
    const o = orderFor(u, m[1]); if (u.role === 'admin') audit(u.id, 'view_order', o.id); return view(u, o);
  });
  R('GET', '/api/history', ({ u }) => {
    if (u.role === 'partner') return db.prepare("SELECT id,status,delivered_at FROM orders WHERE partner_id=? AND status IN('delivered','failed')").all(u.id);
    if (u.role === 'customer') return db.prepare("SELECT id,status,created_at,delivered_at FROM orders WHERE customer_id=? AND status IN('delivered','cancelled')").all(u.id);
    throw new HttpErr(403, 'Forbidden');
  });
  R('POST', '/api/orders', ({ u, b }) => {
    need(u, 'admin', 'orders'); if (!UUID.test(b.customerId || '') || !db.prepare("SELECT 1 FROM users WHERE id=? AND role='customer'").get(b.customerId)) throw new HttpErr(400, 'Invalid input');
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO orders(id,customer_id,recipient_name,address) VALUES(?,?,?,?)').run(id, b.customerId, str(b.recipientName, 80), str(b.address, 200));
    audit(u.id, 'create_order', id); notify(b.customerId, 'Your order was created.'); return { id };
  });
  R('POST', '/api/orders/([^/]+)/assign', ({ u, b, m }) => {
    need(u, 'admin', 'orders'); const o = orderFor(u, m[1]);
    if (!UUID.test(b.partnerId || '') || !db.prepare("SELECT 1 FROM users WHERE id=? AND role='partner'").get(b.partnerId)) throw new HttpErr(400, 'Invalid input');
    if (!['created', 'assigned', 'failed'].includes(o.status)) throw new HttpErr(409, 'Invalid status transition');
    try { db.prepare("UPDATE orders SET partner_id=?, status='assigned' WHERE id=?").run(b.partnerId, o.id); } catch { throw new HttpErr(409, 'Invalid status transition'); }
    audit(u.id, o.partner_id ? 'reassign' : 'assign', o.id); notify(o.customer_id, 'A delivery partner was assigned to your order.'); return { ok: true };
  });
  R('POST', '/api/orders/([^/]+)/status', ({ u, b, m }) => {
    if (limited('delivery', u.id)) throw new HttpErr(429, 'Too many requests');
    const next = str(b.status, 20); if (!(next in NEXT)) throw new HttpErr(400, 'Invalid input');
    if (u.role === 'admin') need(u, 'admin', 'orders'); else if (u.role !== 'partner') throw new HttpErr(403, 'Forbidden');
    const o = orderFor(u, m[1]);
    const allowed = u.role === 'admin' ? ['cancelled'] : ['picked_up', 'out_for_delivery', 'delivered', 'failed'];
    if (!allowed.includes(next) || !NEXT[o.status].includes(next)) throw new HttpErr(409, 'Invalid status transition');
    if (next === 'delivered') {
      const c = db.prepare('SELECT * FROM delivery_codes WHERE order_id=?').get(o.id), bad = new HttpErr(400, 'Invalid or expired delivery code');
      if (!c || c.used || c.attempts >= 5 || Date.now() > c.expires) throw bad;
      db.prepare('UPDATE delivery_codes SET attempts=attempts+1 WHERE order_id=?').run(o.id);
      if (hash(secret, str(b.code, 6, 6)) !== c.h) throw bad;
      db.prepare('UPDATE delivery_codes SET used=1 WHERE order_id=?').run(o.id);
    }
    try { db.prepare("UPDATE orders SET status=?, delivered_at=CASE WHEN ?='delivered' THEN CURRENT_TIMESTAMP END WHERE id=?").run(next, next, o.id); }
    catch { throw new HttpErr(409, 'Invalid status transition'); }
    if (next === 'out_for_delivery') {
      const code = String(crypto.randomInt(100000, 1000000));
      db.prepare('INSERT OR REPLACE INTO delivery_codes VALUES(?,?,?,0,0)').run(o.id, hash(secret, code), Date.now() + 24 * 3600e3);
      notify(o.customer_id, 'Your order is out for delivery. Delivery code: ' + code);
      if (!production) outbox.push({ kind: 'delivery_code', orderId: o.id, code });
    } else notify(o.customer_id, 'Your order status changed to ' + next.replace(/_/g, ' ') + '.');
    audit(u.id, 'status:' + next, o.id); return { ok: true };
  });
  const chatAccess = (u, id) => { if (u.role === 'partner') throw new HttpErr(403, 'Forbidden'); if (u.role === 'admin') need(u, 'admin', 'support'); return orderFor(u, id); };
  R('GET', '/api/orders/([^/]+)/messages', ({ u, m }) => { const o = chatAccess(u, m[1]); return db.prepare('SELECT sender_id,body,at FROM messages WHERE order_id=? ORDER BY at').all(o.id); });
  R('POST', '/api/orders/([^/]+)/messages', ({ u, b, m }) => {
    if (limited('support', u.id)) throw new HttpErr(429, 'Too many requests');
    const o = chatAccess(u, m[1]); db.prepare('INSERT INTO messages(id,order_id,sender_id,body) VALUES(?,?,?,?)').run(crypto.randomUUID(), o.id, u.id, str(b.body, 500));
    if (u.role === 'admin') notify(o.customer_id, 'You have a new support reply.'); return { ok: true };
  });
  R('GET', '/api/notifications', ({ u }) => db.prepare('SELECT body,at FROM notifications WHERE user_id=? ORDER BY at DESC LIMIT 50').all(u.id));
  R('GET', '/api/audit', ({ u }) => { need(u, 'admin', 'audit'); return db.prepare('SELECT actor_id,action,target,at FROM audit ORDER BY id DESC LIMIT 200').all(); });
  R('GET', '/api/admin/summary', ({ u }) => { need(u, 'admin', 'orders'); return db.prepare(
    "SELECT SUM(status='delivered') AS delivered, SUM(status='failed') AS failed, SUM(status='cancelled') AS cancelled FROM orders WHERE date(COALESCE(delivered_at,created_at))=date('now')").get(); });

  const PUBLIC = new Set(['/api/auth/otp/request', '/api/auth/otp/verify', '/api/auth/partner', '/api/auth/admin']);
  const server = http.createServer((req, res) => {
    const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
    const url = new URL(req.url, 'http://x'), ip = req.socket.remoteAddress;
    if (!url.pathname.startsWith('/api/')) {
      const f = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['index.html', 'app.js', 'style.css'].includes(f)) return send(404, { error: 'Not found' });
      res.writeHead(200, { 'content-type': { html: 'text/html', js: 'text/javascript', css: 'text/css' }[f.split('.')[1]], 'content-security-policy': "default-src 'self'", 'x-content-type-options': 'nosniff' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', f)));
    }
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 16384) { send(413, { error: 'Request too large' }); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (res.writableEnded) return;
      try {
        let b = {}; if (chunks.length) { try { b = JSON.parse(Buffer.concat(chunks)); } catch { throw new HttpErr(400, 'Invalid input'); } if (!b || typeof b !== 'object' || Array.isArray(b)) throw new HttpErr(400, 'Invalid input'); }
        let u = null;
        if (!PUBLIC.has(url.pathname)) {
          const t = (req.headers.authorization || '').replace(/^Bearer /, ''), s = sessions.get(hash(secret, t));
          if (!s || s.exp < Date.now()) throw new HttpErr(401, 'Authentication required'); u = s;
        }
        for (const [m, re, fn] of routes) { const mm = re.exec(url.pathname); if (m === req.method && mm) return send(200, fn({ u, b, ip, m: mm })); }
        throw new HttpErr(404, 'Not found');
      } catch (e) { if (!(e instanceof HttpErr)) console.error('internal error'); send(e.s || 500, { error: e.s ? e.message : 'Internal error' }); }
    });
  });
  return { server, db, outbox, sessions, hits };
}

function seedDemo(db) {
  const ins = db.prepare('INSERT INTO users(id,role,name,phone,email,login_id,pw,admin_role) VALUES(?,?,?,?,?,?,?,?)'), id = () => crypto.randomUUID(), ids = {};
  for (const [k, role, name, phone, email, login, pass, ar] of [['c1', 'customer', 'Asha Demo', '+910000000001'], ['c2', 'customer', 'Ravi Demo', '+910000000002'],
    ['p1', 'partner', 'Partner One', null, null, 'partner1', 'demo-partner-pass'], ['p2', 'partner', 'Partner Two', null, null, 'partner2', 'demo-partner-pass'],
    ['a1', 'admin', 'Ops Admin', null, 'ops@example.test', 'ADM001', 'demo-admin-pass', 'ops'], ['a2', 'admin', 'Auditor', null, 'audit@example.test', 'ADM002', 'demo-admin-pass', 'auditor']])
    { ids[k] = id(); ins.run(ids[k], role, name, phone ?? null, email ?? null, login ?? null, pass ? pw(pass) : null, ar ?? null); }
  return ids;
}
module.exports = { createApp, openDb, seedDemo };
if (require.main === module) { const { server, db } = createApp(); seedDemo(db); server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('ShipTrack Sentinel demo on port ' + (process.env.PORT || 3000))); }
