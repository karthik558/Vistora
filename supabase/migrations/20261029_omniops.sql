-- OmniOps: additive extension of schema.sql through section 27. No destructive reset.
BEGIN;
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS guest_name text NOT NULL DEFAULT '' CHECK(length(guest_name)<=100);
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS resolution_notes text NOT NULL DEFAULT '' CHECK(length(resolution_notes)<=2000);
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS asset_id uuid;
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS source_key text;
CREATE UNIQUE INDEX IF NOT EXISTS ops_job_source ON public.service_jobs(organization_id,source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ops_job_department ON public.service_jobs(organization_id,property_id,department,status,due_at);

CREATE TABLE IF NOT EXISTS public.ops_assets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id),room_id uuid REFERENCES public.hotel_rooms(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),category text NOT NULL CHECK(category IN ('HVAC','Boiler','Elevator','Electrical','Plumbing','Other')),
 location text NOT NULL CHECK(length(trim(location)) BETWEEN 1 AND 100),serial_number text NOT NULL DEFAULT '' CHECK(length(serial_number)<=100),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','out_of_service','retired')),created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ops_job_asset') THEN
 ALTER TABLE public.service_jobs ADD CONSTRAINT ops_job_asset FOREIGN KEY(asset_id) REFERENCES public.ops_assets(id); END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.maintenance_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 asset_id uuid NOT NULL REFERENCES public.ops_assets(id),title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
 interval_days integer NOT NULL CHECK(interval_days BETWEEN 1 AND 366),next_due_at timestamptz NOT NULL,
 assigned_to uuid REFERENCES public.profiles(id),is_active boolean NOT NULL DEFAULT true,last_job_id uuid REFERENCES public.service_jobs(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.luggage_logs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 stay_id uuid NOT NULL REFERENCES public.stays(id),pieces integer NOT NULL CHECK(pieces BETWEEN 1 AND 50),storage_location text NOT NULL CHECK(length(trim(storage_location)) BETWEEN 1 AND 100),
 status text NOT NULL DEFAULT 'stored' CHECK(status IN ('stored','requested','in_transit','delivered')),verification text CHECK(length(verification)<=160),delivered_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.valet_tickets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 stay_id uuid NOT NULL REFERENCES public.stays(id),registration text NOT NULL CHECK(length(trim(registration)) BETWEEN 1 AND 30),parking_bay text NOT NULL CHECK(length(trim(parking_bay)) BETWEEN 1 AND 40),
 status text NOT NULL DEFAULT 'parked' CHECK(status IN ('parked','requested','retrieving','returned')),verification text CHECK(length(verification)<=160),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.breakfast_attendance(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 stay_id uuid NOT NULL REFERENCES public.stays(id),service_date date NOT NULL,guest_count integer NOT NULL CHECK(guest_count BETWEEN 1 AND 20),
 cleaning_job_id uuid REFERENCES public.service_jobs(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(stay_id,service_date)
);
CREATE TABLE IF NOT EXISTS public.minibar_catalog(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),price_minor integer NOT NULL CHECK(price_minor BETWEEN 0 AND 10000000),currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 par_level integer NOT NULL DEFAULT 2 CHECK(par_level BETWEEN 1 AND 100),is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.room_cleaning_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 job_id uuid NOT NULL UNIQUE REFERENCES public.service_jobs(id),room_id uuid NOT NULL REFERENCES public.hotel_rooms(id),staff_id uuid NOT NULL REFERENCES public.profiles(id),
 linen_changed boolean NOT NULL,amenities_restocked boolean NOT NULL,minibar jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),CHECK(linen_changed AND amenities_restocked)
);
ALTER TABLE public.room_cleaning_runs ADD COLUMN IF NOT EXISTS minibar_restocked boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.folio_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 stay_id uuid NOT NULL REFERENCES public.stays(id),source_key text NOT NULL,description text NOT NULL CHECK(length(description) BETWEEN 1 AND 300),
 amount_minor integer NOT NULL CHECK(amount_minor BETWEEN -10000000 AND 10000000),currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','posted')),approved_by uuid REFERENCES public.profiles(id),external_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,source_key)
);
CREATE TABLE IF NOT EXISTS public.incident_compensations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 job_id uuid NOT NULL REFERENCES public.service_jobs(id),stay_id uuid NOT NULL REFERENCES public.stays(id),kind text NOT NULL CHECK(kind IN ('amenity_credit','room_discount')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 1000),amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 10000000),
 folio_entry_id uuid REFERENCES public.folio_entries(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.inspection_templates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),checks jsonb NOT NULL CHECK(jsonb_typeof(checks)='array' AND jsonb_array_length(checks) BETWEEN 1 AND 30),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.room_inspections ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE public.room_inspections ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.inspection_templates(id);
