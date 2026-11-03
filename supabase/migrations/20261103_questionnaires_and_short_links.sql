-- Additive guest-form storage. Existing questions and pf.* links remain valid.
BEGIN;
CREATE TABLE IF NOT EXISTS public.feedback_questionnaires (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 title text NOT NULL DEFAULT 'How was your stay?' CHECK(length(title) BETWEEN 1 AND 160),
 introduction text NOT NULL DEFAULT 'Share your experience with our team.' CHECK(length(introduction)<=500),
 accent_color text NOT NULL DEFAULT '#34553e' CHECK(accent_color ~ '^#[0-9a-fA-F]{6}$'),
 is_default boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(property_id,name)
);
CREATE UNIQUE INDEX IF NOT EXISTS feedback_questionnaire_default ON public.feedback_questionnaires(property_id) WHERE is_default;
ALTER TABLE public.feedback_questions ADD COLUMN IF NOT EXISTS questionnaire_id uuid REFERENCES public.feedback_questionnaires(id);
CREATE INDEX IF NOT EXISTS feedback_questions_questionnaire ON public.feedback_questions(questionnaire_id,display_order);
CREATE TABLE IF NOT EXISTS public.guest_feedback_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id),
 token_hash text NOT NULL UNIQUE,
 room text NOT NULL DEFAULT '' CHECK(length(room)<=50),
 department text NOT NULL DEFAULT '' CHECK(length(department)<=50),
 demo boolean NOT NULL DEFAULT false,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_feedback_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_questionnaires,public.guest_feedback_links FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.feedback_questionnaires TO authenticated;
GRANT ALL ON public.feedback_questionnaires,public.guest_feedback_links TO service_role;
DROP POLICY IF EXISTS questionnaires_read ON public.feedback_questionnaires;
CREATE POLICY questionnaires_read ON public.feedback_questionnaires FOR SELECT TO authenticated
 USING(organization_id=public.workspace_org() AND public.workspace_module('feedback') AND public.workspace_right('manage_questionnaire') AND public.workspace_property(property_id));
DROP POLICY IF EXISTS questionnaires_manage ON public.feedback_questionnaires;
CREATE POLICY questionnaires_manage ON public.feedback_questionnaires FOR ALL TO authenticated
 USING(organization_id=public.workspace_org() AND public.workspace_module('feedback') AND public.workspace_right('manage_questionnaire') AND public.workspace_property(property_id))
 WITH CHECK(organization_id=public.workspace_org() AND public.workspace_module('feedback') AND public.workspace_right('manage_questionnaire') AND public.workspace_property(property_id));
DROP TRIGGER IF EXISTS stamp_workspace_trigger ON public.feedback_questionnaires;
CREATE TRIGGER stamp_workspace_trigger BEFORE INSERT OR UPDATE ON public.feedback_questionnaires FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace();
DROP TRIGGER IF EXISTS workspace_links_trigger ON public.feedback_questionnaires;
CREATE TRIGGER workspace_links_trigger BEFORE INSERT OR UPDATE ON public.feedback_questionnaires FOR EACH ROW EXECUTE FUNCTION public.check_workspace_links();
DROP TRIGGER IF EXISTS stamp_workspace_trigger ON public.guest_feedback_links;
CREATE TRIGGER stamp_workspace_trigger BEFORE INSERT OR UPDATE ON public.guest_feedback_links FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace();
DROP TRIGGER IF EXISTS workspace_links_trigger ON public.guest_feedback_links;
CREATE TRIGGER workspace_links_trigger BEFORE INSERT OR UPDATE ON public.guest_feedback_links FOR EACH ROW EXECUTE FUNCTION public.check_workspace_links();
CREATE OR REPLACE FUNCTION public.guard_guest_form_property() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN RAISE EXCEPTION 'A guest form or link cannot move between properties' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guest_form_property_guard ON public.feedback_questionnaires;
CREATE TRIGGER guest_form_property_guard BEFORE UPDATE ON public.feedback_questionnaires FOR EACH ROW EXECUTE FUNCTION public.guard_guest_form_property();
DROP TRIGGER IF EXISTS guest_form_property_guard ON public.guest_feedback_links;
CREATE TRIGGER guest_form_property_guard BEFORE UPDATE ON public.guest_feedback_links FOR EACH ROW EXECUTE FUNCTION public.guard_guest_form_property();
CREATE OR REPLACE FUNCTION public.guard_questionnaire_question() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.questionnaire_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.feedback_questionnaires q WHERE q.id=NEW.questionnaire_id AND q.organization_id=NEW.organization_id AND q.property_id=NEW.property_id) THEN
  RAISE EXCEPTION 'Question must belong to its questionnaire property' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS questionnaire_question_guard ON public.feedback_questions;
