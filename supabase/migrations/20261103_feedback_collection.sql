-- Additive: collection status is derived from real feedback, and missed checkouts
-- use existing service_jobs/source_key/resolution_notes. No new tables or data deletion.
BEGIN;
ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;
CREATE INDEX IF NOT EXISTS feedback_stay_collection ON public.feedback(organization_id,stay_id,created_at) WHERE stay_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.stamp_stay_checkout_time() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.status='checked_out' AND OLD.status='active' THEN NEW.checked_out_at:=now();
 ELSIF TG_OP='INSERT' OR NEW.status<>'checked_out' THEN NEW.checked_out_at:=NULL;
 ELSE NEW.checked_out_at:=OLD.checked_out_at; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_stay_checkout_time BEFORE INSERT OR UPDATE ON public.stays
FOR EACH ROW EXECUTE FUNCTION public.stamp_stay_checkout_time();

-- Private helper used only by the checkout trigger and the authorized review RPC.
CREATE OR REPLACE FUNCTION public.ensure_checkout_feedback_job(p_stay uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.stays; owner_id uuid; job_id uuid; minutes integer;
BEGIN
 SELECT * INTO s FROM public.stays WHERE id=p_stay FOR UPDATE;
 IF NOT FOUND OR s.status<>'checked_out' THEN RAISE EXCEPTION 'Choose a checked-out stay'; END IF;
 IF EXISTS(SELECT 1 FROM public.feedback WHERE organization_id=s.organization_id AND stay_id=s.id) THEN RAISE EXCEPTION 'Feedback has already been collected for this stay'; END IF;
 SELECT id INTO job_id FROM public.service_jobs WHERE organization_id=s.organization_id AND source_key='feedback-checkout:'||s.id;
 IF FOUND THEN RETURN job_id; END IF;
 owner_id:=public.resolve_role_owner(s.organization_id,s.property_id,'hospitality','Front Desk',5);
 IF owner_id IS NULL THEN
  SELECT p.id INTO owner_id FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id AND p.organization_id=m.organization_id
  WHERE m.organization_id=s.organization_id AND m.is_active AND m.role IN ('owner','admin')
  ORDER BY (m.role='owner') DESC,p.id LIMIT 1;
 END IF;
 SELECT coalesce((settings->'hospitality'->>'taskResponseMinutes')::integer,120) INTO minutes FROM public.organization_settings WHERE organization_id=s.organization_id;
 INSERT INTO public.service_jobs(organization_id,property_id,room_id,kind,title,description,department,location,guest_name,priority,due_at,assigned_to,created_by,source_key)
 VALUES(s.organization_id,s.property_id,s.room_id,'guest_request','Feedback missing at checkout',
  'Guest checked out without a saved feedback response. Management must record why feedback was missed and the follow-up outcome. Stay: '||s.id,
  'Front Desk','Room '||s.room_number,coalesce((SELECT full_name FROM public.guests WHERE id=s.guest_id),''),'normal',
  now()+make_interval(mins=>coalesce(minutes,120)),owner_id,
  CASE WHEN EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND organization_id=s.organization_id) THEN auth.uid() END,
  'feedback-checkout:'||s.id)
 ON CONFLICT(organization_id,source_key) WHERE source_key IS NOT NULL DO NOTHING RETURNING id INTO job_id;
 IF job_id IS NULL THEN SELECT id INTO job_id FROM public.service_jobs WHERE organization_id=s.organization_id AND source_key='feedback-checkout:'||s.id; END IF;
 RETURN job_id;
