-- Outbox-backed guest messaging uses the existing worker and delivery ledger.
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check
 CHECK(kind IN ('sla','followup','invitation','team_invitation','report','webhook','guest_message'));