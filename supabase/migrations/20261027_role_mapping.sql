-- 26. PROPERTY / COUNTRY ROLE ROUTING (apply after sections 12–25)
BEGIN;
CREATE TABLE IF NOT EXISTS public.role_mappings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 module text NOT NULL CHECK(module IN ('feedback','hospitality')),
 property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
 country text NOT NULL DEFAULT '',
 department text NOT NULL DEFAULT '*' CHECK(department IN ('*','Front Desk','Housekeeping','Food & Beverage','Concierge','Facilities & Room','Spa & Wellness','Valet & Transfers')),
 role_name text NOT NULL CHECK(length(trim(role_name)) BETWEEN 1 AND 80),
 assignee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 max_rating integer NOT NULL DEFAULT 3 CHECK(max_rating BETWEEN 1 AND 3),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(property_id IS NULL OR country='')
);
CREATE UNIQUE INDEX IF NOT EXISTS role_mapping_scope ON public.role_mappings(organization_id,module,COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(country),department);
ALTER TABLE public.role_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_mapping_admin ON public.role_mappings;
CREATE POLICY role_mapping_admin ON public.role_mappings FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.role_mappings TO authenticated;
GRANT ALL ON public.role_mappings TO service_role;
CREATE OR REPLACE FUNCTION public.guard_role_mapping() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND (NOT public.workspace_admin() OR NEW.organization_id IS DISTINCT FROM public.workspace_org()) THEN RAISE EXCEPTION 'Company administrator access required' USING ERRCODE='42501'; END IF;
 NEW.country:=trim(NEW.country); NEW.role_name:=trim(NEW.role_name);
 IF NEW.property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=NEW.property_id AND organization_id=NEW.organization_id AND is_active) THEN RAISE EXCEPTION 'Choose an active property in this company'; END IF;
 IF NEW.country<>'' AND NOT EXISTS(SELECT 1 FROM public.properties WHERE organization_id=NEW.organization_id AND lower(country)=lower(NEW.country) AND is_active) THEN RAISE EXCEPTION 'Choose a country with active properties in this company'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.organization_id=NEW.organization_id AND p.organization_id=NEW.organization_id AND m.user_id=NEW.assignee_id AND m.is_active) THEN RAISE EXCEPTION 'Choose an active company member'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS role_mapping_guard ON public.role_mappings;