END $$;
REVOKE ALL ON FUNCTION public.ensure_checkout_feedback_job(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.queue_checkout_feedback_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.feedback WHERE organization_id=NEW.organization_id AND stay_id=NEW.id) THEN
  PERFORM public.ensure_checkout_feedback_job(NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_checkout_feedback_review AFTER UPDATE OF status ON public.stays
FOR EACH ROW WHEN (OLD.status='active' AND NEW.status='checked_out') EXECUTE FUNCTION public.queue_checkout_feedback_review();

CREATE OR REPLACE FUNCTION public.guard_checkout_feedback_resolution() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.source_key LIKE 'feedback-checkout:%' AND NEW.status IN ('completed','cancelled') AND coalesce(length(trim(NEW.resolution_notes)),0)=0 THEN
  RAISE EXCEPTION 'Record why feedback was missed and the follow-up outcome before closing this review';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER checkout_feedback_resolution BEFORE UPDATE ON public.service_jobs
FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_feedback_resolution();

-- If a response that was already in flight arrives at checkout, it resolves the
-- automatically-created review with an explicit outcome, rather than leaving a false alert.
CREATE OR REPLACE FUNCTION public.close_checkout_review_on_feedback() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.stay_id IS NOT NULL THEN
  PERFORM 1 FROM public.stays WHERE id=NEW.stay_id FOR UPDATE;
  UPDATE public.service_jobs SET status='completed',resolution_notes='Guest feedback was received after checkout; response '||NEW.id
  WHERE organization_id=NEW.organization_id AND source_key='feedback-checkout:'||NEW.stay_id AND status IN ('open','in_progress');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_feedback_checkout_review AFTER INSERT ON public.feedback
FOR EACH ROW EXECUTE FUNCTION public.close_checkout_review_on_feedback();

CREATE OR REPLACE FUNCTION public.feedback_checkout_followup(p_stay uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.stays;
BEGIN
 SELECT * INTO s FROM public.stays WHERE id=p_stay AND organization_id=public.workspace_org();
 IF NOT FOUND OR NOT public.workspace_module('feedback') OR NOT public.workspace_right('view_feedback') OR NOT public.workspace_property(s.property_id) THEN
  RAISE EXCEPTION 'Feedback and assigned property access required' USING ERRCODE='42501';
 END IF;
 PERFORM public.ops_assert_property(s.property_id,'Front Desk',true);
 RETURN public.ensure_checkout_feedback_job(s.id);
END $$;
REVOKE ALL ON FUNCTION public.feedback_checkout_followup(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.feedback_checkout_followup(uuid) TO authenticated;

-- A global collection flag prevents a departmental reader from incorrectly
-- labelling a stay as uncollected just because its response belongs to another department.
-- Only metadata is returned; tokens, response text and contact details stay private.
CREATE OR REPLACE FUNCTION public.feedback_collection_directory(p_day date DEFAULT NULL,p_status text DEFAULT 'pending') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.workspace_org(); can_take boolean; can_review boolean; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.workspace_module('feedback') OR NOT public.workspace_right('view_feedback') THEN
  RAISE EXCEPTION 'Feedback directory permission required' USING ERRCODE='42501';
 END IF;
 IF p_status NOT IN ('pending','collected','missed','reviewed','all') OR p_status IS NULL THEN RAISE EXCEPTION 'Choose a valid collection status'; END IF;
 can_take:=public.workspace_admin() OR public.workspace_right('view_guest_pii');
 can_review:=public.workspace_module('hospitality') AND public.hotel_enabled('operations') AND (public.workspace_admin() OR (public.workspace_right('manage_service_jobs') AND public.workspace_department('Front Desk')));
 WITH records AS (
  SELECT s.*,p.name AS property_name,p.timezone,g.full_name,
   f.total,f.latest_at,f.day_total,
   j.id AS job_id,j.status AS job_status,j.resolution_notes,j.assigned_to,assignee.full_name AS assigned_name,
   CASE WHEN f.total>0 THEN 'collected' WHEN s.status='active' THEN 'pending'
    WHEN j.status IN ('completed','cancelled') AND length(trim(j.resolution_notes))>0 THEN 'reviewed' ELSE 'missed' END AS collection_status
  FROM public.stays s JOIN public.properties p ON p.id=s.property_id AND p.organization_id=org
  JOIN public.guests g ON g.id=s.guest_id AND g.organization_id=org
  LEFT JOIN LATERAL (
   SELECT count(*) AS total,max(created_at) AS latest_at,
    count(*) FILTER (WHERE p_day IS NULL OR timezone(coalesce(p.timezone,'UTC'),created_at)::date=p_day) AS day_total
   FROM public.feedback WHERE organization_id=org AND stay_id=s.id
  ) f ON true
  LEFT JOIN public.service_jobs j ON j.organization_id=org AND j.source_key='feedback-checkout:'||s.id
  LEFT JOIN public.profiles assignee ON assignee.id=j.assigned_to AND assignee.organization_id=org
  WHERE s.organization_id=org AND public.workspace_property(s.property_id) AND s.status IN ('active','checked_out')
 ), filtered AS (
  SELECT * FROM records WHERE (p_status='all' OR collection_status=p_status)
   AND (p_day IS NULL OR
    (collection_status='pending' AND check_in_date<=p_day) OR
    (collection_status='collected' AND day_total>0) OR
    (collection_status IN ('missed','reviewed') AND timezone(coalesce(timezone,'UTC'),checked_out_at)::date=p_day))
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'propertyId',property_id,'propertyName',property_name,
  'guestName',CASE WHEN can_take THEN full_name ELSE 'Guest' END,'roomNumber',room_number,
  'checkIn',check_in_date,'checkOut',check_out_date,'checkedOutAt',checked_out_at,
  'feedbackCount',total,'latestFeedbackAt',latest_at,'collectionStatus',collection_status,
  'canReviewFollowup',can_review AND (public.workspace_admin() OR assigned_to=auth.uid()),
  'followup',CASE WHEN can_review AND job_id IS NOT NULL THEN jsonb_build_object('id',job_id,'status',job_status,'resolutionNotes',resolution_notes,'assignedName',assigned_name) END
 ) ORDER BY room_number,id),'[]'::jsonb) INTO result FROM filtered;
 RETURN jsonb_build_object('success',true,'guests',result,'canTakeFeedback',can_take);
END $$;
REVOKE ALL ON FUNCTION public.feedback_collection_directory(date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.feedback_collection_directory(date,text) TO authenticated;
COMMIT;
