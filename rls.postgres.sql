-- Postgres row level security reference policies. NOT wired into the Node app and NOT TESTED.
-- The running app uses SQLite (no RLS) with API checks, DB triggers and constraints.
-- To adopt: connect with a non-owner role per request, run SET LOCAL app.role / app.user_id, then run these.
-- Assumes tables orders(id, customer_id, status, ...), assignments(order_id, partner_id, active), support_messages(order_id, ...), audit_events.
CREATE ROLE app_customer NOLOGIN; CREATE ROLE app_partner NOLOGIN; CREATE ROLE app_admin NOLOGIN;
CREATE FUNCTION app_uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY; ALTER TABLE orders FORCE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY; ALTER TABLE support_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY cust_orders ON orders FOR SELECT TO app_customer USING (customer_id = app_uid());
CREATE POLICY part_orders ON orders FOR SELECT TO app_partner USING (EXISTS (SELECT 1 FROM assignments a WHERE a.order_id = orders.id AND a.active AND a.partner_id = app_uid()));
CREATE POLICY admin_orders ON orders FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY cust_chat_r ON support_messages FOR SELECT TO app_customer USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = app_uid()));
CREATE POLICY cust_chat_w ON support_messages FOR INSERT TO app_customer WITH CHECK (sender_role = 'customer' AND EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = app_uid()));
CREATE POLICY admin_chat ON support_messages FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY part_assign ON assignments FOR SELECT TO app_partner USING (partner_id = app_uid());
CREATE POLICY admin_assign ON assignments FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY audit_admin_r ON audit_events FOR SELECT TO app_admin USING (true);
CREATE POLICY audit_ins ON audit_events FOR INSERT TO app_admin, app_partner, app_customer WITH CHECK (true);
-- Partners must read orders through a view that omits phone numbers and address once status is not picked_up/out_for_delivery.
-- Column privileges: REVOKE ALL ON customers FROM app_partner; no UPDATE/DELETE grant on audit_events for any role.