ALTER TABLE public.room_inspections ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '' CHECK(length(location)<=100);
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS inspection_id uuid REFERENCES public.room_inspections(id);
CREATE TABLE IF NOT EXISTS public.inspection_evidence(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 inspection_id uuid REFERENCES public.room_inspections(id),object_path text NOT NULL UNIQUE CHECK(length(object_path)<=500),check_label text NOT NULL CHECK(length(check_label) BETWEEN 1 AND 200),
 uploaded_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.telephony_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 stay_id uuid NOT NULL REFERENCES public.stays(id),kind text NOT NULL CHECK(kind IN ('call','wake_up','voicemail')),
 scheduled_at timestamptz, duration_seconds integer CHECK(duration_seconds BETWEEN 1 AND 86400),destination text NOT NULL DEFAULT '' CHECK(length(destination)<=100),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','due','completed','cancelled')),
 job_id uuid REFERENCES public.service_jobs(id),created_at timestamptz NOT NULL DEFAULT now(),CHECK(kind<>'wake_up' OR scheduled_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.guest_service_links(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 stay_id uuid NOT NULL REFERENCES public.stays(id),token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.guest_service_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 link_id uuid NOT NULL REFERENCES public.guest_service_links(id),request_id uuid NOT NULL,service text NOT NULL CHECK(service IN ('towels','toiletries','room_service','baggage','valet')),
 job_id uuid REFERENCES public.service_jobs(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(link_id,request_id)
);
CREATE TABLE IF NOT EXISTS public.audit_trails(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 actor_id uuid REFERENCES auth.users(id),entity_type text NOT NULL,entity_id uuid NOT NULL,action text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ops_breakfast_webhooks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),property_id uuid NOT NULL REFERENCES public.properties(id),
 endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id),is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(property_id,endpoint_id)
);
CREATE TABLE IF NOT EXISTS public.ops_commands(
 id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES auth.users(id),result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,id)
);
CREATE TABLE IF NOT EXISTS public.ops_push_subscriptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id),user_id uuid NOT NULL REFERENCES public.profiles(id),
 endpoint text NOT NULL UNIQUE,subscription jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ops_push_deliveries(
 subscription_id uuid NOT NULL REFERENCES public.ops_push_subscriptions(id) ON DELETE CASCADE,job_id uuid NOT NULL REFERENCES public.service_jobs(id) ON DELETE CASCADE,
 routing_cycle uuid NOT NULL,escalation_level integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(subscription_id,job_id,routing_cycle,escalation_level)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ops_assets','maintenance_tasks','luggage_logs','valet_tickets','breakfast_attendance','minibar_catalog','room_cleaning_runs','folio_entries','incident_compensations','inspection_templates','inspection_evidence','telephony_events','audit_trails','ops_breakfast_webhooks'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id,property_id,created_at DESC)',t||'_scope',t);
  EXECUTE format('DROP POLICY IF EXISTS ops_read ON public.%I',t);
  EXECUTE format('CREATE POLICY ops_read ON public.%I FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_module(''hospitality'') AND public.workspace_property(property_id) AND public.hotel_enabled(''operations'') %s)',t,CASE WHEN t IN ('folio_entries','incident_compensations','ops_breakfast_webhooks') THEN 'AND public.workspace_admin()' ELSE '' END);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['guest_service_links','guest_service_requests','ops_commands','ops_push_subscriptions','ops_push_deliveries'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS ops_maintenance_due ON public.maintenance_tasks(next_due_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS ops_wakeup_due ON public.telephony_events(scheduled_at) WHERE status='scheduled' AND kind='wake_up';
CREATE INDEX IF NOT EXISTS ops_evidence_inspection ON public.inspection_evidence(inspection_id);
CREATE INDEX IF NOT EXISTS ops_links_stay ON public.guest_service_links(stay_id);
CREATE OR REPLACE FUNCTION public.omniops_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.omniops_ready() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.omniops_ready() TO authenticated,service_role;

-- Only the command function mutates extension records. Reads and WebSockets use caller RLS.
CREATE OR REPLACE FUNCTION public.ops_assert_property(pid uuid,dept text DEFAULT NULL,write_access boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.workspace_org();
BEGIN
 IF auth.uid() IS NULL OR org IS NULL OR NOT public.workspace_module('hospitality') OR NOT public.workspace_property(pid) OR NOT public.hotel_enabled('operations') THEN RAISE EXCEPTION 'Operations access requires an authorized property' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=pid AND organization_id=org AND is_active) THEN RAISE EXCEPTION 'Choose an active property'; END IF;
 IF write_access AND NOT public.workspace_admin() AND (NOT public.workspace_right('manage_service_jobs') OR (dept IS NOT NULL AND NOT public.workspace_department(dept))) THEN RAISE EXCEPTION 'Department operations permission required' USING ERRCODE='42501'; END IF;
 RETURN org;
END $$;
REVOKE ALL ON FUNCTION public.ops_assert_property(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_assert_property(uuid,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.ops_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.audit_trails(organization_id,property_id,actor_id,entity_type,entity_id,action,details)
 VALUES(NEW.organization_id,NEW.property_id,auth.uid(),TG_TABLE_NAME,NEW.id,lower(TG_OP),jsonb_build_object('status',to_jsonb(NEW)->>'status'));
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ops_assets','maintenance_tasks','luggage_logs','valet_tickets','breakfast_attendance','room_cleaning_runs','folio_entries','incident_compensations','inspection_templates','telephony_events','service_jobs','room_inspections'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS ops_history ON public.%I',t);
  EXECUTE format('CREATE TRIGGER ops_history AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ops_audit()',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.omniops_command(p_action text,p_data jsonb,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid:=(p_data->>'property_id')::uuid;org uuid;rid uuid:=NULLIF(p_data->>'id','')::uuid;roomid uuid:=NULLIF(p_data->>'room_id','')::uuid;
 sid uuid:=NULLIF(p_data->>'stay_id','')::uuid;jid uuid:=NULLIF(p_data->>'job_id','')::uuid;aid uuid:=NULLIF(p_data->>'asset_id','')::uuid;
 result jsonb;existing jsonb;t text;dept text;st public.stays;j public.service_jobs;entry record;item jsonb;qty integer;price public.minibar_catalog;unit_ids uuid[]:='{}';currency_code text;newid uuid;due timestamptz;total integer;cfg jsonb;next_status text:=p_data->>'status';
BEGIN
 IF pg_column_size(p_data)>32768 THEN RAISE EXCEPTION 'Operation payload is too large'; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 SELECT c.result INTO result FROM public.ops_commands c WHERE actor_id=auth.uid() AND id=p_request_id;
 IF FOUND THEN RETURN result; END IF;
 dept:=CASE WHEN p_action='breakfast' THEN CASE WHEN public.workspace_department('Food & Beverage') THEN 'Food & Beverage' ELSE 'Front Desk' END WHEN p_action IN ('telephony','guest_link') THEN 'Front Desk' WHEN p_action IN ('luggage','luggage_status') THEN 'Concierge' WHEN p_action IN ('valet','valet_status') THEN 'Valet & Transfers' WHEN p_action='cleaning' THEN 'Housekeeping' WHEN p_action IN ('asset','maintenance','maintenance_toggle') THEN 'Engineering' ELSE NULL END;
 org:=public.ops_assert_property(pid,dept,true);
 SELECT settings->'hospitality' INTO cfg FROM public.organization_settings WHERE organization_id=org;
 currency_code:=COALESCE(cfg->>'currency','INR');
 IF p_action IN ('asset','maintenance','maintenance_toggle','catalog','compensation','folio_status','template','inspection','evidence','guest_link','breakfast_webhook') AND NOT public.workspace_admin() THEN RAISE EXCEPTION 'Company administrator required' USING ERRCODE='42501'; END IF;
 IF p_action IN ('inspection','template','evidence') AND NOT public.hotel_enabled('compliance') THEN RAISE EXCEPTION 'Inspections are disabled' USING ERRCODE='42501'; END IF;
 IF roomid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hotel_rooms WHERE id=roomid AND organization_id=org AND property_id=pid) THEN RAISE EXCEPTION 'Room is outside this property'; END IF;
 IF aid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ops_assets WHERE id=aid AND organization_id=org AND property_id=pid AND status='active') THEN RAISE EXCEPTION 'Choose an active asset in this property'; END IF;
 IF sid IS NOT NULL THEN
  SELECT * INTO st FROM public.stays WHERE id=sid AND organization_id=org AND property_id=pid FOR UPDATE;
  IF NOT FOUND OR st.status<>'active' THEN RAISE EXCEPTION 'Choose an active stay in this property'; END IF;
 END IF;
 IF jid IS NOT NULL THEN
  SELECT * INTO j FROM public.service_jobs WHERE id=jid AND organization_id=org AND property_id=pid FOR UPDATE;
  IF NOT FOUND OR NOT public.workspace_department(j.department) THEN RAISE EXCEPTION 'Job is outside your authorized scope' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_action='job_create' THEN
  dept:=p_data->>'department';
  IF dept NOT IN ('Housekeeping','Engineering','Front Desk','Concierge','Food & Beverage','Valet & Transfers','IT') OR NOT public.workspace_department(dept) THEN RAISE EXCEPTION 'Choose an authorized department' USING ERRCODE='42501'; END IF;
  due:=COALESCE(NULLIF(p_data->>'due_at','')::timestamptz,now()+make_interval(mins=>COALESCE((cfg->>'taskResponseMinutes')::integer,120)));
  IF due<=now() OR due>now()+interval '7 days' THEN RAISE EXCEPTION 'Deadline must be within the next seven days'; END IF;
  IF NULLIF(p_data->>'assigned_to','') IS NOT NULL AND NOT public.role_member_eligible((p_data->>'assigned_to')::uuid,org,pid,'hospitality',dept) THEN RAISE EXCEPTION 'Assignee needs active department access'; END IF;
  IF roomid IS NULL AND COALESCE(length(trim(p_data->>'location')),0)=0 THEN RAISE EXCEPTION 'Choose a room or enter a public area'; END IF;
  IF NULLIF(p_data->>'feedback_id','') IS NOT NULL AND (NOT public.workspace_right('view_feedback') OR NOT EXISTS(SELECT 1 FROM public.feedback f WHERE f.id=(p_data->>'feedback_id')::uuid AND f.organization_id=org AND f.property_id=pid AND public.workspace_department(f.department::text))) THEN RAISE EXCEPTION 'Feedback case is outside your authorized scope' USING ERRCODE='42501'; END IF;
  INSERT INTO public.service_jobs(organization_id,property_id,room_id,asset_id,feedback_id,kind,title,description,department,location,guest_name,priority,due_at,assigned_to,created_by,source_key)
  VALUES(org,pid,roomid,aid,NULLIF(p_data->>'feedback_id','')::uuid,p_data->>'kind',trim(p_data->>'title'),COALESCE(p_data->>'description',''),dept,COALESCE(p_data->>'location',''),COALESCE(p_data->>'guest_name',''),p_data->>'priority',due,NULLIF(p_data->>'assigned_to','')::uuid,auth.uid(),'ops:'||p_request_id) RETURNING id INTO rid;
 ELSIF p_action='asset' THEN
  INSERT INTO public.ops_assets(organization_id,property_id,room_id,name,category,location,serial_number) VALUES(org,pid,roomid,trim(p_data->>'name'),p_data->>'category',trim(p_data->>'location'),COALESCE(p_data->>'serial_number','')) RETURNING id INTO rid;
 ELSIF p_action='maintenance' THEN
  IF aid IS NULL THEN RAISE EXCEPTION 'Choose an asset'; END IF;
  IF NULLIF(p_data->>'assigned_to','') IS NOT NULL AND NOT public.role_member_eligible((p_data->>'assigned_to')::uuid,org,pid,'hospitality','Engineering') THEN RAISE EXCEPTION 'Assignee needs engineering access'; END IF;
  INSERT INTO public.maintenance_tasks(organization_id,property_id,asset_id,title,interval_days,next_due_at,assigned_to) VALUES(org,pid,aid,trim(p_data->>'title'),(p_data->>'interval_days')::integer,(p_data->>'next_due_at')::timestamptz,NULLIF(p_data->>'assigned_to','')::uuid) RETURNING id INTO rid;
 ELSIF p_action='maintenance_toggle' THEN
  UPDATE public.maintenance_tasks SET is_active=(p_data->>'is_active')::boolean WHERE id=rid AND organization_id=org AND property_id=pid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Maintenance schedule not found'; END IF;
 ELSIF p_action='catalog' THEN
  INSERT INTO public.minibar_catalog(organization_id,property_id,name,price_minor,currency,par_level) VALUES(org,pid,trim(p_data->>'name'),(p_data->>'price_minor')::integer,currency_code,(p_data->>'par_level')::integer) RETURNING id INTO rid;
 ELSIF p_action='luggage' THEN
  IF sid IS NULL THEN RAISE EXCEPTION 'Choose a stay'; END IF;
  INSERT INTO public.luggage_logs(organization_id,property_id,stay_id,pieces,storage_location) VALUES(org,pid,sid,(p_data->>'pieces')::integer,trim(p_data->>'storage_location')) RETURNING id INTO rid;
 ELSIF p_action='valet' THEN
  IF sid IS NULL THEN RAISE EXCEPTION 'Choose a stay'; END IF;
  INSERT INTO public.valet_tickets(organization_id,property_id,stay_id,registration,parking_bay) VALUES(org,pid,sid,upper(trim(p_data->>'registration')),trim(p_data->>'parking_bay')) RETURNING id INTO rid;
 ELSIF p_action IN ('luggage_status','valet_status','folio_status') THEN
  t:=CASE p_action WHEN 'luggage_status' THEN 'luggage_logs' WHEN 'valet_status' THEN 'valet_tickets' ELSE 'folio_entries' END;
  EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 AND organization_id=$2 AND property_id=$3 FOR UPDATE',t) INTO existing USING rid,org,pid;
  IF existing IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF p_action='luggage_status' THEN
   IF NOT ((existing->>'status'='stored' AND next_status='requested') OR (existing->>'status'='requested' AND next_status='in_transit') OR (existing->>'status'='in_transit' AND next_status='delivered')) THEN RAISE EXCEPTION 'Invalid luggage transition'; END IF;
   IF next_status='delivered' AND COALESCE(length(trim(p_data->>'verification')),0)<3 THEN RAISE EXCEPTION 'Record the recipient or delivery verification'; END IF;
   UPDATE public.luggage_logs SET status=next_status,verification=NULLIF(trim(p_data->>'verification'),''),delivered_at=CASE WHEN next_status='delivered' THEN now() END WHERE id=rid;
  ELSIF p_action='valet_status' THEN
   IF NOT ((existing->>'status'='parked' AND next_status='requested') OR (existing->>'status'='requested' AND next_status='retrieving') OR (existing->>'status'='retrieving' AND next_status='returned')) THEN RAISE EXCEPTION 'Invalid valet transition'; END IF;
   IF next_status='returned' AND COALESCE(length(trim(p_data->>'verification')),0)<3 THEN RAISE EXCEPTION 'Verify vehicle handover'; END IF;
   UPDATE public.valet_tickets SET status=next_status,verification=NULLIF(trim(p_data->>'verification'),'') WHERE id=rid;
  ELSE
   IF NOT ((existing->>'status'='pending' AND next_status IN ('approved','rejected')) OR (existing->>'status'='approved' AND next_status='posted')) THEN RAISE EXCEPTION 'Final financial decisions cannot be edited'; END IF;
   IF next_status='posted' AND COALESCE(length(trim(p_data->>'external_reference')),0)<3 THEN RAISE EXCEPTION 'Enter the PMS posting reference after confirming external posting'; END IF;
   UPDATE public.folio_entries SET status=next_status,approved_by=auth.uid(),external_reference=NULLIF(trim(p_data->>'external_reference'),'') WHERE id=rid;
  END IF;
 ELSIF p_action='breakfast_webhook' THEN
  IF NOT EXISTS(SELECT 1 FROM public.webhook_endpoints WHERE id=(p_data->>'endpoint_id')::uuid AND organization_id=org AND (is_active OR NOT COALESCE((p_data->>'is_active')::boolean,true))) THEN RAISE EXCEPTION 'Choose an active company webhook endpoint'; END IF;
  INSERT INTO public.ops_breakfast_webhooks(organization_id,property_id,endpoint_id,is_active)
  VALUES(org,pid,(p_data->>'endpoint_id')::uuid,COALESCE((p_data->>'is_active')::boolean,true))
  ON CONFLICT(property_id,endpoint_id) DO UPDATE SET is_active=excluded.is_active RETURNING id INTO rid;
 ELSIF p_action='breakfast' THEN
  IF sid IS NULL OR st.room_id IS NULL THEN RAISE EXCEPTION 'Choose an active room stay'; END IF;
  IF (p_data->>'guest_count')::integer>st.guest_count THEN RAISE EXCEPTION 'Attendance exceeds registered guest count'; END IF;
  INSERT INTO public.breakfast_attendance(organization_id,property_id,stay_id,service_date,guest_count)
  VALUES(org,pid,sid,(now() AT TIME ZONE (SELECT timezone FROM public.properties WHERE id=pid))::date,(p_data->>'guest_count')::integer) ON CONFLICT(stay_id,service_date) DO NOTHING RETURNING id INTO rid;
  IF rid IS NULL THEN RAISE EXCEPTION 'Breakfast attendance already recorded for this stay today'; END IF;
  SELECT id INTO jid FROM public.service_jobs WHERE organization_id=org AND room_id=st.room_id AND kind='cleaning' AND status IN ('open','in_progress') ORDER BY created_at LIMIT 1;
  IF jid IS NULL THEN
   INSERT INTO public.service_jobs(organization_id,property_id,room_id,kind,title,description,department,priority,created_by,due_at,source_key)
   VALUES(org,pid,st.room_id,'cleaning','Breakfast cleaning opportunity','Guest registered at breakfast. Confirm access and do-not-disturb before entry; other occupants may remain.','Housekeeping','normal',auth.uid(),now()+interval '45 minutes','breakfast:'||rid) RETURNING id INTO jid;
  END IF;
  UPDATE public.breakfast_attendance SET cleaning_job_id=jid WHERE id=rid;
 ELSIF p_action='cleaning' THEN
  IF jid IS NULL OR j.kind<>'cleaning' OR j.room_id IS NULL OR j.status NOT IN ('open','in_progress') OR (NOT public.workspace_admin() AND j.assigned_to IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Only the assigned staff member may finish an active cleaning job' USING ERRCODE='42501'; END IF;
  IF COALESCE((p_data->>'access_confirmed')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Confirm safe access before completing cleaning'; END IF;
  IF EXISTS(SELECT 1 FROM public.minibar_catalog WHERE organization_id=org AND property_id=pid AND is_active) AND NOT COALESCE((p_data->>'minibar_restocked')::boolean,false) THEN RAISE EXCEPTION 'Confirm minibar restocking to par'; END IF;
  IF jsonb_typeof(p_data->'minibar')<>'array' OR jsonb_array_length(p_data->'minibar')>50 THEN RAISE EXCEPTION 'Invalid minibar quantities'; END IF;
  INSERT INTO public.room_cleaning_runs(organization_id,property_id,job_id,room_id,staff_id,linen_changed,amenities_restocked,minibar,minibar_restocked)
  VALUES(org,pid,jid,j.room_id,auth.uid(),(p_data->>'linen_changed')::boolean,(p_data->>'amenities_restocked')::boolean,p_data->'minibar',COALESCE((p_data->>'minibar_restocked')::boolean,false)) RETURNING id INTO rid;
  SELECT * INTO st FROM public.stays WHERE room_id=j.room_id AND organization_id=org AND status='active' FOR UPDATE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_data->'minibar') LOOP
   qty:=(item->>'quantity')::integer;
   IF qty IS NULL OR qty NOT BETWEEN 0 AND 100 OR (item->>'item_id')::uuid=ANY(unit_ids) THEN RAISE EXCEPTION 'Invalid or duplicate minibar quantity'; END IF;
   unit_ids:=array_append(unit_ids,(item->>'item_id')::uuid);
   SELECT * INTO price FROM public.minibar_catalog WHERE id=(item->>'item_id')::uuid AND organization_id=org AND property_id=pid AND is_active;
   IF NOT FOUND THEN RAISE EXCEPTION 'Minibar item is unavailable'; END IF;
   IF qty>price.par_level THEN RAISE EXCEPTION 'Consumed quantity exceeds minibar par level'; END IF;
   IF qty>0 THEN
    IF st.id IS NULL THEN RAISE EXCEPTION 'Consumption billing requires an active stay'; END IF;
    INSERT INTO public.folio_entries(organization_id,property_id,stay_id,source_key,description,amount_minor,currency)
    VALUES(org,pid,st.id,'minibar:'||jid||':'||price.id,price.name||' × '||qty,price.price_minor*qty,price.currency);
   END IF;
  END LOOP;
  UPDATE public.service_jobs SET status='completed' WHERE id=jid;
 ELSIF p_action='job_resolve' THEN
  IF jid IS NULL OR j.status NOT IN ('open','in_progress') OR (j.kind='cleaning' AND j.room_id IS NOT NULL) OR (NOT public.workspace_admin() AND j.assigned_to IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Only the assigned staff member may resolve this active job' USING ERRCODE='42501'; END IF;
  IF COALESCE(length(trim(p_data->>'resolution_notes')),0) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Record how the request was resolved'; END IF;
  UPDATE public.service_jobs SET status='completed',resolution_notes=trim(p_data->>'resolution_notes') WHERE id=jid;
  rid:=jid;
 ELSIF p_action='compensation' THEN
  IF jid IS NULL OR sid IS NULL OR j.issue_type IS NULL OR (j.room_id IS NOT NULL AND j.room_id IS DISTINCT FROM st.room_id) THEN RAISE EXCEPTION 'Choose an incident and its active guest stay'; END IF;
  INSERT INTO public.incident_compensations(organization_id,property_id,job_id,stay_id,kind,reason,amount_minor)
  VALUES(org,pid,jid,sid,p_data->>'kind',trim(p_data->>'reason'),(p_data->>'amount_minor')::integer) RETURNING id INTO rid;
  INSERT INTO public.folio_entries(organization_id,property_id,stay_id,source_key,description,amount_minor,currency)
  VALUES(org,pid,sid,'compensation:'||rid,'Guest recovery: '||left(p_data->>'reason',250),-(p_data->>'amount_minor')::integer,currency_code) RETURNING id INTO newid;
  UPDATE public.incident_compensations SET folio_entry_id=newid WHERE id=rid;
 ELSIF p_action='template' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'checks') c WHERE jsonb_typeof(c)<>'string' OR length(trim(c#>>'{}')) NOT BETWEEN 1 AND 200) OR (SELECT count(DISTINCT c#>>'{}') FROM jsonb_array_elements(p_data->'checks') c)<>jsonb_array_length(p_data->'checks') THEN RAISE EXCEPTION 'Checklist labels must be unique, nonempty and at most 200 characters'; END IF;
  INSERT INTO public.inspection_templates(organization_id,property_id,name,checks) VALUES(org,pid,trim(p_data->>'name'),p_data->'checks') RETURNING id INTO rid;
 ELSIF p_action='inspection' THEN
  IF roomid IS NULL AND COALESCE(length(trim(p_data->>'location')),0)=0 THEN RAISE EXCEPTION 'Choose a room or public area'; END IF;
  INSERT INTO public.room_inspections(organization_id,property_id,room_id,inspector_id,template_id,location,answers,notes)
  VALUES(org,pid,roomid,auth.uid(),NULLIF(p_data->>'template_id','')::uuid,COALESCE(p_data->>'location',''),p_data->'answers',COALESCE(p_data->>'notes','')) RETURNING id INTO rid;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_data->'evidence_ids','[]')) LOOP
   UPDATE public.inspection_evidence SET inspection_id=rid WHERE id=(item#>>'{}')::uuid AND organization_id=org AND property_id=pid AND uploaded_by=auth.uid() AND inspection_id IS NULL
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'answers') a WHERE a->>'label'=check_label AND (a->>'passed')::boolean=false);
   IF NOT FOUND THEN RAISE EXCEPTION 'Evidence must belong to a failed inspection point in this property'; END IF;
  END LOOP;
 ELSIF p_action='evidence' THEN
  IF p_data->>'object_path' NOT LIKE org::text||'/'||pid::text||'/'||auth.uid()::text||'/%' THEN RAISE EXCEPTION 'Invalid evidence path'; END IF;
  INSERT INTO public.inspection_evidence(organization_id,property_id,object_path,check_label,uploaded_by) VALUES(org,pid,p_data->>'object_path',p_data->>'check_label',auth.uid()) RETURNING id INTO rid;
 ELSIF p_action='telephony' THEN
  IF sid IS NULL THEN RAISE EXCEPTION 'Choose an active stay'; END IF;
  IF p_data->>'kind'='wake_up' AND ((p_data->>'scheduled_at')::timestamptz<=now() OR (p_data->>'scheduled_at')::timestamptz>now()+interval '30 days') THEN RAISE EXCEPTION 'Schedule wake-up within the next 30 days'; END IF;
  INSERT INTO public.telephony_events(organization_id,property_id,stay_id,kind,scheduled_at,duration_seconds,destination,notes,status)
  VALUES(org,pid,sid,p_data->>'kind',NULLIF(p_data->>'scheduled_at','')::timestamptz,NULLIF(p_data->>'duration_seconds','')::integer,COALESCE(p_data->>'destination',''),COALESCE(p_data->>'notes',''),CASE WHEN p_data->>'kind'='call' THEN 'completed' ELSE 'scheduled' END) RETURNING id INTO rid;
  IF p_data->>'kind'='call' THEN
   IF NULLIF(p_data->>'duration_seconds','') IS NULL THEN RAISE EXCEPTION 'Call duration required'; END IF;
   total:=ceil((p_data->>'duration_seconds')::numeric/60)*COALESCE((cfg->>'callRateMinor')::integer,0);
   IF total>0 THEN INSERT INTO public.folio_entries(organization_id,property_id,stay_id,source_key,description,amount_minor,currency) VALUES(org,pid,sid,'call:'||rid,'Outgoing call · '||(p_data->>'duration_seconds')||' seconds',total,currency_code); END IF;
  ELSIF p_data->>'kind'='voicemail' THEN
   INSERT INTO public.service_jobs(organization_id,property_id,room_id,kind,title,description,department,priority,due_at,created_by,source_key)
   VALUES(org,pid,st.room_id,'guest_request','Guest voicemail',COALESCE(p_data->>'notes',''),'Front Desk','normal',now()+interval '15 minutes',auth.uid(),'voicemail:'||rid) RETURNING id INTO jid;
   UPDATE public.telephony_events SET job_id=jid,status='due' WHERE id=rid;
  END IF;
 ELSIF p_action='telephony_status' THEN
  SELECT to_jsonb(e) INTO existing FROM public.telephony_events e WHERE id=rid AND organization_id=org AND property_id=pid FOR UPDATE;
  IF existing IS NULL OR existing->>'status' NOT IN ('scheduled','due') OR next_status NOT IN ('completed','cancelled') THEN RAISE EXCEPTION 'Choose an outstanding call to complete or cancel'; END IF;
  IF NOT public.workspace_department('Front Desk') THEN RAISE EXCEPTION 'Front desk permission required' USING ERRCODE='42501'; END IF;
  UPDATE public.telephony_events SET status=next_status WHERE id=rid;
  IF existing->>'job_id' IS NOT NULL THEN
   SELECT * INTO j FROM public.service_jobs WHERE id=(existing->>'job_id')::uuid;
   IF NOT public.workspace_admin() AND j.assigned_to IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the assigned staff member can close this reminder' USING ERRCODE='42501'; END IF;
   UPDATE public.service_jobs SET status=CASE WHEN next_status='completed' THEN 'completed' ELSE 'cancelled' END WHERE id=j.id AND status IN ('open','in_progress');
  END IF;
 ELSIF p_action='guest_link' THEN
  IF sid IS NULL OR COALESCE(length(p_data->>'token_hash'),0)<>64 THEN RAISE EXCEPTION 'Invalid guest link'; END IF;
  UPDATE public.guest_service_links SET revoked_at=now() WHERE stay_id=sid AND revoked_at IS NULL;
  INSERT INTO public.guest_service_links(organization_id,property_id,stay_id,token_hash,expires_at)
  VALUES(org,pid,sid,p_data->>'token_hash',LEAST(((st.check_out_date+1)::timestamp AT TIME ZONE (SELECT timezone FROM public.properties WHERE id=pid)),now()+interval '30 days')) RETURNING id INTO rid;
 ELSE RAISE EXCEPTION 'Unknown operations command';
 END IF;
 result:=jsonb_build_object('id',rid);
 INSERT INTO public.ops_commands(id,actor_id,result) VALUES(p_request_id,auth.uid(),result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.omniops_command(text,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.omniops_command(text,jsonb,uuid) TO authenticated;

-- Preserve existing stay, room and job invariants; add versioned inspection templates.
CREATE OR REPLACE FUNCTION public.hotel_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE room public.hotel_rooms; parent_org uuid; enabled boolean; checklist jsonb; all_passed boolean; config jsonb; matched integer;
BEGIN
 IF TG_TABLE_NAME='hotel_rooms' THEN
  IF TG_OP='UPDATE' AND (NEW.organization_id,NEW.property_id,NEW.id) IS DISTINCT FROM (OLD.organization_id,OLD.property_id,OLD.id) THEN RAISE EXCEPTION 'Room identity and property cannot be changed'; END IF;
  IF NEW.status='inspected' AND (TG_OP='INSERT' OR OLD.status<>'inspected') AND (pg_trigger_depth()<2 OR NOT EXISTS(SELECT 1 FROM public.room_inspections i WHERE i.room_id=NEW.id AND i.passed AND (TG_OP='INSERT' OR i.created_at>=OLD.updated_at))) THEN RAISE EXCEPTION 'Record a passing inspection to mark a room inspected'; END IF;
  NEW.updated_at:=now(); RETURN NEW;
 END IF;
 SELECT settings->'hospitality' INTO config FROM public.organization_settings WHERE organization_id=NEW.organization_id;
 IF TG_TABLE_NAME='stays' THEN
  IF NEW.room_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO STRICT room FROM public.hotel_rooms WHERE id=NEW.room_id FOR UPDATE;
  IF room.organization_id<>NEW.organization_id OR room.property_id<>NEW.property_id THEN RAISE EXCEPTION 'Room belongs to another company or property'; END IF;
  IF NEW.guest_count>room.capacity THEN RAISE EXCEPTION 'Room capacity exceeded'; END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('checked_out','cancelled') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Closed stays are immutable'; END IF;
  IF TG_OP='UPDATE' AND OLD.status='active' AND (NEW.guest_id,NEW.room_id,NEW.property_id,NEW.check_in_date,NEW.check_out_date) IS DISTINCT FROM (OLD.guest_id,OLD.room_id,OLD.property_id,OLD.check_in_date,OLD.check_out_date) THEN RAISE EXCEPTION 'Active stay dates and guest cannot be changed'; END IF;
  IF NEW.status NOT IN ('reserved','active','checked_out','cancelled') THEN RAISE EXCEPTION 'Invalid stay status'; END IF;
  IF TG_OP='INSERT' AND NEW.status<>'reserved' THEN RAISE EXCEPTION 'Create a reservation before check-in'; END IF;
  IF TG_OP='UPDATE' AND NEW.status='checked_out' AND OLD.status<>'active' THEN RAISE EXCEPTION 'Only active stays can check out'; END IF;
  IF NEW.status IN ('reserved','active') AND room.status='out_of_service' THEN RAISE EXCEPTION 'Room is out of service'; END IF;
  IF NEW.status='active' AND (TG_OP='INSERT' OR OLD.status<>'active') THEN
   IF room.status NOT IN ('clean','inspected') OR (COALESCE((config->>'requireInspection')::boolean,true) AND room.status<>'inspected') THEN RAISE EXCEPTION 'Room must be ready and inspected before check-in'; END IF;
   IF timezone(COALESCE((SELECT timezone FROM public.properties WHERE id=NEW.property_id),'UTC'),now())::date<NEW.check_in_date OR timezone(COALESCE((SELECT timezone FROM public.properties WHERE id=NEW.property_id),'UTC'),now())::date>=NEW.check_out_date THEN RAISE EXCEPTION 'Check-in must be within the reserved dates'; END IF;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='active' AND NEW.status IN ('checked_out','cancelled') THEN
   UPDATE public.hotel_rooms SET status=CASE WHEN status='out_of_service' THEN status ELSE 'dirty' END WHERE id=NEW.room_id;
  END IF;
  NEW.room_number:=room.room_number; RETURN NEW;
 END IF;
 IF NEW.room_id IS NOT NULL THEN
  SELECT * INTO STRICT room FROM public.hotel_rooms WHERE id=NEW.room_id FOR UPDATE;
  IF room.organization_id<>NEW.organization_id OR room.property_id<>NEW.property_id THEN RAISE EXCEPTION 'Room belongs to another company or property'; END IF;
 END IF;
 IF TG_TABLE_NAME='service_jobs' THEN
  IF NEW.created_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.created_by AND organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Job creator belongs to another company'; END IF;
  IF NEW.feedback_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.feedback WHERE id=NEW.feedback_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id) THEN RAISE EXCEPTION 'Feedback belongs to another property'; END IF;
  IF NEW.assigned_to IS NOT NULL AND (TG_OP='INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) AND NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.user_id=NEW.assigned_to AND m.organization_id=NEW.organization_id AND m.is_active AND (m.role IN ('owner','admin') OR p.property_id=NEW.property_id OR NEW.property_id=ANY(p.property_ids))) THEN RAISE EXCEPTION 'Assignee needs active access to this property'; END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('completed','cancelled') AND
   ((to_jsonb(NEW)-'feedback_id'-'room_id'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'feedback_id'-'room_id'-'updated_at')
   OR (NEW.feedback_id IS DISTINCT FROM OLD.feedback_id AND NEW.feedback_id IS NOT NULL)
   OR (NEW.room_id IS DISTINCT FROM OLD.room_id AND NEW.room_id IS NOT NULL)) THEN RAISE EXCEPTION 'Closed jobs are immutable; create a follow-up job'; END IF;
  IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status<>'completed') THEN
   NEW.completed_at:=now();
   IF NEW.kind='cleaning' AND NEW.room_id IS NOT NULL THEN UPDATE public.hotel_rooms SET status='clean' WHERE id=NEW.room_id AND status<>'out_of_service'; END IF;
  END IF;
  NEW.updated_at:=now(); RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='room_inspections' THEN
  IF NEW.room_id IS NULL AND length(trim(NEW.location))=0 THEN RAISE EXCEPTION 'Room or public area required'; END IF;
  IF NEW.inspector_id IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Inspection must be attributed to the signed-in administrator'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=NEW.inspector_id AND organization_id=NEW.organization_id AND is_active AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'Inspector must be an active company administrator'; END IF;
  IF NEW.template_id IS NOT NULL THEN
   SELECT checks INTO checklist FROM public.inspection_templates WHERE id=NEW.template_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Checklist is outside this property'; END IF;
  ELSE
   checklist:=COALESCE(config->'inspectionChecklist','["Room cleaned and linen replaced","Bathroom and amenities checked","Safety equipment checked","Maintenance issues cleared"]'::jsonb);
  END IF;
  IF jsonb_typeof(NEW.answers)<>'array' OR jsonb_array_length(NEW.answers)<>jsonb_array_length(checklist) THEN RAISE EXCEPTION 'Answer every inspection check'; END IF;
  SELECT count(DISTINCT a->>'label'),bool_and((a->>'passed')::boolean) INTO matched,all_passed FROM jsonb_array_elements(NEW.answers) a WHERE checklist @> jsonb_build_array(a->>'label') AND jsonb_typeof(a->'passed')='boolean';
  IF matched<>jsonb_array_length(checklist) THEN RAISE EXCEPTION 'Inspection checklist changed; reload before submitting'; END IF;
  NEW.passed:=COALESCE(all_passed,false); RETURN NEW;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ops_asset_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.asset_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ops_assets WHERE id=NEW.asset_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id) THEN RAISE EXCEPTION 'Asset belongs to another property'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ops_asset_check ON public.service_jobs;
CREATE TRIGGER ops_asset_check BEFORE INSERT OR UPDATE ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.ops_asset_guard();
CREATE OR REPLACE FUNCTION public.ops_guest_request(p_hash text,p_service text,p_request_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.guest_service_links;s public.stays;rid uuid;jid uuid;dept text;title_text text;
BEGIN
 SELECT * INTO l FROM public.guest_service_links WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Guest service link is expired or unavailable'; END IF;
 SELECT * INTO s FROM public.stays WHERE id=l.stay_id AND organization_id=l.organization_id AND property_id=l.property_id AND status='active' FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.properties WHERE id=l.property_id AND is_active) THEN RAISE EXCEPTION 'Guest service link is no longer active'; END IF;
 IF NOT COALESCE((SELECT (settings->'hospitality'->'modules'->>'operations')::boolean FROM public.organization_settings WHERE organization_id=l.organization_id),true) THEN RAISE EXCEPTION 'Guest services are disabled'; END IF;
 SELECT job_id INTO jid FROM public.guest_service_requests WHERE link_id=l.id AND request_id=p_request_id;
 IF FOUND THEN RETURN jid; END IF;
 IF (SELECT count(*) FROM public.guest_service_requests WHERE link_id=l.id AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'Request limit reached. Please contact reception'; END IF;
 dept:=CASE p_service WHEN 'towels' THEN 'Housekeeping' WHEN 'toiletries' THEN 'Housekeeping' WHEN 'room_service' THEN 'Food & Beverage' WHEN 'baggage' THEN 'Concierge' WHEN 'valet' THEN 'Valet & Transfers' ELSE NULL END;
 IF dept IS NULL THEN RAISE EXCEPTION 'Choose an available guest service'; END IF;
 title_text:=CASE p_service WHEN 'towels' THEN 'Extra towels' WHEN 'toiletries' THEN 'Toiletries' WHEN 'room_service' THEN 'Room service assistance' WHEN 'baggage' THEN 'Baggage pickup' ELSE 'Vehicle retrieval' END;
 IF p_service='valet' THEN
  UPDATE public.valet_tickets SET status='requested' WHERE stay_id=s.id AND organization_id=l.organization_id AND property_id=l.property_id AND status='parked';
  IF NOT FOUND THEN RAISE EXCEPTION 'No parked vehicle is registered. Contact reception'; END IF;
 END IF;
 IF p_service='baggage' THEN UPDATE public.luggage_logs SET status='requested' WHERE stay_id=s.id AND organization_id=l.organization_id AND property_id=l.property_id AND status='stored'; END IF;
 INSERT INTO public.service_jobs(organization_id,property_id,room_id,kind,title,description,department,location,priority,intake_channel,due_at,source_key)
 VALUES(l.organization_id,l.property_id,s.room_id,'guest_request',title_text,'Contactless guest service request',dept,s.room_number,'normal','guest_request',now()+interval '15 minutes','guest:'||p_request_id||':'||l.id) RETURNING id INTO jid;
 INSERT INTO public.guest_service_requests(organization_id,property_id,link_id,request_id,service,job_id) VALUES(l.organization_id,l.property_id,l.id,p_request_id,p_service,jid);
 RETURN jid;
END $$;
REVOKE ALL ON FUNCTION public.ops_guest_request(text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_guest_request(text,text,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.schedule_omniops_work(p_org uuid DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE task record;jid uuid;count_jobs integer:=0;
BEGIN
 FOR task IN SELECT m.*,a.room_id FROM public.maintenance_tasks m JOIN public.ops_assets a ON a.id=m.asset_id AND a.organization_id=m.organization_id AND a.property_id=m.property_id
 JOIN public.properties p ON p.id=m.property_id AND p.is_active
 WHERE m.is_active AND a.status='active' AND m.next_due_at<=now() AND (p_org IS NULL OR m.organization_id=p_org)
 AND COALESCE((SELECT (settings->'hospitality'->'modules'->>'operations')::boolean FROM public.organization_settings WHERE organization_id=m.organization_id),true)
 ORDER BY m.next_due_at LIMIT 100 FOR UPDATE OF m SKIP LOCKED LOOP
  INSERT INTO public.service_jobs(organization_id,property_id,room_id,asset_id,kind,title,department,priority,due_at,assigned_to,source_key)
  VALUES(task.organization_id,task.property_id,task.room_id,task.asset_id,'maintenance',task.title,'Engineering','normal',now()+interval '24 hours',
   CASE WHEN public.role_member_eligible(task.assigned_to,task.organization_id,task.property_id,'hospitality','Engineering') THEN task.assigned_to END,'maintenance:'||task.id||':'||task.next_due_at)
  ON CONFLICT(organization_id,source_key) WHERE source_key IS NOT NULL DO NOTHING RETURNING id INTO jid;
  UPDATE public.maintenance_tasks SET last_job_id=COALESCE(jid,last_job_id),next_due_at=now()+make_interval(days=>task.interval_days) WHERE id=task.id;
  IF jid IS NOT NULL THEN count_jobs:=count_jobs+1; END IF;
 END LOOP;
 FOR task IN SELECT e.*,s.room_id,s.status stay_status FROM public.telephony_events e JOIN public.stays s ON s.id=e.stay_id
 WHERE e.kind='wake_up' AND e.status='scheduled' AND e.scheduled_at<=now() AND EXISTS(SELECT 1 FROM public.properties p WHERE p.id=e.property_id AND p.is_active) AND COALESCE((SELECT (settings->'hospitality'->'modules'->>'operations')::boolean FROM public.organization_settings WHERE organization_id=e.organization_id),true) AND (p_org IS NULL OR e.organization_id=p_org)
 ORDER BY e.scheduled_at LIMIT 100 FOR UPDATE OF e SKIP LOCKED LOOP
  IF task.stay_status<>'active' THEN UPDATE public.telephony_events SET status='cancelled' WHERE id=task.id; CONTINUE; END IF;
  INSERT INTO public.service_jobs(organization_id,property_id,room_id,kind,title,description,department,priority,due_at,source_key)
  VALUES(task.organization_id,task.property_id,task.room_id,'guest_request','Wake-up call',task.notes,'Front Desk','high',task.scheduled_at+interval '5 minutes','wake-up:'||task.id)
  ON CONFLICT(organization_id,source_key) WHERE source_key IS NOT NULL DO NOTHING RETURNING id INTO jid;
  UPDATE public.telephony_events SET status='due',job_id=jid WHERE id=task.id;count_jobs:=count_jobs+1;
 END LOOP;
 RETURN count_jobs;
END $$;
REVOKE ALL ON FUNCTION public.schedule_omniops_work(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_omniops_work(uuid) TO service_role;

-- Keep photo evidence private; camera permission is restricted to same-origin operations pages.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('operations-evidence','operations-evidence',false,5242880,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
  EXECUTE 'DROP POLICY IF EXISTS operations_evidence_read ON storage.objects';
  EXECUTE $p$CREATE POLICY operations_evidence_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='operations-evidence' AND EXISTS(SELECT 1 FROM public.inspection_evidence e WHERE e.object_path=storage.objects.name AND e.organization_id=public.workspace_org() AND public.workspace_property(e.property_id) AND public.workspace_module('hospitality')))$p$;
  EXECUTE 'DROP POLICY IF EXISTS operations_evidence_insert ON storage.objects';
  EXECUTE $p$CREATE POLICY operations_evidence_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='operations-evidence' AND public.workspace_admin() AND (storage.foldername(storage.objects.name))[1]=public.workspace_org()::text AND (storage.foldername(storage.objects.name))[3]=auth.uid()::text AND EXISTS(SELECT 1 FROM public.properties p WHERE p.id::text=(storage.foldername(storage.objects.name))[2] AND p.organization_id=public.workspace_org()))$p$;
  EXECUTE 'DROP POLICY IF EXISTS operations_evidence_delete ON storage.objects';
  EXECUTE $p$CREATE POLICY operations_evidence_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='operations-evidence' AND public.workspace_admin() AND (storage.foldername(storage.objects.name))[1]=public.workspace_org()::text AND (storage.foldername(storage.objects.name))[3]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.inspection_evidence e WHERE e.object_path=storage.objects.name AND e.inspection_id IS NOT NULL))$p$;
 END IF;
END $$;
DO $$ DECLARE t text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH t IN ARRAY ARRAY['service_jobs','hotel_rooms','room_inspections','luggage_logs','valet_tickets','breakfast_attendance','telephony_events','maintenance_tasks','audit_trails'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
  END LOOP;
 END IF;
END $$;
-- Aggregate charts over all visible jobs, independent of work-board pagination.
CREATE OR REPLACE FUNCTION public.omniops_trend(p_property uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('date',report_day,'created',created_count,'completed',completed_count) ORDER BY report_day),'[]') FROM (
 SELECT d.tick::date AS report_day,
 (SELECT count(*) FROM public.service_jobs j WHERE (p_property IS NULL OR j.property_id=p_property) AND j.created_at>=d.tick AND j.created_at<d.tick+interval '1 day') created_count,
 (SELECT count(*) FROM public.service_jobs j WHERE (p_property IS NULL OR j.property_id=p_property) AND j.completed_at>=d.tick AND j.completed_at<d.tick+interval '1 day') completed_count
 FROM generate_series(date_trunc('day',now())-interval '13 days',date_trunc('day',now()),interval '1 day') d(tick)
 ) totals
$$;
REVOKE ALL ON FUNCTION public.omniops_trend(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.omniops_trend(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_inspection_result() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.hotel_rooms SET status=CASE WHEN status='out_of_service' THEN status WHEN NEW.passed THEN 'inspected' ELSE 'dirty' END WHERE id=NEW.room_id;
 IF NOT NEW.passed THEN
  INSERT INTO public.service_jobs(organization_id,property_id,room_id,inspection_id,kind,title,description,department,location,priority,created_by,due_at,source_key)
  VALUES(NEW.organization_id,NEW.property_id,NEW.room_id,NEW.id,'maintenance','Inspection follow-up',
   'Failed checks: '||(SELECT string_agg(a->>'label',', ') FROM jsonb_array_elements(NEW.answers) a WHERE (a->>'passed')::boolean=false),
   'Engineering',NEW.location,'high',NEW.inspector_id,now()+make_interval(mins=>COALESCE((SELECT (settings->'hospitality'->>'taskResponseMinutes')::integer FROM public.organization_settings WHERE organization_id=NEW.organization_id),120)),'inspection:'||NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ops_cleaning_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='cleaning' AND NEW.room_id IS NOT NULL AND NEW.source_key IS NOT NULL AND NEW.status='completed' AND OLD.status<>'completed' AND NOT EXISTS(SELECT 1 FROM public.room_cleaning_runs WHERE job_id=NEW.id) THEN RAISE EXCEPTION 'Complete the cleaning checklist before closing this job'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ops_cleaning_check ON public.service_jobs;
CREATE TRIGGER ops_cleaning_check BEFORE UPDATE ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.ops_cleaning_guard();

CREATE OR REPLACE FUNCTION public.omniops_config() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.workspace_module('hospitality') THEN RAISE EXCEPTION 'Hotel operations access required' USING ERRCODE='42501'; END IF;
 SELECT settings->'hospitality' INTO cfg FROM public.organization_settings WHERE organization_id=public.workspace_org();
 RETURN jsonb_build_object('currency',COALESCE(cfg->>'currency','INR'),'callRateMinor',COALESCE((cfg->>'callRateMinor')::integer,0),
 'modules',COALESCE(cfg->'modules','{}'),'inspectionChecklist',COALESCE(cfg->'inspectionChecklist','["Room cleaned and linen replaced","Bathroom and amenities checked","Safety equipment checked","Maintenance issues cleared"]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.omniops_config() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.omniops_config() TO authenticated;
CREATE OR REPLACE FUNCTION public.ops_settings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.settings->'hospitality' ? 'callRateMinor' AND ((NEW.settings->'hospitality'->>'callRateMinor')::numeric NOT BETWEEN 0 AND 100000 OR (NEW.settings->'hospitality'->>'callRateMinor')::numeric<>trunc((NEW.settings->'hospitality'->>'callRateMinor')::numeric)) THEN RAISE EXCEPTION 'Call rate must be 0–100000 minor units per minute'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ops_settings_check ON public.organization_settings;
CREATE TRIGGER ops_settings_check BEFORE INSERT OR UPDATE ON public.organization_settings FOR EACH ROW EXECUTE FUNCTION public.ops_settings_guard();

-- Preserve staff field protection while permitting a resolution note at completion only.
CREATE OR REPLACE FUNCTION public.guard_staff_job_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.workspace_admin() THEN
  IF OLD.assigned_to IS DISTINCT FROM auth.uid() OR NOT public.workspace_right('manage_service_jobs') OR NOT public.workspace_module('hospitality') OR NOT public.workspace_property(OLD.property_id) OR NOT public.workspace_department(OLD.department) OR NOT public.hotel_enabled('operations') THEN RAISE EXCEPTION 'Only the assigned authorized member can attend this job' USING ERRCODE='42501';END IF;
  IF (to_jsonb(NEW)-'status'-'acknowledged_at'-'resolution_notes') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'acknowledged_at'-'resolution_notes') OR NEW.status NOT IN ('open','in_progress','completed') OR OLD.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Assigned staff may acknowledge, start or complete work only' USING ERRCODE='42501';END IF;
  IF NEW.resolution_notes IS DISTINCT FROM OLD.resolution_notes AND NEW.status<>'completed' THEN RAISE EXCEPTION 'Resolution notes are recorded when work is completed' USING ERRCODE='42501';END IF;
  IF OLD.acknowledged_at IS NOT NULL AND NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at THEN RAISE EXCEPTION 'Acknowledgement is immutable' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.omniops_summary(p_property uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
 'activeJobs',(SELECT count(*) FROM public.service_jobs WHERE status IN ('open','in_progress') AND (p_property IS NULL OR property_id=p_property)),
 'overdue',(SELECT count(*) FROM public.service_jobs WHERE status IN ('open','in_progress') AND due_at<now() AND (p_property IS NULL OR property_id=p_property)),
 'readyRooms',(SELECT count(*) FROM public.hotel_rooms r WHERE status IN ('clean','inspected') AND (p_property IS NULL OR property_id=p_property) AND NOT EXISTS(SELECT 1 FROM public.stays s WHERE s.room_id=r.id AND s.status='active')),
 'inHouse',(SELECT count(*) FROM public.stays WHERE status='active' AND room_id IS NOT NULL AND (p_property IS NULL OR property_id=p_property))
 )
$$;
REVOKE ALL ON FUNCTION public.omniops_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.omniops_summary(uuid) TO authenticated;

ALTER TABLE public.ops_push_deliveries ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.ops_push_deliveries ADD COLUMN IF NOT EXISTS retry_after timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.ops_push_deliveries ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.claim_ops_push(p_org uuid DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 WITH candidates AS (
  SELECT s.id subscription_id,j.id job_id,j.routing_cycle,j.escalation_level
  FROM public.ops_push_subscriptions s JOIN public.service_jobs j ON j.assigned_to=s.user_id AND j.organization_id=s.organization_id
  WHERE j.status='open' AND j.acknowledged_at IS NULL AND (p_org IS NULL OR j.organization_id=p_org)
  AND public.role_member_eligible(j.assigned_to,j.organization_id,j.property_id,'hospitality',j.department)
  AND NOT EXISTS(SELECT 1 FROM public.ops_push_deliveries d WHERE d.subscription_id=s.id AND d.job_id=j.id AND d.routing_cycle=j.routing_cycle AND d.escalation_level=j.escalation_level AND (d.delivered_at IS NOT NULL OR d.retry_after>now() OR d.attempts>=8))
  ORDER BY j.due_at LIMIT LEAST(GREATEST(p_limit,1),20) FOR UPDATE OF s SKIP LOCKED
 ), claimed AS (
  INSERT INTO public.ops_push_deliveries(subscription_id,job_id,routing_cycle,escalation_level,retry_after,attempts)
  SELECT subscription_id,job_id,routing_cycle,escalation_level,now()+interval '2 minutes',1 FROM candidates
  ON CONFLICT(subscription_id,job_id,routing_cycle,escalation_level) DO UPDATE SET retry_after=now()+interval '2 minutes',attempts=ops_push_deliveries.attempts+1
  WHERE ops_push_deliveries.delivered_at IS NULL AND ops_push_deliveries.retry_after<=now() AND ops_push_deliveries.attempts<8
  RETURNING *
 ) SELECT COALESCE(jsonb_agg(jsonb_build_object('subscription_id',c.subscription_id,'job_id',c.job_id,'routing_cycle',c.routing_cycle,'escalation_level',c.escalation_level,'attempts',c.attempts,'subscription',s.subscription,'priority',j.priority)),'[]') INTO result
 FROM claimed c JOIN public.ops_push_subscriptions s ON s.id=c.subscription_id JOIN public.service_jobs j ON j.id=c.job_id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.claim_ops_push(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ops_push(uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ops_breakfast_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE endpoint record;roomid uuid;roomnumber text;
BEGIN
 IF NEW.cleaning_job_id IS NULL OR (TG_OP='UPDATE' AND OLD.cleaning_job_id IS NOT NULL) THEN RETURN NEW; END IF;
 SELECT room_id,room_number INTO roomid,roomnumber FROM public.stays WHERE id=NEW.stay_id;
 FOR endpoint IN SELECT e.id FROM public.ops_breakfast_webhooks c JOIN public.webhook_endpoints e ON e.id=c.endpoint_id AND e.organization_id=c.organization_id
 WHERE c.organization_id=NEW.organization_id AND c.property_id=NEW.property_id AND c.is_active AND e.is_active LOOP
  INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload)
  VALUES(NEW.organization_id,'webhook','breakfast:'||endpoint.id||':'||NEW.id,
  jsonb_build_object('endpointId',endpoint.id,'event','housekeeping.breakfast_attended','propertyId',NEW.property_id,'roomId',roomid,'roomNumber',roomnumber,'jobId',NEW.cleaning_job_id,'attendanceId',NEW.id,'accessConfirmationRequired',true)) ON CONFLICT(dedup_key) DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ops_breakfast_notice ON public.breakfast_attendance;
CREATE TRIGGER ops_breakfast_notice AFTER INSERT OR UPDATE ON public.breakfast_attendance FOR EACH ROW EXECUTE FUNCTION public.ops_breakfast_notify();
DROP TRIGGER IF EXISTS ops_history ON public.ops_breakfast_webhooks;
CREATE TRIGGER ops_history AFTER INSERT OR UPDATE ON public.ops_breakfast_webhooks FOR EACH ROW EXECUTE FUNCTION public.ops_audit();

COMMIT;
