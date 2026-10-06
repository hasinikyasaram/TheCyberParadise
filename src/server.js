import express from 'express';
import crypto from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^\+[1-9]\d{9,14}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,200}$/;
const now = () => Date.now();
const iso = () => new Date().toISOString();
const hm = (k, v) => crypto.createHmac('sha256', k).update(String(v)).digest('hex');
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
export const hashPw = p => { const s = crypto.randomBytes(16); return s.toString('hex') + ':' + crypto.scryptSync(p, s, 32).toString('hex'); };
const checkPw = (p, st) => { const [s, h] = st.split(':'); return same(crypto.scryptSync(p, Buffer.from(s, 'hex'), 32).toString('hex'), h); };
const DUMMY = hashPw('dummy-password');
const txt = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const nf = res => res.status(404).json({ error: 'Not found' });

export function createApp({ db, send, secret, publicDir, limits = {} }) {
  if (!secret || secret.length < 16) throw new Error('APP_SECRET must be at least 16 characters');
  const L = { otpReq: 5, otpVerify: 10, login: 10, lookup: 120, support: 20, delivery: 30, ...limits };
  const app = express(); app.disable('x-powered-by'); app.set('trust proxy', false);
  app.use((req, res, next) => {
    res.set({ 'Content-Security-Policy': "default-src 'self'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' });
    next();
  });
  app.use(express.json({ limit: '10kb' }));
  const hits = new Map();
  const limit = (name, max, key) => (req, res, next) => {
    const k = name + ':' + (key ? key(req) : req.ip), t = now();
    const a = (hits.get(k) || []).filter(x => t - x < 60000);
    if (a.length >= max) return res.status(429).json({ error: 'Too many requests' });
    a.push(t); hits.set(k, a); next();
  };
  const byPhone = r => String(r.body?.phone ?? '').slice(0, 20);
  const byId = r => String(r.body?.email ?? '').toLowerCase().slice(0, 100);

  const session = (role, id, ttl) => {
    const tok = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hm(secret, tok), role, id, now() + ttl);
    return tok;
  };
  const auth = (role, perm) => (req, res, next) => {
    const m = /^Bearer ([\w-]{20,100})$/.exec(req.get('authorization') || '');
    const s = m && db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(hm(secret, m[1]), now());
    if (!s) return res.status(401).json({ error: 'Authentication required' });
    if (s.role !== role) return res.status(403).json({ error: 'Forbidden' });
    let perms = '';
    if (role === 'admin') { // permissions are re-read on every request so revocation is immediate
      const a = db.prepare('SELECT perms FROM admins WHERE id=?').get(s.subject_id);
      if (!a) return res.status(401).json({ error: 'Authentication required' });
      perms = a.perms;
      if (perm && !perms.split(',').includes(perm)) return res.status(403).json({ error: 'Forbidden' });
    }
    req.u = { id: s.subject_id, perms }; next();
  };
  const audit = (role, id, action, order) =>
    db.prepare('INSERT INTO audit_events(actor_role,actor_id,action,order_id,at) VALUES(?,?,?,?,?)').run(role, id, action, order || null, iso());
  const oid = req => UUID.test(req.params.id) ? req.params.id.toLowerCase() : null;
  const label = id => id.slice(0, 8);
  const note = (id, text) => {
    const o = db.prepare('SELECT customer_id FROM orders WHERE id=?').get(id);
    db.prepare('INSERT INTO notifications(customer_id,order_id,text,at) VALUES(?,?,?,?)').run(o.customer_id, id, text, iso());
  };
  const move = (id, to) => {
    try { db.prepare('UPDATE orders SET status=?,updated_at=? WHERE id=?').run(to, iso(), id); return true; }
    catch (e) { if (/invalid transition/.test(e.message)) return false; throw e; }
  };
  const release = id => db.prepare('UPDATE assignments SET active=0,ended_at=? WHERE order_id=? AND active=1').run(iso(), id);
  const mine = (id, pid) => db.prepare('SELECT o.* FROM orders o JOIN assignments a ON a.order_id=o.id AND a.active=1 AND a.partner_id=? WHERE o.id=?').get(pid, id);
  const mineCust = (id, cid) => db.prepare('SELECT * FROM orders WHERE id=? AND customer_id=?').get(id, cid);

  // ---------- Authentication ----------
  app.post('/api/auth/otp/request', limit('otpReq-ip', L.otpReq), limit('otpReq-phone', L.otpReq, byPhone), async (req, res) => {
    const phone = req.body?.phone;
    if (!PHONE.test(phone ?? '')) return res.status(400).json({ error: 'Enter a phone number with country code' });
    const c = db.prepare('SELECT id FROM customers WHERE phone=?').get(phone);
    if (c) {
      const code = String(crypto.randomInt(100000, 1000000));
      db.prepare('INSERT OR REPLACE INTO otps VALUES(?,?,?,0,0)').run(phone, hm(secret, 'otp:' + phone + code), now() + 5 * 60000);
      await send(phone, `Your ShipTrack sign-in code is ${code}. It expires in 5 minutes.`);
    }
    res.status(202).json({ ok: true }); // identical response whether or not the phone is registered
  });
  app.post('/api/auth/otp/verify', limit('otpVerify', L.otpVerify), (req, res) => {
    const { phone, code } = req.body || {};
    const fail = () => res.status(401).json({ error: 'Invalid or expired code' });
    if (!PHONE.test(phone ?? '') || !/^\d{6}$/.test(code ?? '')) return fail();
    const o = db.prepare('SELECT * FROM otps WHERE phone=?').get(phone);
    if (!o || o.used || o.expires_at < now() || o.attempts >= 5) return fail();
    db.prepare('UPDATE otps SET attempts=attempts+1 WHERE phone=?').run(phone);
    if (!same(hm(secret, 'otp:' + phone + code), o.code_hash)) return fail();
    db.prepare('UPDATE otps SET used=1 WHERE phone=?').run(phone);
    const c = db.prepare('SELECT id FROM customers WHERE phone=?').get(phone);
    if (!c) return fail();
    res.json({ token: session('customer', c.id, 12 * 3600e3), role: 'customer' });
  });
  app.post('/api/auth/partner/login', limit('login', L.login), limit('login-id', L.login, byId), (req, res) => {
    const { email, password } = req.body || {};
    const p = EMAIL.test(email ?? '') && txt(password, 1, 200) ? db.prepare('SELECT * FROM partners WHERE email=?').get(email.toLowerCase()) : null;
    const ok = checkPw(typeof password === 'string' ? password : '', p ? p.pw : DUMMY) && p;
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    audit('partner', p.id, 'login'); res.json({ token: session('partner', p.id, 12 * 3600e3), role: 'partner' });
  });
  app.post('/api/auth/admin/login', limit('login', L.login), limit('login-id', L.login, byId), (req, res) => {
    const { email, admin_id, password } = req.body || {};
    const a = EMAIL.test(email ?? '') && txt(password, 1, 200) && txt(admin_id, 1, 40) ? db.prepare('SELECT * FROM admins WHERE email=?').get(email.toLowerCase()) : null;
    const pwOk = checkPw(typeof password === 'string' ? password : '', a ? a.pw : DUMMY);
    if (!(a && pwOk && same(a.admin_code, admin_id))) return res.status(401).json({ error: 'Invalid credentials' });
    audit('admin', a.id, 'login'); res.json({ token: session('admin', a.id, 3600e3), role: 'admin' });
  });
  app.post('/api/auth/logout', (req, res) => {
    const m = /^Bearer ([\w-]{20,100})$/.exec(req.get('authorization') || '');
    if (m) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hm(secret, m[1]));
    res.json({ ok: true });
  });

  // ---------- Customer ----------
  const cust = auth('customer');
  app.get('/api/orders', limit('lookup', L.lookup), cust, (req, res) =>
    res.json(db.prepare('SELECT id,item,status,created_at,updated_at FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 100').all(req.u.id)));
  app.get('/api/orders/:id', limit('lookup', L.lookup), cust, (req, res) => {
    const id = oid(req), o = id && mineCust(id, req.u.id);
    if (!o) return nf(res);
    res.json({ id: o.id, item: o.item, status: o.status, recipient_name: o.recipient_name, address: o.address, created_at: o.created_at, updated_at: o.updated_at });
  });
  app.get('/api/notifications', limit('lookup', L.lookup), cust, (req, res) =>
    res.json(db.prepare('SELECT order_id,text,at FROM notifications WHERE customer_id=? ORDER BY id DESC LIMIT 50').all(req.u.id)));
  app.get('/api/orders/:id/support', limit('lookup', L.lookup), cust, (req, res) => {
    const id = oid(req); if (!id || !mineCust(id, req.u.id)) return nf(res);
    res.json(db.prepare('SELECT sender_role,body,at FROM support_messages WHERE order_id=? ORDER BY id').all(id));
  });
  app.post('/api/orders/:id/support', limit('support', L.support), cust, (req, res) => {
    const id = oid(req); if (!id || !mineCust(id, req.u.id)) return nf(res);
    if (!txt(req.body?.body, 1, 1000)) return res.status(400).json({ error: 'Message must be 1 to 1000 characters' });
    db.prepare('INSERT INTO support_messages(order_id,sender_role,sender_id,body,at) VALUES(?,?,?,?,?)').run(id, 'customer', req.u.id, req.body.body, iso());
    res.status(201).json({ ok: true });
  });

  // ---------- Delivery partner ----------
  const part = auth('partner');
  const partnerView = (o, pid) => {
    const showAddr = ['picked_up', 'out_for_delivery'].includes(o.status);
    if (showAddr) audit('partner', pid, 'view_address', o.id);
    return { id: o.id, status: o.status, item: o.item, recipient_first_name: o.recipient_name.split(' ')[0], ...(showAddr ? { address: o.address } : {}) };
  };
  app.get('/api/partner/orders', limit('lookup', L.lookup), part, (req, res) =>
    res.json(db.prepare("SELECT o.* FROM orders o JOIN assignments a ON a.order_id=o.id AND a.active=1 AND a.partner_id=? WHERE o.status IN ('assigned','picked_up','out_for_delivery') ORDER BY o.updated_at").all(req.u.id).map(o => partnerView(o, req.u.id))));
  app.get('/api/partner/orders/:id', limit('lookup', L.lookup), part, (req, res) => {
    const id = oid(req), o = id && mine(id, req.u.id); if (!o) return nf(res);
    res.json(partnerView(o, req.u.id));
  });
  app.post('/api/partner/orders/:id/status', limit('delivery', L.delivery), part, async (req, res) => {
    const id = oid(req), to = req.body?.status;
    if (!['picked_up', 'out_for_delivery', 'failed'].includes(to)) return res.status(400).json({ error: 'Status not allowed' });
    const o = id && mine(id, req.u.id); if (!o) return nf(res);
    let ok = false, code = null;
    db.transaction(() => {
      ok = move(id, to); if (!ok) return;
      audit('partner', req.u.id, 'status:' + to, id);
      if (to === 'out_for_delivery') {
        code = String(crypto.randomInt(100000, 1000000));
        db.prepare('INSERT OR REPLACE INTO delivery_codes VALUES(?,?,?,0,0)').run(id, hm(secret, 'dc:' + id + code), now() + 24 * 3600e3);
        note(id, `Order ${label(id)} is out for delivery. A delivery code was sent by SMS.`);
      }
      if (to === 'picked_up') note(id, `Order ${label(id)} was picked up.`);
      if (to === 'failed') { release(id); note(id, `Delivery attempt for order ${label(id)} failed. Support will contact you.`); }
    })();
    if (!ok) return res.status(409).json({ error: 'Invalid status change' });
    if (code) { const c = db.prepare('SELECT phone FROM customers WHERE id=?').get(o.customer_id); await send(c.phone, `Give this delivery code to your partner only on receipt: ${code}`); }
    res.json({ status: to });
  });
  app.post('/api/partner/orders/:id/deliver', limit('delivery', L.delivery), part, (req, res) => {
    const id = oid(req), o = id && mine(id, req.u.id);
    if (!o || o.status !== 'out_for_delivery') return nf(res);
    const bad = () => res.status(400).json({ error: 'Invalid or expired code' });
    const code = req.body?.code; if (!/^\d{6}$/.test(code ?? '')) return bad();
    const d = db.prepare('SELECT * FROM delivery_codes WHERE order_id=?').get(id);
    if (!d || d.used || d.expires_at < now() || d.attempts >= 5) return bad();
    db.prepare('UPDATE delivery_codes SET attempts=attempts+1 WHERE order_id=?').run(id);
    if (!same(hm(secret, 'dc:' + id + code), d.code_hash)) { audit('partner', req.u.id, 'delivery_code_failed', id); return bad(); }
    db.transaction(() => {
      db.prepare('UPDATE delivery_codes SET used=1 WHERE order_id=?').run(id);
      move(id, 'delivered'); release(id); audit('partner', req.u.id, 'status:delivered', id); note(id, `Order ${label(id)} was delivered.`);
    })();
    res.json({ status: 'delivered' });
  });
  app.get('/api/partner/history', limit('lookup', L.lookup), part, (req, res) =>
    res.json(db.prepare("SELECT o.id, o.status, o.updated_at AS completed_at FROM orders o JOIN assignments a ON a.order_id=o.id AND a.partner_id=? WHERE o.status IN ('delivered','failed','cancelled') GROUP BY o.id ORDER BY o.updated_at DESC LIMIT 100").all(req.u.id)));
  app.get('/api/partner/ratings', limit('lookup', L.lookup), part, (req, res) =>
    res.json(db.prepare('SELECT order_id,stars FROM ratings WHERE partner_id=?').all(req.u.id)));

  // ---------- Administrator ----------
  app.post('/api/admin/orders', limit('lookup', L.lookup), auth('admin', 'orders'), (req, res) => {
    const { customer_phone: ph, recipient_name: n, address: a, item: i } = req.body || {};
    if (!PHONE.test(ph ?? '') || !txt(n, 1, 80) || !txt(a, 5, 200) || !txt(i, 1, 120)) return res.status(400).json({ error: 'Check the order details and try again' });
    const id = crypto.randomUUID();
    db.transaction(() => {
      let c = db.prepare('SELECT id FROM customers WHERE phone=?').get(ph);
      if (!c) { c = { id: crypto.randomUUID() }; db.prepare('INSERT INTO customers VALUES(?,?)').run(c.id, ph); }
      db.prepare('INSERT INTO orders(id,customer_id,recipient_name,address,item,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id, c.id, n.trim(), a.trim(), i.trim(), iso(), iso());
      audit('admin', req.u.id, 'create_order', id);
    })();
    res.status(201).json({ id });
  });
  app.get('/api/admin/orders', limit('lookup', L.lookup), auth('admin', 'orders'), (req, res) => {
    audit('admin', req.u.id, 'list_orders');
    res.json(db.prepare('SELECT o.id,o.item,o.status,o.recipient_name,o.address,o.updated_at,a.partner_id FROM orders o LEFT JOIN assignments a ON a.order_id=o.id AND a.active=1 ORDER BY o.created_at DESC LIMIT 200').all());
  });
  app.get('/api/admin/partners', limit('lookup', L.lookup), auth('admin', 'orders'), (req, res) =>
    res.json(db.prepare('SELECT id,name FROM partners ORDER BY name').all()));
  app.post('/api/admin/orders/:id/assign', limit('lookup', L.lookup), auth('admin', 'orders'), (req, res) => {
    const id = oid(req), pid = req.body?.partner_id;
    const o = id && db.prepare('SELECT * FROM orders WHERE id=?').get(id); if (!o) return nf(res);
    if (!UUID.test(pid ?? '') || !db.prepare('SELECT 1 FROM partners WHERE id=?').get(pid)) return res.status(400).json({ error: 'Choose a valid delivery partner' });
    let ok = false;
    db.transaction(() => {
      const wasActive = !!db.prepare('SELECT 1 FROM assignments WHERE order_id=? AND active=1').get(id);
      ok = move(id, 'assigned'); if (!ok) return;
      release(id);
      db.prepare('INSERT INTO assignments(order_id,partner_id,assigned_at) VALUES(?,?,?)').run(id, pid, iso());
      audit('admin', req.u.id, wasActive ? 'reassign' : 'assign', id);
      note(id, `Order ${label(id)} was assigned to a delivery partner.`);
    })();
    if (!ok) return res.status(409).json({ error: 'Invalid status change' });
    res.json({ status: 'assigned' });
  });
  app.post('/api/admin/orders/:id/cancel', limit('lookup', L.lookup), auth('admin', 'orders'), (req, res) => {
    const id = oid(req); if (!id || !db.prepare('SELECT 1 FROM orders WHERE id=?').get(id)) return nf(res);
    let ok = false;
    db.transaction(() => { ok = move(id, 'cancelled'); if (!ok) return; release(id); audit('admin', req.u.id, 'cancel', id); note(id, `Order ${label(id)} was cancelled.`); })();
    if (!ok) return res.status(409).json({ error: 'Invalid status change' });
    res.json({ status: 'cancelled' });
  });
  app.get('/api/admin/support', limit('lookup', L.lookup), auth('admin', 'support'), (req, res) =>
    res.json(db.prepare('SELECT order_id,sender_role,body,at FROM support_messages ORDER BY id DESC LIMIT 200').all()));
  app.post('/api/admin/orders/:id/support', limit('support', L.support), auth('admin', 'support'), (req, res) => {
    const id = oid(req); if (!id || !db.prepare('SELECT 1 FROM orders WHERE id=?').get(id)) return nf(res);
    if (!txt(req.body?.body, 1, 1000)) return res.status(400).json({ error: 'Message must be 1 to 1000 characters' });
    db.transaction(() => {
      db.prepare('INSERT INTO support_messages(order_id,sender_role,sender_id,body,at) VALUES(?,?,?,?,?)').run(id, 'support', req.u.id, req.body.body, iso());
      audit('admin', req.u.id, 'support_reply', id); note(id, `Support replied about order ${label(id)}.`);
    })();
    res.status(201).json({ ok: true });
  });
  app.get('/api/admin/audit', limit('lookup', L.lookup), auth('admin', 'audit'), (req, res) =>
    res.json(db.prepare('SELECT actor_role,actor_id,action,order_id,at FROM audit_events ORDER BY id DESC LIMIT 200').all()));
  app.get('/api/admin/summary', limit('lookup', L.lookup), auth('admin', 'orders'), (req, res) => {
    const day = new Date().toISOString().slice(0, 10) + '%';
    const n = s => db.prepare('SELECT COUNT(*) c FROM orders WHERE status=? AND updated_at LIKE ?').get(s, day).c;
    res.json({ date: day.slice(0, 10), delivered: n('delivered'), failed: n('failed'), cancelled: n('cancelled') });
  });

  if (publicDir) app.use(express.static(publicDir));
  app.use('/api', (req, res) => nf(res));
  app.use((err, req, res, next) => { // never leak internals
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed request' });
    console.error('server error', err.code || err.name); res.status(500).json({ error: 'Something went wrong' });
  });
  return app;
}
