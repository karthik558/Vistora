-- 27. COMPLAINT INTAKE AND JUNIOR -> SENIOR -> GM ESCALATION
-- Existing database: apply section 26 / 20261027_role_mapping.sql FIRST, then this file.
-- Run POST /api/jobs every minute with Authorization: Bearer WORKSPACE_CRON_SECRET.
-- Email/channel delivery also needs the configured delivery provider.
-- Full schema.sql already includes both upgrades; do not run old development seeds on live data.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.role_mappings') IS NULL THEN RAISE EXCEPTION 'Install schema sections 12-25 and 20261027_role_mapping.sql (section 26) before this complaint upgrade'; END IF;
END $$;
ALTER TABLE public.role_mappings DROP CONSTRAINT IF EXISTS role_mappings_department_check;
ALTER TABLE public.role_mappings ADD CONSTRAINT role_mappings_department_check CHECK(length(trim(department)) BETWEEN 1 AND 80);
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS senior_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS gm_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS response_minutes integer NOT NULL DEFAULT 15 CHECK(response_minutes BETWEEN 1 AND 1440);
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS senior_response_minutes integer NOT NULL DEFAULT 20 CHECK(senior_response_minutes BETWEEN 1 AND 1440);
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS escalate_until text NOT NULL DEFAULT 'acknowledged' CHECK(escalate_until IN ('acknowledged','resolved'));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['feedback','service_jobs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS routing_rule_id uuid REFERENCES public.role_mappings(id) ON DELETE SET NULL',t);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS routing_cycle uuid NOT NULL DEFAULT gen_random_uuid()',t);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0 CHECK(escalation_level BETWEEN 0 AND 2)',t);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS escalation_due_at timestamptz',t);
 END LOOP;
END $$;
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '*';
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS issue_type text;
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS intake_channel text NOT NULL DEFAULT 'staff' CHECK(intake_channel IN ('staff','front_desk','phone','guest_request'));
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
CREATE INDEX IF NOT EXISTS service_jobs_escalation_due ON public.service_jobs(escalation_due_at) WHERE status IN ('open','in_progress');
CREATE INDEX IF NOT EXISTS feedback_escalation_due ON public.feedback(escalation_due_at) WHERE status<>'resolved';

CREATE OR REPLACE FUNCTION public.complaint_schema_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.complaint_schema_ready() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complaint_schema_ready() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.role_member_eligible(p_user uuid,p_org uuid,p_property uuid,p_module text,p_department text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id
 JOIN public.properties h ON h.id=p_property AND h.organization_id=p_org AND h.is_active
 WHERE m.user_id=p_user AND m.organization_id=p_org AND m.is_active AND p.organization_id=p_org
 AND (m.role IN ('owner','admin') OR (
  (p.property_id=p_property OR p_property=ANY(p.property_ids))
  AND (('module:'||p_module)=ANY(p.rights) OR (p_module='feedback' AND NOT ('module_access:configured'=ANY(p.rights)) AND 'manage_complaints'=ANY(p.rights)))
  AND (CASE WHEN p_module='feedback' THEN 'manage_complaints' ELSE 'manage_service_jobs' END)=ANY(p.rights)
  AND (NOT EXISTS(SELECT 1 FROM unnest(p.rights) x WHERE x LIKE 'dept_scope:%') OR p.rights && ARRAY['dept_scope:*','dept_scope:All Departments','dept_scope:'||p_department])
 )))
