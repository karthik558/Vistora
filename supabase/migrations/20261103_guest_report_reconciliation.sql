BEGIN;
CREATE TABLE public.guest_imports (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id), actor_id uuid NOT NULL,
 mode text NOT NULL CHECK (mode IN ('partial','full')), created_at timestamptz NOT NULL DEFAULT now(),
 payload_hash text NOT NULL, result jsonb NOT NULL
);
ALTER TABLE public.guest_imports ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.guest_imports TO authenticated;
CREATE POLICY guest_import_read ON public.guest_imports FOR SELECT TO authenticated USING (
 organization_id=public.workspace_org() AND public.workspace_property(property_id)
 AND public.workspace_module('hospitality') AND (public.workspace_admin() OR public.workspace_right('import_guests'))
);
CREATE INDEX guest_import_property_time ON public.guest_imports(property_id,created_at DESC);

-- Preview executes the same guarded mutations in a rolled-back subtransaction.
-- Commit repeats them only if the reviewed property state has not changed.
CREATE OR REPLACE FUNCTION public.import_guest_report(p_property uuid,p_records jsonb,p_mode text,
 p_request uuid,p_preview_token text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
<<report>>
DECLARE
 org uuid:=public.workspace_org(); today date; fingerprint text; payload_hash text;
 previous public.guest_imports; row jsonb; prepared jsonb:='[]'; changes jsonb:='[]';
 g public.guests; r public.hotel_rooms; s public.stays; candidate public.stays;
 arrival date; departure date; desired text; action text; guest_name text; room_number text;
 guest_count integer; guest_ids uuid[]; seen_rooms text[]:='{}'; matched_stays uuid[]:='{}';
 result jsonb; total integer:=0; created integer:=0; reused integer:=0; rooms integer:=0;
 stays_created integer:=0; stays_updated integer:=0; departures integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.workspace_module('hospitality') OR NOT public.hotel_enabled('guests')
 OR NOT (public.workspace_admin() OR public.workspace_right('import_guests'))
 OR NOT public.workspace_property(p_property) THEN
  RAISE EXCEPTION 'Guest import permission and property access required' USING ERRCODE='42501';
 END IF;
 IF p_mode IS NULL OR p_mode NOT IN ('partial','full') OR p_request IS NULL OR jsonb_typeof(p_records) IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_records)>500 OR (p_mode='partial' AND jsonb_array_length(p_records)=0) THEN
  RAISE EXCEPTION 'Choose full or partial import and provide up to 500 records';
 END IF;
 -- Serialize imports, including guest identity resolution, within a company.
 PERFORM pg_advisory_xact_lock(hashtextextended(org::text,731));
 SELECT timezone(p.timezone,now())::date INTO today FROM public.properties p
 WHERE p.id=p_property AND p.organization_id=org AND p.is_active FOR UPDATE;
 IF today IS NULL THEN RAISE EXCEPTION 'Choose an active property'; END IF;
 payload_hash:=md5(jsonb_build_array(p_property,p_mode,p_records)::text);
 SELECT * INTO previous FROM public.guest_imports WHERE id=p_request;
 IF FOUND THEN
  IF previous.organization_id<>org OR previous.property_id<>p_property OR previous.payload_hash<>payload_hash THEN
   RAISE EXCEPTION 'Import request ID has already been used';
  END IF;
  RETURN previous.result;
 END IF;
 -- Match the lock order used by hotel_guard, and retain locks until commit.
 PERFORM id FROM public.hotel_rooms WHERE property_id=p_property ORDER BY id FOR UPDATE;
 PERFORM id FROM public.stays WHERE property_id=p_property ORDER BY id FOR UPDATE;
 PERFORM id FROM public.guests WHERE organization_id=org ORDER BY id FOR UPDATE;
 SELECT md5(jsonb_build_array(payload_hash,today,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.stays t WHERE property_id=p_property),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.hotel_rooms t WHERE property_id=p_property),
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.guests t WHERE organization_id=org),
  (SELECT settings FROM public.organization_settings WHERE organization_id=org))::text) INTO fingerprint;
 IF p_preview_token IS NOT NULL AND p_preview_token<>fingerprint THEN
  RAISE EXCEPTION 'Property occupancy or report changed. Review the report again before importing.';
 END IF;
 BEGIN
  FOR row IN SELECT value FROM jsonb_array_elements(p_records) LOOP
   total:=total+1;
   guest_name:=trim(row->>'guest_name'); room_number:=trim(row->>'room_number');
   IF coalesce(length(guest_name),0) NOT BETWEEN 1 AND 100 OR coalesce(length(room_number),0) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Row %: guest name and room number are required',total;
   END IF;
   IF lower(report.room_number)=ANY(seen_rooms) THEN RAISE EXCEPTION 'Room % appears more than once. Use one primary guest per room.',room_number; END IF;
   seen_rooms:=array_append(seen_rooms,lower(report.room_number));
   IF coalesce(row->>'check_in_date','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(row->>'check_out_date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Room %: dates must use YYYY-MM-DD',room_number;
   END IF;
   IF length(coalesce(row->>'email',''))>254 OR (nullif(trim(row->>'email'),'') IS NOT NULL AND trim(row->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    OR length(coalesce(row->>'phone',''))>40 OR length(coalesce(row->>'vip_tier',''))>30
    OR length(coalesce(row->>'room_type',''))>60 OR length(coalesce(row->>'preferences',''))>2000 THEN
    RAISE EXCEPTION 'Room %: invalid contact details or oversized guest fields',room_number;
   END IF;
   arrival:=(row->>'check_in_date')::date; departure:=(row->>'check_out_date')::date;
   IF arrival IS NULL OR departure IS NULL OR departure<=arrival THEN RAISE EXCEPTION 'Room %: valid arrival and departure dates are required',room_number; END IF;
   guest_count:=coalesce((row->>'guest_count')::integer,1);
   IF guest_count NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Guest count must be between 1 and 20'; END IF;
   desired:=coalesce(nullif(row->>'status',''),CASE WHEN arrival<=today AND departure>today THEN 'active' ELSE 'reserved' END);
   IF desired NOT IN ('active','reserved') OR departure<=today OR (desired='active' AND arrival>today) THEN RAISE EXCEPTION 'Room %: report must describe a current stay or future reservation',room_number; END IF;
   IF p_mode='full' AND desired<>'active' THEN RAISE EXCEPTION 'Full reports must contain only current in-house rooms. Use partial import for reservations.'; END IF;
   SELECT array_agg(id) INTO guest_ids FROM public.guests WHERE organization_id=org
    AND nullif(trim(row->>'email'),'') IS NOT NULL AND lower(email)=lower(trim(row->>'email'));
   IF coalesce(cardinality(guest_ids),0)=0 THEN
    SELECT array_agg(id) INTO guest_ids FROM public.guests WHERE organization_id=org
     AND length(regexp_replace(row->>'phone','\D','','g'))>=7
     AND regexp_replace(phone,'\D','','g')=regexp_replace(row->>'phone','\D','','g');
   END IF;
   IF coalesce(cardinality(guest_ids),0)=0 THEN
    SELECT array_agg(id) INTO guest_ids FROM public.guests WHERE organization_id=org AND lower(trim(full_name))=lower(guest_name)
     AND (nullif(trim(row->>'email'),'') IS NULL OR nullif(trim(email),'') IS NULL OR lower(email)=lower(trim(row->>'email')))
     AND (nullif(trim(row->>'phone'),'') IS NULL OR nullif(trim(phone),'') IS NULL OR regexp_replace(phone,'\D','','g')=regexp_replace(row->>'phone','\D','','g'));
   END IF;
   IF cardinality(guest_ids)>1 THEN RAISE EXCEPTION 'Multiple profiles match %. Resolve the guest identity first.',guest_name; END IF;
   IF coalesce(cardinality(guest_ids),0)=0 THEN
    INSERT INTO public.guests(organization_id,full_name,email,phone,vip_tier,preferences)
    VALUES(org,guest_name,nullif(trim(row->>'email'),''),nullif(trim(row->>'phone'),''),coalesce(nullif(row->>'vip_tier',''),'Standard'),coalesce(row->>'preferences','')) RETURNING * INTO g;
    created:=created+1;
   ELSE
    UPDATE public.guests SET email=coalesce(nullif(email,''),nullif(trim(row->>'email'),'')),
     phone=coalesce(nullif(phone,''),nullif(trim(row->>'phone'),'')) WHERE id=guest_ids[1] RETURNING * INTO g;
    reused:=reused+1;
   END IF;
   SELECT * INTO s FROM public.stays WHERE property_id=p_property AND guest_id=g.id
    AND lower(trim(stays.room_number))=lower(report.room_number) AND check_in_date=arrival ORDER BY created_at DESC LIMIT 1;
   IF FOUND THEN
    IF s.status IN ('checked_out','cancelled') THEN RAISE EXCEPTION 'Room %: this stay is already closed; it cannot be reopened by a report',room_number; END IF;
    IF s.status='active' AND (departure<>s.check_out_date OR desired<>'active') THEN RAISE EXCEPTION 'Room %: active stay dates or status conflict. Resolve the stay before importing.',room_number; END IF;
    matched_stays:=array_append(matched_stays,s.id);
   END IF;
   prepared:=prepared||jsonb_build_array(row||jsonb_build_object('guest_id',g.id,'stay_id',s.id,'status',desired));
  END LOOP;
  IF p_mode='full' THEN
   FOR candidate IN SELECT * FROM public.stays WHERE property_id=p_property AND status='active' AND NOT(id=ANY(matched_stays)) LOOP
    SELECT * INTO g FROM public.guests WHERE id=candidate.guest_id;
    changes:=changes||jsonb_build_array(jsonb_build_object('room_number',candidate.room_number,'guest_name',g.full_name,
     'check_in_date',candidate.check_in_date,'check_out_date',candidate.check_out_date,'action','Check out','stay_id',candidate.id));
    UPDATE public.stays SET status='checked_out' WHERE id=candidate.id;
    departures:=departures+1;
   END LOOP;
  END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(prepared) LOOP
   IF (SELECT count(*) FROM public.hotel_rooms WHERE property_id=p_property AND lower(trim(hotel_rooms.room_number))=lower(trim(row->>'room_number')))>1 THEN
    RAISE EXCEPTION 'Room % matches multiple room records. Resolve room numbering first.',row->>'room_number';
   END IF;
   SELECT * INTO r FROM public.hotel_rooms WHERE property_id=p_property AND lower(trim(hotel_rooms.room_number))=lower(trim(row->>'room_number'));
   IF NOT FOUND THEN
    INSERT INTO public.hotel_rooms(organization_id,property_id,room_number,room_type,capacity,status)
    VALUES(org,p_property,trim(row->>'room_number'),coalesce(nullif(row->>'room_type',''),'Standard'),greatest(2,(row->>'guest_count')::integer),'clean') RETURNING * INTO r;
    rooms:=rooms+1;
   END IF;
   IF row->>'stay_id' IS NOT NULL THEN
    SELECT * INTO s FROM public.stays WHERE id=(row->>'stay_id')::uuid;
    action:=CASE WHEN s.status='active' THEN 'Still in house' WHEN row->>'status'='active' THEN 'Check in' ELSE 'Reservation updated' END;
    UPDATE public.stays SET guest_count=coalesce((row->>'guest_count')::integer,1),room_id=r.id,
     check_out_date=(row->>'check_out_date')::date,status=row->>'status' WHERE id=s.id;
    stays_updated:=stays_updated+1;
   ELSE
    INSERT INTO public.stays(organization_id,property_id,guest_id,room_id,room_number,check_in_date,check_out_date,guest_count,public_token,status)
    VALUES(org,p_property,(row->>'guest_id')::uuid,r.id,r.room_number,(row->>'check_in_date')::date,(row->>'check_out_date')::date,
     coalesce((row->>'guest_count')::integer,1),replace(gen_random_uuid()::text,'-',''),'reserved') RETURNING * INTO s;
    IF row->>'status'='active' THEN UPDATE public.stays SET status='active' WHERE id=s.id; END IF;
    action:=CASE WHEN row->>'status'='active' THEN 'Check in' ELSE 'Reservation created' END;
    stays_created:=stays_created+1;
   END IF;
   changes:=changes||jsonb_build_array(jsonb_build_object('room_number',r.room_number,'guest_name',row->>'guest_name',
    'check_in_date',row->>'check_in_date','check_out_date',row->>'check_out_date','action',action));
  END LOOP;
  result:=jsonb_build_object('success',true,'preview',p_preview_token IS NULL,'token',fingerprint,'changes',changes,
   'imported',jsonb_build_object('total',total,'guestsCreated',created,'guestsReused',reused,'roomsConfigured',rooms,
   'staysCreated',stays_created,'staysUpdated',stays_updated,'checkedOut',departures));
  IF p_preview_token IS NULL THEN RAISE EXCEPTION USING ERRCODE='PZ001',MESSAGE='preview rollback'; END IF;
  INSERT INTO public.guest_imports(id,organization_id,property_id,actor_id,mode,payload_hash,result)
   VALUES(p_request,org,p_property,auth.uid(),p_mode,payload_hash,result);
 EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
 END;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.import_guest_report(uuid,jsonb,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_guest_report(uuid,jsonb,text,uuid,text) TO authenticated;
COMMIT;
