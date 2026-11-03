-- READ-ONLY DATABASE INVENTORY. This script never changes or deletes data.
-- A table with no rows or scans is not proof that the application does not need it.
-- Run in the Supabase SQL Editor, then review unknown objects with their owner.
BEGIN READ ONLY;

-- 1. Compare deployed public tables with tables defined by this repository.
WITH required(table_name, feature) AS (VALUES
  ('api_keys', 'Delivery, integrations and reports'),
  ('audit_logs', 'Workspace, permissions and audit'),
  ('audit_trails', 'OmniOps workflows, background jobs and audit'),
  ('breakfast_attendance', 'OmniOps workflows, background jobs and audit'),
  ('feedback', 'Feedback and guest communication'),
  ('feedback_activity', 'Feedback and guest communication'),
  ('feedback_answers', 'Feedback and guest communication'),
  ('feedback_attachments', 'Feedback and guest communication'),
  ('feedback_comments', 'Feedback and guest communication'),
  ('feedback_contacts', 'Feedback and guest communication'),
  ('feedback_questions', 'Feedback and guest communication'),
  ('folio_entries', 'OmniOps workflows, background jobs and audit'),
  ('guest_imports', 'Guest imports and hotel operations'),
  ('guest_invitations', 'Feedback and guest communication'),
  ('guest_service_links', 'OmniOps workflows, background jobs and audit'),
  ('guest_service_requests', 'OmniOps workflows, background jobs and audit'),
  ('guests', 'Guest imports and hotel operations'),
  ('hotel_activity', 'Guest imports and hotel operations'),
  ('hotel_rooms', 'Guest imports and hotel operations'),
  ('incident_compensations', 'OmniOps workflows, background jobs and audit'),
  ('inspection_evidence', 'OmniOps workflows, background jobs and audit'),
  ('inspection_templates', 'OmniOps workflows, background jobs and audit'),
  ('luggage_logs', 'OmniOps workflows, background jobs and audit'),
  ('maintenance_tasks', 'OmniOps workflows, background jobs and audit'),
  ('minibar_catalog', 'OmniOps workflows, background jobs and audit'),
  ('notification_deliveries', 'Delivery, integrations and reports'),
  ('notification_outbox', 'Delivery, integrations and reports'),
  ('operating_costs', 'Guest imports and hotel operations'),
  ('ops_assets', 'OmniOps workflows, background jobs and audit'),
  ('ops_breakfast_webhooks', 'OmniOps workflows, background jobs and audit'),
  ('ops_commands', 'OmniOps workflows, background jobs and audit'),
  ('ops_push_deliveries', 'OmniOps workflows, background jobs and audit'),
  ('ops_push_subscriptions', 'OmniOps workflows, background jobs and audit'),
  ('organization_members', 'Workspace, permissions and audit'),
  ('organization_settings', 'Workspace, permissions and audit'),
  ('organizations', 'Workspace, permissions and audit'),
  ('profiles', 'Workspace, permissions and audit'),
  ('properties', 'Workspace, permissions and audit'),
  ('property_access', 'Workspace, permissions and audit'),
  ('property_settings', 'Workspace, permissions and audit'),
  ('recovery_followups', 'Feedback and guest communication'),
  ('report_runs', 'Delivery, integrations and reports'),
  ('report_schedules', 'Delivery, integrations and reports'),
  ('role_mappings', 'Workspace, permissions and audit'),
  ('room_cleaning_runs', 'OmniOps workflows, background jobs and audit'),
  ('room_inspections', 'Guest imports and hotel operations'),
  ('saved_views', 'Feedback and guest communication'),
  ('service_jobs', 'Guest imports and hotel operations'),
  ('sla_policies', 'Feedback and guest communication'),
  ('stays', 'Guest imports and hotel operations'),
  ('team_invitations', 'Workspace, permissions and audit'),
  ('telephony_events', 'OmniOps workflows, background jobs and audit'),
  ('valet_tickets', 'OmniOps workflows, background jobs and audit'),
  ('webhook_endpoints', 'Delivery, integrations and reports')
)
SELECT c.relname AS table_name, coalesce(r.feature, 'Not defined by this repository: investigate, do not drop') AS feature,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
  greatest(c.reltuples::bigint,0) AS estimated_rows,
  (SELECT count(*) FROM pg_constraint k WHERE k.contype='f' AND k.confrelid=c.oid) AS inbound_foreign_keys,
  (SELECT count(*) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS application_triggers,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS access_policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN required r ON r.table_name=c.relname
WHERE n.nspname='public' AND c.relkind IN ('r','p')
ORDER BY (r.table_name IS NULL) DESC,c.relname;

-- 2. Foreign-key dependencies: deleting a referenced table can break another feature.
SELECT k.conrelid::regclass AS referencing_table, k.confrelid::regclass AS referenced_table,
  k.conname, pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace
WHERE k.contype='f' AND n.nspname='public'
ORDER BY k.conrelid::regclass::text,k.confrelid::regclass::text;

-- 3. Trigger-owned workflows can use tables that have no direct frontend references.
SELECT t.tgrelid::regclass AS table_name, t.tgname AS trigger_name,
  t.tgfoid::regprocedure AS trigger_function, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY t.tgrelid::regclass::text,t.tgname;

-- 4. Registered dependency graph (PL/pgSQL dynamic SQL may have additional dependencies).
SELECT v.oid::regclass AS dependent_view, d.refobjid::regclass AS referenced_table
FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid JOIN pg_class v ON v.oid=r.ev_class
JOIN pg_namespace n ON n.oid=v.relnamespace
WHERE n.nspname='public' AND v.relkind IN ('v','m') AND d.refclassid='pg_class'::regclass
AND d.refobjid<>v.oid GROUP BY v.oid,d.refobjid ORDER BY v.oid::regclass::text,d.refobjid::regclass::text;

-- 5. Usage statistics only cover the time since stats_reset. Zero scans are not safe-to-drop evidence.
SELECT s.relname AS table_name,s.n_live_tup AS estimated_live_rows,s.seq_scan,s.idx_scan,
  s.n_tup_ins,s.n_tup_upd,s.n_tup_del,d.stats_reset
FROM pg_stat_user_tables s CROSS JOIN pg_stat_database d
WHERE s.schemaname='public' AND d.datname=current_database() ORDER BY s.relname;
COMMIT;