CREATE TRIGGER role_mapping_guard BEFORE INSERT OR UPDATE ON public.role_mappings FOR EACH ROW EXECUTE FUNCTION public.guard_role_mapping();
-- Resolve a responsibility only while the member still has permission for the actual property/module.
-- More specific rules win: property > country > company, then exact department > all departments.
CREATE OR REPLACE FUNCTION public.resolve_role_owner(p_org uuid,p_property uuid,p_module text,p_department text,p_rating integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.assignee_id FROM public.role_mappings r
 JOIN public.properties h ON h.id=p_property AND h.organization_id=p_org AND h.is_active
 JOIN public.organization_members m ON m.user_id=r.assignee_id AND m.organization_id=p_org AND m.is_active
 JOIN public.profiles p ON p.id=m.user_id AND p.organization_id=p_org
 WHERE r.organization_id=p_org AND r.is_active AND r.module=p_module
 AND (r.property_id=p_property OR (r.property_id IS NULL AND (r.country='' OR lower(r.country)=lower(h.country))))
 AND (r.department='*' OR r.department=p_department) AND p_rating<=r.max_rating
 AND (m.role IN ('owner','admin') OR (
  (p.property_id=p_property OR p_property=ANY(p.property_ids))
  AND (('module:'||p_module)=ANY(p.rights) OR (p_module='feedback' AND NOT ('module_access:configured'=ANY(p.rights)) AND p.rights && ARRAY['view_feedback','manage_complaints']))
  AND (p_module<>'feedback' OR ('manage_complaints'=ANY(p.rights) AND (NOT EXISTS(SELECT 1 FROM unnest(p.rights) x WHERE x LIKE 'dept_scope:%') OR ('dept_scope:'||p_department)=ANY(p.rights))))
 ))
 ORDER BY CASE WHEN r.property_id IS NOT NULL THEN 0 WHEN r.country<>'' THEN 1 ELSE 2 END,CASE WHEN r.department='*' THEN 1 ELSE 0 END,r.id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_role_owner(uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.route_attention_work() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; dept text:='*'; score integer:=3; should_route boolean;
BEGIN
 IF TG_TABLE_NAME='feedback' THEN
  IF TG_OP='INSERT' AND NEW.rating<=3 THEN NEW.status:='needs_attention'; NEW.resolved_at:=NULL; END IF;
  should_route:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN should_route:=NEW.property_id IS DISTINCT FROM OLD.property_id OR (OLD.status='resolved' AND NEW.status<>'resolved'); END IF;
  IF should_route AND NEW.rating<=3 AND NEW.status<>'resolved' AND NEW.assigned_to IS NULL AND NEW.assigned_user_id IS NULL THEN
   owner_id:=public.resolve_role_owner(NEW.organization_id,NEW.property_id,'feedback',NEW.department::text,NEW.rating);
   IF owner_id IS NOT NULL THEN NEW.assigned_user_id:=owner_id; SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id=owner_id; END IF;
  END IF;
 ELSE
  IF NEW.feedback_id IS NOT NULL THEN SELECT department::text,rating INTO dept,score FROM public.feedback WHERE id=NEW.feedback_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id; END IF;
  IF TG_OP='INSERT' AND NEW.assigned_to IS NULL AND (NEW.priority IN ('high','critical') OR (NEW.feedback_id IS NOT NULL AND score<=3)) THEN
   NEW.assigned_to:=public.resolve_role_owner(NEW.organization_id,NEW.property_id,'hospitality',dept,CASE WHEN NEW.priority IN ('high','critical') THEN 1 ELSE score END);
  END IF;
 END IF;
 RETURN NEW;
END $$;
-- Run after workspace stamping and before the existing hotel relationship guard.
DROP TRIGGER IF EXISTS b_role_route ON public.feedback;
CREATE TRIGGER b_role_route BEFORE INSERT OR UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();
DROP TRIGGER IF EXISTS zy_role_route ON public.service_jobs;
CREATE TRIGGER zy_role_route BEFORE INSERT ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();
CREATE OR REPLACE FUNCTION public.case_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changes jsonb; raw_token text; follow_id uuid; endpoint record; auto_follow boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  changes:=jsonb_build_object('status',NEW.status,'priority',NEW.priority,'assigned_to',NEW.assigned_to,'assigned_user_id',NEW.assigned_user_id);
  IF NEW.invitation_id IS NOT NULL THEN UPDATE public.guest_invitations SET feedback_id=NEW.id WHERE id=NEW.invitation_id; END IF;
 ELSE
  changes:=(SELECT COALESCE(jsonb_object_agg(n.key,jsonb_build_object('from',o.value,'to',n.value)),'{}')
   FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o ON o.key=n.key
   WHERE n.value IS DISTINCT FROM o.value AND n.key IN ('status','assigned_to','assigned_user_id','priority','sla_deadline','resolution_notes','category'));
 END IF;
 IF changes<>'{}' THEN
  INSERT INTO public.feedback_activity(organization_id,feedback_id,actor_id,action,changes)
   VALUES(NEW.organization_id,NEW.id,auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,changes);
  FOR endpoint IN SELECT * FROM public.webhook_endpoints WHERE organization_id=NEW.organization_id AND is_active LOOP
   INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(NEW.organization_id,'webhook',
    'webhook:'||endpoint.id||':'||NEW.id||':'||NEW.updated_at,
    jsonb_build_object('endpointId',endpoint.id,'event','feedback.'||CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,'feedbackId',NEW.id,'changes',changes)) ON CONFLICT(dedup_key) DO NOTHING;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