CREATE TRIGGER questionnaire_question_guard BEFORE INSERT OR UPDATE ON public.feedback_questions FOR EACH ROW EXECUTE FUNCTION public.guard_questionnaire_question();
DROP POLICY IF EXISTS questions_manage ON public.feedback_questions;
CREATE POLICY questions_manage ON public.feedback_questions FOR ALL TO authenticated
 USING(organization_id=public.workspace_org() AND public.workspace_right('manage_questionnaire') AND (public.workspace_admin() OR (property_id IS NOT NULL AND public.workspace_property(property_id))))
 WITH CHECK(organization_id=public.workspace_org() AND public.workspace_right('manage_questionnaire') AND (public.workspace_admin() OR (property_id IS NOT NULL AND public.workspace_property(property_id))));
CREATE OR REPLACE FUNCTION public.select_guest_questionnaire(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE form public.feedback_questionnaires;
BEGIN
 SELECT * INTO form FROM public.feedback_questionnaires WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Questionnaire not found or access denied' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('guest-questionnaire:'||form.property_id,0));
 UPDATE public.feedback_questionnaires SET is_default=false WHERE property_id=form.property_id AND is_default;
 UPDATE public.feedback_questionnaires SET is_default=true WHERE id=form.id RETURNING * INTO form;
 IF NOT FOUND THEN RAISE EXCEPTION 'Questionnaire no longer available'; END IF;
 RETURN to_jsonb(form);
END $$;
REVOKE ALL ON FUNCTION public.select_guest_questionnaire(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.select_guest_questionnaire(uuid) TO authenticated;
-- Preserve existing forms as independent property questionnaires. Original
-- question IDs and historical answers are retained; each property gets a copy.
-- BEGIN LEGACY FORM BACKFILL
WITH created AS (
 INSERT INTO public.feedback_questionnaires(organization_id,property_id,name,title,introduction,is_default)
 SELECT p.organization_id,p.id,'Guest feedback','How did we make you feel?','Your perspective helps our hospitality team tailor every arrival.',true
 FROM public.properties p
 WHERE NOT EXISTS(SELECT 1 FROM public.feedback_questionnaires f WHERE f.property_id=p.id)
 AND EXISTS(SELECT 1 FROM public.feedback_questions q WHERE q.organization_id=p.organization_id AND q.questionnaire_id IS NULL AND (q.property_id IS NULL OR q.property_id=p.id))
 RETURNING id,organization_id,property_id
)
INSERT INTO public.feedback_questions(organization_id,property_id,questionnaire_id,question_text,question_type,options,translations,department,is_required,display_order,is_active)
SELECT f.organization_id,f.property_id,f.id,q.question_text,q.question_type,q.options,q.translations,q.department,q.is_required,q.display_order,q.is_active
FROM created f JOIN public.feedback_questions q ON q.organization_id=f.organization_id AND q.questionnaire_id IS NULL AND (q.property_id IS NULL OR q.property_id=f.property_id);
-- END LEGACY FORM BACKFILL
COMMIT;
