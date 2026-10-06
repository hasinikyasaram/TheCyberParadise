import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp } from './server.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
const demo = process.env.DEMO_SHOW_CODES === '1';
if (demo && process.env.NODE_ENV === 'production') throw new Error('DEMO_SHOW_CODES is not allowed in production');
// Replace this stub with a real SMS provider. Message bodies are logged only in demo mode.
const send = async (to, msg) => { console.log(demo ? `[demo sms to ${to.slice(0, 5)}***] ${msg}` : 'sms queued'); };
const app = createApp({ db: openDb(process.env.DB_FILE || './shiptrack.db'), send, secret: process.env.APP_SECRET, publicDir: path.join(dir, '../public') });
app.listen(process.env.PORT || 3000, () => console.log('ShipTrack Sentinel listening'));
