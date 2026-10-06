// Synthetic demo data only. Passwords come from the environment, never from source.
import crypto from 'node:crypto';
import { openDb } from './db.js';
import { hashPw } from './server.js';
const { SEED_ADMIN_PASSWORD: ap, SEED_PARTNER_PASSWORD: pp } = process.env;
if (!ap || !pp || ap.length < 12 || pp.length < 12) throw new Error('Set SEED_ADMIN_PASSWORD and SEED_PARTNER_PASSWORD (12+ characters)');
const db = openDb(process.env.DB_FILE || './shiptrack.db'), id = () => crypto.randomUUID();
db.prepare('INSERT OR IGNORE INTO admins VALUES(?,?,?,?,?)').run(id(), 'ops@example.test', 'ADM-0001', hashPw(ap), 'orders,support,audit');
db.prepare('INSERT OR IGNORE INTO partners VALUES(?,?,?,?)').run(id(), 'rider1@example.test', hashPw(pp), 'Demo Partner One');
db.prepare('INSERT OR IGNORE INTO customers VALUES(?,?)').run(id(), '+919000000001');
console.log('Seeded: admin ops@example.test (ID ADM-0001), partner rider1@example.test, customer +919000000001');