$$;
REVOKE ALL ON FUNCTION public.role_member_eligible(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.role_member_eligible(uuid,uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.resolve_role_chain(p_org uuid,p_property uuid,p_module text,p_department text,p_rating integer) RETURNS SETOF public.role_mappings LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.* FROM public.role_mappings r JOIN public.properties h ON h.id=p_property AND h.organization_id=p_org AND h.is_active
 WHERE r.organization_id=p_org AND r.is_active AND r.module=p_module AND p_rating<=r.max_rating
 AND (r.property_id=p_property OR (r.property_id IS NULL AND (r.country='' OR lower(r.country)=lower(h.country))))
 AND r.department IN ('*',p_department) AND public.role_member_eligible(r.assignee_id,p_org,p_property,p_module,p_department)
 ORDER BY CASE WHEN r.property_id IS NOT NULL THEN 0 WHEN r.country<>'' THEN 1 ELSE 2 END,CASE WHEN r.department='*' THEN 1 ELSE 0 END,r.id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_role_chain(uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.resolve_role_owner(p_org uuid,p_property uuid,p_module text,p_department text,p_rating integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT assignee_id FROM public.resolve_role_chain(p_org,p_property,p_module,p_department,p_rating)
$$;
CREATE OR REPLACE FUNCTION public.guard_role_mapping() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE candidate uuid;
BEGIN
 IF auth.uid() IS NOT NULL AND (NOT public.workspace_admin() OR NEW.organization_id IS DISTINCT FROM public.workspace_org()) THEN RAISE EXCEPTION 'Company administrator access required' USING ERRCODE='42501'; END IF;
 NEW.country:=trim(NEW.country);NEW.department:=trim(NEW.department);NEW.role_name:=trim(NEW.role_name);
 IF NEW.property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=NEW.property_id AND organization_id=NEW.organization_id AND is_active) THEN RAISE EXCEPTION 'Choose an active property in this company'; END IF;
 IF NEW.country<>'' AND NOT EXISTS(SELECT 1 FROM public.properties WHERE organization_id=NEW.organization_id AND lower(country)=lower(NEW.country) AND is_active) THEN RAISE EXCEPTION 'Choose a country with active properties in this company'; END IF;
 FOREACH candidate IN ARRAY ARRAY[NEW.assignee_id,NEW.senior_assignee_id,NEW.gm_assignee_id] LOOP
  IF candidate IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.organization_id=NEW.organization_id AND p.organization_id=NEW.organization_id AND m.user_id=candidate AND m.is_active) THEN RAISE EXCEPTION 'Every escalation owner must be an active company member'; END IF;
 END LOOP;
 IF NEW.assignee_id=NEW.senior_assignee_id OR NEW.assignee_id=NEW.gm_assignee_id OR NEW.senior_assignee_id=NEW.gm_assignee_id THEN RAISE EXCEPTION 'Choose different members for each escalation level'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.route_attention_work() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rule public.role_mappings; dept text:='*'; score integer:=3; should_route boolean:=false;
BEGIN
 IF TG_TABLE_NAME='feedback' THEN
  IF TG_OP='INSERT' AND NEW.rating<=3 THEN NEW.status:='needs_attention';NEW.resolved_at:=NULL;END IF;
  should_route:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN
   should_route:=OLD.status='resolved' AND NEW.status<>'resolved';
   IF should_route THEN NEW.routing_cycle:=gen_random_uuid();NEW.escalation_level:=0;NEW.first_response_at:=NULL;NEW.routing_rule_id:=NULL;NEW.escalation_due_at:=NULL;END IF;
   IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND auth.uid() IS NOT NULL THEN NEW.routing_rule_id:=NULL;NEW.escalation_due_at:=NULL;END IF;
  END IF;
  IF should_route AND NEW.rating<=3 AND NEW.status<>'resolved' AND NEW.assigned_to IS NULL AND NEW.assigned_user_id IS NULL THEN
   SELECT * INTO rule FROM public.resolve_role_chain(NEW.organization_id,NEW.property_id,'feedback',NEW.department::text,NEW.rating);
   IF FOUND THEN NEW.assigned_user_id:=rule.assignee_id;SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id=rule.assignee_id;NEW.routing_rule_id:=rule.id;NEW.sla_deadline:=now()+make_interval(mins=>rule.response_minutes);NEW.escalation_due_at:=CASE WHEN rule.senior_assignee_id IS NOT NULL OR rule.gm_assignee_id IS NOT NULL THEN NEW.sla_deadline ELSE NULL END;END IF;
  END IF;
  IF NEW.status='resolved' OR (NEW.first_response_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.role_mappings WHERE id=NEW.routing_rule_id AND escalate_until='acknowledged')) THEN NEW.escalation_due_at:=NULL;END IF;
 ELSE
  IF TG_OP='INSERT' THEN
   IF NEW.feedback_id IS NOT NULL THEN SELECT department::text,rating INTO dept,score FROM public.feedback WHERE id=NEW.feedback_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id;IF NEW.department='*' THEN NEW.department:=COALESCE(dept,'*');END IF;END IF;
   IF NEW.assigned_to IS NULL AND (NEW.issue_type IS NOT NULL OR NEW.priority IN ('high','critical') OR (NEW.feedback_id IS NOT NULL AND score<=3)) THEN
    SELECT * INTO rule FROM public.resolve_role_chain(NEW.organization_id,NEW.property_id,'hospitality',NEW.department,CASE WHEN NEW.priority IN ('high','critical') OR NEW.issue_type IS NOT NULL THEN 1 ELSE score END);
    IF FOUND THEN NEW.assigned_to:=rule.assignee_id;NEW.routing_rule_id:=rule.id;NEW.due_at:=now()+make_interval(mins=>rule.response_minutes);NEW.escalation_due_at:=CASE WHEN rule.senior_assignee_id IS NOT NULL OR rule.gm_assignee_id IS NOT NULL THEN NEW.due_at ELSE NULL END;END IF;
   END IF;
  ELSE
   IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND auth.uid() IS NOT NULL THEN NEW.routing_rule_id:=NULL;NEW.escalation_due_at:=NULL;END IF;
   IF NEW.status IN ('in_progress','completed') AND OLD.status='open' OR NEW.acknowledged_at IS NOT NULL AND OLD.acknowledged_at IS NULL THEN NEW.acknowledged_at:=COALESCE(OLD.acknowledged_at,now());END IF;
  END IF;
  IF NEW.status IN ('completed','cancelled') OR (NEW.acknowledged_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.role_mappings WHERE id=NEW.routing_rule_id AND escalate_until='acknowledged')) THEN NEW.escalation_due_at:=NULL;END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS b_role_route ON public.feedback;
