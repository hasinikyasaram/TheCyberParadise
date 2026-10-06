# ShipTrack Sentinel

Shipment tracking for three separate roles (customer, delivery partner, administrator). Demo-grade reference build. Do not treat it as production ready.

## Setup
1. Node 20 or newer. Run `npm install`.
2. Copy `.env.example` to `.env`, replace every placeholder, and load it into your shell (the app does not read `.env` by itself).
3. `npm run seed` creates synthetic users (admin `ops@example.test`, ID `ADM-0001`; partner `rider1@example.test`; customer `+919000000001`). Passwords come from `SEED_ADMIN_PASSWORD` and `SEED_PARTNER_PASSWORD`.
4. `npm start`, then open http://localhost:3000. For local demos only, set `DEMO_SHOW_CODES=1` to print SMS text (OTP and delivery codes) to the console. The app refuses this when `NODE_ENV=production`.

Environment variables: `APP_SECRET` (32+ random characters, signs hashes of tokens, OTPs and delivery codes), `DB_FILE`, `PORT`, `SEED_ADMIN_PASSWORD`, `SEED_PARTNER_PASSWORD`, `DEMO_SHOW_CODES`.

## Architecture
Express API (`src/server.js`), SQLite via better-sqlite3 (`src/db.js`), plain HTML/JS front end (`public/`). SMS is a `send(to, message)` stub in `src/index.js`; plug in a real provider there.
Defense layers: server-side role and object checks on every route; database triggers that enforce the order lifecycle and make the audit table append-only; hashed session tokens, OTPs and delivery codes; per-route rate limits; 10 KB body limit; parameterized queries only.

## Permissions
| Role | Can | Cannot |
|---|---|---|
| Customer | Own orders, status, support chat, notifications | Any other customer's data; any partner or admin route |
| Partner | Active assigned orders; address only while picked up or out for delivery; status updates; delivery code entry; history (IDs, status, time); ratings | Customer phone, names beyond first name, old addresses, unassigned orders |
| Admin | Per-permission: `orders` (create, assign, cancel, summary), `support` (inbox, reply), `audit` (read log) | Anything outside granted permissions. Permissions are re-read from the database on each request. |

Lifecycle: created, assigned, picked up, out for delivery, delivered; exceptions: failed, cancelled. Delivered can only be reached through the delivery code endpoint.

## Tests
`npm test` runs `test/security.test.js` (13 tests, in-memory database, real HTTP). Cases cover cross-customer access, partner access limits, admin function and least-privilege checks, invalid and skipped transitions (API and direct DB write), SQL injection and malformed input, OTP expiry, replay and attempt limits, ID enumeration, support chat and audit access, audit immutability, and rate limits.

## Known limitations
- Database RLS is not implemented in the running app (SQLite has none). `db/rls.postgres.sql` is a reference policy set that has NOT been run or tested, so no RLS test exists.
- Administrator multi-factor authentication is not implemented. Add TOTP or WebAuthn before real use.
- Masked or in-app calling is not implemented; partners simply never receive the phone number.
- No rating submission flow; the ratings screen only reads existing rows.
- The daily admin summary is an on-demand endpoint and screen; no scheduler or email sends it.
- Rate limits are in memory, per process, per IP, and do not survive restarts. Behind a proxy, configure trust settings and a shared store.
- Provider budget caps and usage alerts depend on the SMS provider you choose; none are configured.
- No data retention job, TLS termination, CSRF review (bearer tokens in sessionStorage), password reset, account lockout beyond rate limits, or admin UI for managing users. Provision users with the seed script or SQL.
- Not tested: browser UI behavior, accessibility audits, load, mobile devices, any external service.
