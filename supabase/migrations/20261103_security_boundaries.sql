-- Apply after 20261103_granular_rights.sql and 20261103_feedback_collection.sql.
-- No records are removed. Delegated user management continues through the
-- server's provision_workspace_user RPC, which validates the caller's authority.
BEGIN;
-- New signups must remain unassigned until an authenticated onboarding or
-- invitation flow explicitly grants membership. Never infer the first company.
CREATE OR REPLACE FUNCTION public.stamp_workspace() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='profiles' AND TG_OP='INSERT' AND NEW.organization_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.organization_id IS NULL THEN
  IF TG_OP='UPDATE' AND OLD.organization_id IS NOT NULL THEN NEW.organization_id:=OLD.organization_id;
  ELSE NEW.organization_id:=public.workspace_org(); END IF;
 END IF;
 IF TG_TABLE_NAME='profiles' AND NEW.organization_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Workspace is required'; END IF;
 IF TG_OP='UPDATE' AND OLD.organization_id IS NOT NULL AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN RAISE EXCEPTION 'Moving records between companies is prohibited'; END IF;
 RETURN NEW;
END $$;

DROP POLICY IF EXISTS profiles_manage ON public.profiles;
CREATE POLICY profiles_manage ON public.profiles FOR ALL TO authenticated
 USING(organization_id=public.workspace_org() AND public.workspace_admin())
 WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
DROP POLICY IF EXISTS properties_manage ON public.properties;
CREATE POLICY properties_manage ON public.properties FOR ALL TO authenticated
 USING(organization_id=public.workspace_org() AND public.workspace_admin())
 WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
DROP POLICY IF EXISTS settings_manage ON public.organization_settings;
CREATE POLICY settings_manage ON public.organization_settings FOR ALL TO authenticated
 USING(organization_id=public.workspace_org() AND public.workspace_admin())
 WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
DROP POLICY IF EXISTS property_settings_manage ON public.property_settings;
CREATE POLICY property_settings_manage ON public.property_settings FOR ALL TO authenticated
 USING(organization_id=public.workspace_org() AND public.workspace_admin())
 WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
DROP POLICY IF EXISTS role_mapping_manage ON public.role_mappings;
CREATE POLICY role_mapping_manage ON public.role_mappings FOR ALL TO authenticated
 USING(organization_id=public.workspace_org() AND public.workspace_right('manage_role_mapping') AND (public.workspace_admin() OR (property_id IS NOT NULL AND public.workspace_property(property_id))))
 WITH CHECK(organization_id=public.workspace_org() AND public.workspace_right('manage_role_mapping') AND (public.workspace_admin() OR (property_id IS NOT NULL AND public.workspace_property(property_id))));

-- Keep all supported delivery types: routing a low guest rating must not fail
-- because the guest-message migration removed escalation job types.
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check
 CHECK(kind IN ('sla','followup','invitation','team_invitation','report','webhook','asset_cleanup','operations_alert','role_assignment','guest_message'));

-- Revalidate one-time links while holding their row lock. The response and
-- invitation completion are committed together with the questionnaire answers.
CREATE OR REPLACE FUNCTION public.submit_guest_feedback(p_feedback jsonb,p_answers jsonb DEFAULT '[]') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.feedback; answer jsonb; inv public.guest_invitations; stay public.stays;
 org uuid:=(p_feedback->>'organization_id')::uuid;
 prop uuid:=(p_feedback->>'property_id')::uuid;
BEGIN
 IF org IS NULL OR prop IS NULL OR NOT EXISTS(SELECT 1 FROM public.properties WHERE id=prop AND organization_id=org AND is_active) THEN
  RAISE EXCEPTION 'An active property is required' USING ERRCODE='42501';
 END IF;
 IF p_feedback->>'invitation_id' IS NOT NULL THEN
  SELECT * INTO inv FROM public.guest_invitations WHERE id=(p_feedback->>'invitation_id')::uuid AND organization_id=org AND property_id=prop FOR UPDATE;
  IF NOT FOUND OR inv.status<>'pending' OR inv.expires_at IS NULL OR inv.expires_at<=now() THEN
   RAISE EXCEPTION 'Invitation is unavailable or already used' USING ERRCODE='23505';
  END IF;
 END IF;
 IF p_feedback->>'stay_id' IS NOT NULL THEN
  SELECT * INTO stay FROM public.stays WHERE id=(p_feedback->>'stay_id')::uuid AND organization_id=org AND property_id=prop FOR UPDATE;
  -- The public API checks active status before this service-only RPC. A
  -- response already in flight may commit just after checkout, as before.
  IF NOT FOUND OR stay.status NOT IN ('active','checked_out') THEN RAISE EXCEPTION 'Stay is no longer available' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.feedback WHERE organization_id=org AND stay_id=stay.id) THEN
   RAISE EXCEPTION 'Feedback already collected for this stay' USING ERRCODE='23505';
  END IF;
 END IF;
 INSERT INTO public.feedback(organization_id,property_id,stay_id,invitation_id,recommendation_score,guest_name,guest_email,guest_phone,room_number,department,rating,comment,wants_contact,contact_preference,status,tone,resolved_at,resolution_notes)
 VALUES(org,prop,(p_feedback->>'stay_id')::uuid,(p_feedback->>'invitation_id')::uuid,(p_feedback->>'recommendation_score')::smallint,
 p_feedback->>'guest_name',p_feedback->>'guest_email',p_feedback->>'guest_phone',p_feedback->>'room_number',(p_feedback->>'department')::department_type,(p_feedback->>'rating')::smallint,p_feedback->>'comment',
 COALESCE((p_feedback->>'wants_contact')::boolean,false),p_feedback->>'contact_preference',(p_feedback->>'status')::feedback_status,(p_feedback->>'tone')::feedback_tone,(p_feedback->>'resolved_at')::timestamptz,p_feedback->>'resolution_notes') RETURNING * INTO row;
 FOR answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
  INSERT INTO public.feedback_answers(organization_id,feedback_id,question_id,question_text,answer_value)
  VALUES(row.organization_id,row.id,(answer->>'questionId')::uuid,answer->>'questionText',answer->>'answerValue');
 END LOOP;
 IF inv.id IS NOT NULL THEN
  UPDATE public.guest_invitations SET status='completed',completed_at=now(),feedback_rating=row.rating,feedback_id=row.id WHERE id=inv.id;
 END IF;
 RETURN to_jsonb(row);
END $$;
REVOKE ALL ON FUNCTION public.submit_guest_feedback(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guest_feedback(jsonb,jsonb) TO service_role;
COMMIT;