DROP TRIGGER IF EXISTS zz_role_route ON public.feedback;
DROP TRIGGER IF EXISTS b_role_insert ON public.feedback;
CREATE TRIGGER b_role_insert BEFORE INSERT ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();
DROP TRIGGER IF EXISTS zz_role_update ON public.feedback;
CREATE TRIGGER zz_role_update BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();
DROP TRIGGER IF EXISTS zy_role_route ON public.service_jobs;
CREATE TRIGGER zy_role_route BEFORE INSERT OR UPDATE ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();

CREATE OR REPLACE FUNCTION public.guard_staff_job_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.workspace_admin() THEN
  IF OLD.assigned_to IS DISTINCT FROM auth.uid() OR NOT public.workspace_right('manage_service_jobs') OR NOT public.workspace_module('hospitality') OR NOT public.workspace_property(OLD.property_id) OR NOT public.workspace_department(OLD.department) OR NOT public.hotel_enabled('operations') THEN RAISE EXCEPTION 'Only the assigned authorized member can attend this job' USING ERRCODE='42501';END IF;
  IF (to_jsonb(NEW)-'status'-'acknowledged_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'acknowledged_at') OR NEW.status NOT IN ('open','in_progress','completed') OR OLD.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Assigned staff may acknowledge, start or complete work only' USING ERRCODE='42501';END IF;
  IF OLD.acknowledged_at IS NOT NULL AND NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at THEN RAISE EXCEPTION 'Acknowledgement is immutable' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS a_staff_job_update ON public.service_jobs;
CREATE TRIGGER a_staff_job_update BEFORE UPDATE ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.guard_staff_job_update();
DROP POLICY IF EXISTS hotel_module_read ON public.service_jobs;
CREATE POLICY hotel_module_read ON public.service_jobs FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_module('hospitality') AND public.workspace_property(property_id) AND (public.workspace_department(department) OR created_by=auth.uid()));
DROP POLICY IF EXISTS assigned_job_update ON public.service_jobs;
CREATE POLICY assigned_job_update ON public.service_jobs FOR UPDATE TO authenticated USING(organization_id=public.workspace_org() AND assigned_to=auth.uid() AND public.workspace_module('hospitality') AND public.workspace_property(property_id) AND public.workspace_department(department) AND public.workspace_right('manage_service_jobs')) WITH CHECK(organization_id=public.workspace_org() AND assigned_to=auth.uid());

