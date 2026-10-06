import Database from 'better-sqlite3';
const RULES = [['created','assigned'],['created','cancelled'],['assigned','picked_up'],['assigned','cancelled'],
['picked_up','out_for_delivery'],['picked_up','assigned'],['picked_up','cancelled'],['out_for_delivery','delivered'],
['out_for_delivery','failed'],['out_for_delivery','cancelled'],['failed','assigned'],['failed','cancelled']];
const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS partners(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admins(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, admin_code TEXT NOT NULL, pw TEXT NOT NULL, perms TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id),
 recipient_name TEXT NOT NULL, address TEXT NOT NULL, item TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','assigned','picked_up','out_for_delivery','delivered','failed','cancelled')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS status_rules(from_s TEXT, to_s TEXT, PRIMARY KEY(from_s,to_s));
CREATE TABLE IF NOT EXISTS assignments(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL REFERENCES orders(id),
 partner_id TEXT NOT NULL REFERENCES partners(id), active INTEGER NOT NULL DEFAULT 1, assigned_at TEXT NOT NULL, ended_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS one_active ON assignments(order_id) WHERE active=1;
CREATE TABLE IF NOT EXISTS otps(phone TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS delivery_codes(order_id TEXT PRIMARY KEY REFERENCES orders(id), code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, subject_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS support_messages(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL REFERENCES orders(id), sender_role TEXT NOT NULL, sender_id TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT NOT NULL, order_id TEXT NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ratings(order_id TEXT PRIMARY KEY REFERENCES orders(id), partner_id TEXT NOT NULL, stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5));
CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY AUTOINCREMENT, actor_role TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, order_id TEXT, at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS orders_flow BEFORE UPDATE OF status ON orders
 WHEN NEW.status<>OLD.status AND NOT EXISTS(SELECT 1 FROM status_rules WHERE from_s=OLD.status AND to_s=NEW.status)
 BEGIN SELECT RAISE(ABORT,'invalid transition'); END;
CREATE TRIGGER IF NOT EXISTS orders_start BEFORE INSERT ON orders WHEN NEW.status<>'created' BEGIN SELECT RAISE(ABORT,'must start created'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit is append only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit is append only'); END;
`;
export function openDb(file = ':memory:') {
  const db = new Database(file); db.pragma('foreign_keys=ON'); db.exec(SCHEMA);
  const ins = db.prepare('INSERT OR IGNORE INTO status_rules VALUES(?,?)');
  for (const r of RULES) ins.run(...r);
  return db;
}
