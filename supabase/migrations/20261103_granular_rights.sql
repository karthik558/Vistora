-- Granular view and manage permissions for Properties, Settings, Role Mapping, and Team Users
BEGIN;

-- 0. Workspace stamping trigger: ensure updates and SQL Editor queries resolve organizations gracefully
CREATE OR REPLACE FUNCTION public.stamp_workspace() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.organization_id IS NULL THEN
  IF TG_OP='UPDATE' AND OLD.organization_id IS NOT NULL THEN
   NEW.organization_id:=OLD.organization_id;
  ELSE
   NEW.organization_id:=COALESCE(public.workspace_org(), (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1));
  END IF;
 END IF;
 IF TG_TABLE_NAME='profiles' AND NEW.organization_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Workspace is required'; END IF;
 IF TG_OP='UPDATE' AND OLD.organization_id IS NOT NULL AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN RAISE EXCEPTION 'Moving records between companies is prohibited'; END IF;
 RETURN NEW;
END $$;

-- 1. Profiles management: ensure role is TEXT and allow workspace admins OR users with 'manage_users' right
DO $$ BEGIN
  ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
  ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT USING role::text;
  ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'visitor';
EXCEPTION WHEN others THEN null;
END $$;

DROP POLICY IF EXISTS profiles_manage ON public.profiles;
CREATE POLICY profiles_manage ON public.profiles FOR ALL TO authenticated
  USING(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('manage_users')))
  WITH CHECK(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('manage_users')));

-- 2. Role mappings: allow view_role_mapping / manage_role_mapping for SELECT, manage_role_mapping for mutations
DROP POLICY IF EXISTS role_mapping_admin ON public.role_mappings;
DROP POLICY IF EXISTS role_mapping_read ON public.role_mappings;
DROP POLICY IF EXISTS role_mapping_manage ON public.role_mappings;

CREATE POLICY role_mapping_read ON public.role_mappings FOR SELECT TO authenticated
  USING(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('view_role_mapping') OR public.workspace_right('manage_role_mapping')));

CREATE POLICY role_mapping_manage ON public.role_mappings FOR ALL TO authenticated
  USING(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('manage_role_mapping')))
  WITH CHECK(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('manage_role_mapping')));

CREATE OR REPLACE FUNCTION public.guard_role_mapping() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND (NOT (public.workspace_admin() OR public.workspace_right('manage_role_mapping')) OR NEW.organization_id IS DISTINCT FROM public.workspace_org()) THEN
   RAISE EXCEPTION 'Role mapping management access required' USING ERRCODE='42501';
 END IF;
 NEW.country:=trim(NEW.country); NEW.role_name:=trim(NEW.role_name);
 IF NEW.property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=NEW.property_id AND organization_id=NEW.organization_id AND is_active) THEN RAISE EXCEPTION 'Choose an active property in this company'; END IF;
 IF NEW.country<>'' AND NOT EXISTS(SELECT 1 FROM public.properties WHERE organization_id=NEW.organization_id AND lower(country)=lower(NEW.country) AND is_active) THEN RAISE EXCEPTION 'Choose a country with active properties in this company'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.organization_id=NEW.organization_id AND p.organization_id=NEW.organization_id AND m.user_id=NEW.assignee_id AND m.is_active) THEN RAISE EXCEPTION 'Choose an active company member'; END IF;
 RETURN NEW;
END $$;

-- 3. Settings: allow view_settings / manage_settings for SELECT, manage_settings for mutations
DROP POLICY IF EXISTS company_admin ON public.organization_settings;
DROP POLICY IF EXISTS settings_read ON public.organization_settings;
DROP POLICY IF EXISTS settings_manage ON public.organization_settings;

CREATE POLICY settings_read ON public.organization_settings FOR SELECT TO authenticated
  USING(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('view_settings') OR public.workspace_right('manage_settings')));

CREATE POLICY settings_manage ON public.organization_settings FOR ALL TO authenticated
  USING(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('manage_settings')))
  WITH CHECK(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('manage_settings')));

DROP POLICY IF EXISTS company_admin ON public.property_settings;
DROP POLICY IF EXISTS property_settings_read ON public.property_settings;
DROP POLICY IF EXISTS property_settings_manage ON public.property_settings;

CREATE POLICY property_settings_read ON public.property_settings FOR SELECT TO authenticated
  USING(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('view_settings') OR public.workspace_right('manage_settings')));

CREATE POLICY property_settings_manage ON public.property_settings FOR ALL TO authenticated
  USING(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('manage_settings')))
  WITH CHECK(organization_id = public.workspace_org() AND (public.workspace_admin() OR public.workspace_right('manage_settings')));

-- 4. Update create_company owner provisioning with all granular view and manage rights
CREATE OR REPLACE FUNCTION public.create_company(p_user uuid,p_name text,p_slug text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; person record;
BEGIN
 IF EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=p_user) THEN RAISE EXCEPTION 'Account already has a workspace'; END IF;
 SELECT id,email,raw_user_meta_data INTO STRICT person FROM auth.users WHERE id=p_user;
 INSERT INTO public.organizations(name,slug) VALUES(p_name,p_slug) RETURNING id INTO org;
 PERFORM public.provision_workspace_user(p_user,org,person.email,COALESCE(person.raw_user_meta_data->>'full_name','Owner'),true,'{}',ARRAY['view_feedback','manage_complaints','view_users','manage_users','view_properties','manage_properties','view_role_mapping','manage_role_mapping','manage_questionnaire','view_settings','manage_settings','export_reports','view_guest_pii','view_audit_log','import_guests','reassign_property','manage_service_jobs','org_role:super_admin']);
 UPDATE public.organization_members SET role='owner' WHERE user_id=p_user;
 INSERT INTO public.organization_settings(organization_id,settings) VALUES(org,jsonb_build_object('organizationName',p_name,'autoGuestFollowUp',true,'alertEmail',person.email));
 RETURN org;
END $$;

COMMIT;