-- Managed feedback follows the current escalation owner; manual legacy cases keep existing permissions.
DROP POLICY IF EXISTS feedback_update ON public.feedback;
CREATE POLICY feedback_update ON public.feedback FOR UPDATE TO authenticated USING(public.workspace_property(property_id) AND public.workspace_department(department::text) AND public.workspace_right('manage_complaints') AND (routing_rule_id IS NULL OR public.workspace_admin() OR assigned_user_id=auth.uid())) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_property(property_id) AND public.workspace_department(department::text));
CREATE OR REPLACE FUNCTION public.guard_managed_feedback_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.workspace_admin() AND OLD.routing_rule_id IS NOT NULL THEN
  IF OLD.assigned_user_id IS DISTINCT FROM auth.uid() OR (to_jsonb(NEW)-'status'-'first_response_at'-'resolution_notes'-'priority'-'category') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'first_response_at'-'resolution_notes'-'priority'-'category') THEN RAISE EXCEPTION 'Only the current owner may attend routed feedback; only administrators may reassign it' USING ERRCODE='42501';END IF;
  IF OLD.first_response_at IS NOT NULL AND NEW.first_response_at IS DISTINCT FROM OLD.first_response_at THEN RAISE EXCEPTION 'First response is immutable' USING ERRCODE='42501';END IF;
  IF NEW.first_response_at IS NOT NULL AND OLD.first_response_at IS NULL THEN NEW.first_response_at:=now();END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS a_managed_feedback ON public.feedback;
CREATE TRIGGER a_managed_feedback BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.guard_managed_feedback_update();

CREATE OR REPLACE FUNCTION public.submit_service_complaint(p_complaint jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.workspace_org(); pid uuid:=(p_complaint->>'property_id')::uuid; issue text:=p_complaint->>'issue_type'; dept text; result uuid;
BEGIN
 IF NOT public.workspace_module('hospitality') OR NOT public.workspace_property(pid) OR NOT (public.workspace_admin() OR public.workspace_right('manage_service_jobs')) OR NOT public.hotel_enabled('operations') THEN RAISE EXCEPTION 'Complaint access requires an authorized property and hotel operations permission' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=pid AND organization_id=org AND is_active) THEN RAISE EXCEPTION 'Choose an active property';END IF;
 dept:=CASE issue WHEN 'wifi' THEN 'IT' WHEN 'television' THEN 'IT' WHEN 'lighting' THEN 'Engineering' WHEN 'air_conditioning' THEN 'Engineering' WHEN 'plumbing' THEN 'Engineering' WHEN 'cleanliness' THEN 'Housekeeping' WHEN 'noise' THEN 'Front Desk' WHEN 'food_service' THEN 'Food & Beverage' WHEN 'other' THEN p_complaint->>'department' ELSE NULL END;
 IF dept IS NULL OR dept NOT IN ('IT','Engineering','Housekeeping','Front Desk','Food & Beverage','Concierge','Spa & Wellness','Valet & Transfers') THEN RAISE EXCEPTION 'Choose a valid issue and department';END IF;
 IF COALESCE(length(trim(p_complaint->>'title')),0) NOT BETWEEN 1 AND 160 OR COALESCE(length(p_complaint->>'description'),0)>2000 OR COALESCE(length(trim(p_complaint->>'location')),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Complaint requires a title and room/location within the allowed length';END IF;
 IF COALESCE(p_complaint->>'priority','normal') NOT IN ('low','normal','high','critical') OR COALESCE(p_complaint->>'intake_channel','staff') NOT IN ('staff','front_desk','phone','guest_request') THEN RAISE EXCEPTION 'Invalid priority or intake channel';END IF;
 INSERT INTO public.service_jobs(organization_id,property_id,created_by,kind,title,description,priority,due_at,department,issue_type,location,intake_channel)
 VALUES(org,pid,auth.uid(),'guest_request',trim(p_complaint->>'title'),COALESCE(p_complaint->>'description',''),COALESCE(p_complaint->>'priority','normal'),now()+interval '15 minutes',dept,issue,trim(p_complaint->>'location'),COALESCE(p_complaint->>'intake_channel','staff')) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.submit_service_complaint(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_service_complaint(jsonb) TO authenticated;

ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check CHECK(kind IN ('sla','followup','invitation','team_invitation','report','webhook','asset_cleanup','operations_alert','role_assignment'));
CREATE OR REPLACE FUNCTION public.queue_role_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; changed boolean; module text;
BEGIN
 module:=CASE WHEN TG_TABLE_NAME='feedback' THEN 'feedback' ELSE 'hospitality' END;
 owner_id:=CASE WHEN TG_TABLE_NAME='feedback' THEN (to_jsonb(NEW)->>'assigned_user_id')::uuid ELSE (to_jsonb(NEW)->>'assigned_to')::uuid END;
 changed:=TG_OP='INSERT';
 IF TG_OP='UPDATE' THEN changed:=NEW.escalation_level IS DISTINCT FROM OLD.escalation_level OR NEW.routing_cycle IS DISTINCT FROM OLD.routing_cycle OR (to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='feedback' THEN 'assigned_user_id' ELSE 'assigned_to' END) IS DISTINCT FROM (to_jsonb(OLD)->>CASE WHEN TG_TABLE_NAME='feedback' THEN 'assigned_user_id' ELSE 'assigned_to' END);END IF;
 IF changed AND NEW.routing_rule_id IS NOT NULL AND owner_id IS NOT NULL THEN
  INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(NEW.organization_id,'role_assignment','role:'||module||':'||NEW.id||':'||NEW.routing_cycle||':'||NEW.escalation_level,
   jsonb_build_object('module',module,'recordId',NEW.id,'assignedUserId',owner_id,'level',NEW.escalation_level,'cycle',NEW.routing_cycle)) ON CONFLICT(dedup_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS role_assignment_notice ON public.feedback;
CREATE TRIGGER role_assignment_notice AFTER INSERT OR UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.queue_role_assignment();
DROP TRIGGER IF EXISTS role_assignment_notice ON public.service_jobs;
CREATE TRIGGER role_assignment_notice AFTER INSERT OR UPDATE ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.queue_role_assignment();

CREATE OR REPLACE FUNCTION public.advance_role_escalations(p_org uuid DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item record;rule public.role_mappings;candidate uuid;level_next integer;level_found integer;dept text;mod text;changed integer:=0;t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['feedback','service_jobs'] LOOP
  FOR item IN EXECUTE format('SELECT *,department::text AS routing_department FROM public.%I WHERE escalation_due_at<=now() AND routing_rule_id IS NOT NULL AND status::text NOT IN (''resolved'',''completed'',''cancelled'') AND ($1 IS NULL OR organization_id=$1) ORDER BY escalation_due_at LIMIT 50 FOR UPDATE SKIP LOCKED',t) USING p_org LOOP
   SELECT * INTO rule FROM public.role_mappings WHERE id=item.routing_rule_id AND is_active AND organization_id=item.organization_id;
   IF NOT FOUND THEN EXECUTE format('UPDATE public.%I SET escalation_due_at=NULL WHERE id=$1',t) USING item.id;CONTINUE;END IF;
   IF rule.escalate_until='acknowledged' AND (CASE WHEN t='feedback' THEN to_jsonb(item)->>'first_response_at' ELSE to_jsonb(item)->>'acknowledged_at' END) IS NOT NULL THEN EXECUTE format('UPDATE public.%I SET escalation_due_at=NULL WHERE id=$1',t) USING item.id;CONTINUE;END IF;
   mod:=CASE WHEN t='feedback' THEN 'feedback' ELSE 'hospitality' END;dept:=item.routing_department;level_found:=NULL;
   FOR level_next IN item.escalation_level+1..2 LOOP
    candidate:=CASE WHEN level_next=1 THEN rule.senior_assignee_id ELSE rule.gm_assignee_id END;
    IF candidate IS NOT NULL AND public.role_member_eligible(candidate,item.organization_id,item.property_id,mod,dept) THEN level_found:=level_next;EXIT;END IF;
   END LOOP;
   IF level_found IS NULL THEN EXECUTE format('UPDATE public.%I SET escalation_due_at=$2 WHERE id=$1',t) USING item.id,CASE WHEN item.escalation_level=2 OR rule.gm_assignee_id IS NULL AND (item.escalation_level>=1 OR rule.senior_assignee_id IS NULL) THEN NULL ELSE now()+interval '5 minutes' END;CONTINUE;END IF;
   IF t='feedback' THEN
    UPDATE public.feedback SET assigned_user_id=candidate,assigned_to=(SELECT full_name FROM public.profiles WHERE id=candidate),escalation_level=level_found,status='escalated',escalation_due_at=CASE WHEN level_found=2 OR rule.gm_assignee_id IS NULL THEN NULL ELSE now()+make_interval(mins=>rule.senior_response_minutes) END WHERE id=item.id;
   ELSE
    UPDATE public.service_jobs SET assigned_to=candidate,escalation_level=level_found,escalated_at=now(),escalation_due_at=CASE WHEN level_found=2 OR rule.gm_assignee_id IS NULL THEN NULL ELSE now()+make_interval(mins=>rule.senior_response_minutes) END WHERE id=item.id;
   END IF;
   changed:=changed+1;
  END LOOP;
 END LOOP;
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.advance_role_escalations(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_role_escalations(uuid) TO service_role;
COMMIT;
