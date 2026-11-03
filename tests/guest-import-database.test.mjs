import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const url = process.env.VISTORA_TEST_DATABASE_URL;
assert.ok(url && new URL(url).pathname === '/vistora_test', 'Use a disposable database named vistora_test.');
execFileSync(process.env.PSQL_BIN || 'psql', [url, '-v', 'ON_ERROR_STOP=1', '-q'], { stdio: ['pipe', 'inherit', 'inherit'], input: String.raw`
BEGIN;
CREATE TEMP TABLE import_fixture AS SELECT gen_random_uuid() owner_id,gen_random_uuid() reader_id,gen_random_uuid() property_id,gen_random_uuid() request_id;
INSERT INTO auth.users(id,email) SELECT owner_id,'import-owner@test.local' FROM import_fixture;
SELECT create_company(owner_id,'Import test','import-test-'||owner_id) FROM import_fixture;
ALTER TABLE import_fixture ADD COLUMN org uuid;
UPDATE import_fixture SET org=(SELECT organization_id FROM organization_members WHERE user_id=owner_id);
INSERT INTO properties(id,organization_id,name,slug,code,location,country,timezone) SELECT property_id,org,'Import hotel','import-hotel','IMPORT','City','India','UTC' FROM import_fixture;
SELECT set_config('request.jwt.claim.sub',owner_id::text,true) FROM import_fixture;
INSERT INTO auth.users(id,email) SELECT reader_id,'import-reader@test.local' FROM import_fixture;
SELECT provision_workspace_user(reader_id,org,'import-reader@test.local','Reader',false,ARRAY[property_id],ARRAY['module:hospitality','module_access:configured']) FROM import_fixture;
SELECT set_config('request.jwt.claim.sub',owner_id::text,true) FROM import_fixture;
GRANT SELECT ON import_fixture TO authenticated;
SET LOCAL ROLE authenticated;
SELECT save_hotel_settings(jsonb_build_object('organizationName','Import test','defaultTimezone','UTC','hospitality',jsonb_build_object('requireInspection',false,'currency','INR'))) FROM import_fixture;
DO $$
DECLARE f record; rows jsonb; preview jsonb; result jsonb; request uuid; token text; before_count int;
BEGIN
 SELECT * INTO f FROM import_fixture;
 rows:=jsonb_build_array(
 jsonb_build_object('guest_name','Alex','room_number','101','check_in_date',current_date,'check_out_date',current_date+3,'guest_count',1),
 jsonb_build_object('guest_name','Bea','room_number','102','check_in_date',current_date,'check_out_date',current_date+3,'guest_count',1));
 preview:=import_guest_report(f.property_id,rows,'partial',f.request_id);
 IF (preview->'imported'->>'staysCreated')::int<>2 OR EXISTS(SELECT 1 FROM stays WHERE property_id=f.property_id) OR EXISTS(SELECT 1 FROM guests WHERE organization_id=f.org) THEN RAISE EXCEPTION 'Preview leaked mutations'; END IF;
 result:=import_guest_report(f.property_id,rows,'partial',f.request_id,preview->>'token');
 IF (SELECT count(*) FROM stays WHERE property_id=f.property_id AND status='active')<>2 THEN RAISE EXCEPTION 'Arrival check-ins failed'; END IF;
 IF import_guest_report(f.property_id,rows,'partial',f.request_id,preview->>'token')<>result THEN RAISE EXCEPTION 'Retry not idempotent'; END IF;
 request:=gen_random_uuid();
 preview:=import_guest_report(f.property_id,rows,'full',request);
 result:=import_guest_report(f.property_id,rows,'full',request,preview->>'token');
 IF (result->'imported'->>'staysCreated')::int<>0 OR (result->'imported'->>'checkedOut')::int<>0 OR (result->'changes'->0->>'action')<>'Still in house' THEN RAISE EXCEPTION 'Repeated report not deduplicated'; END IF;
 rows:=jsonb_build_array((rows->0)||'{"email":"alex@test.local"}'::jsonb); request:=gen_random_uuid();
 preview:=import_guest_report(f.property_id,rows,'partial',request);
 PERFORM import_guest_report(f.property_id,rows,'partial',request,preview->>'token');
 IF (SELECT count(*) FROM stays WHERE property_id=f.property_id AND status='active')<>2 OR (SELECT count(*) FROM guests WHERE organization_id=f.org)<>2 THEN RAISE EXCEPTION 'Partial import changed other rooms or duplicated guest when enriching contact'; END IF;
 request:=gen_random_uuid(); preview:=import_guest_report(f.property_id,rows,'full',request);
 IF EXISTS(SELECT 1 FROM service_jobs WHERE organization_id=f.org AND source_key LIKE 'feedback-checkout:%') OR EXISTS(SELECT 1 FROM stays WHERE property_id=f.property_id AND checked_out_at IS NOT NULL) THEN RAISE EXCEPTION 'Checkout preview leaked a job or timestamp'; END IF;
 IF (preview->'imported'->>'checkedOut')::int<>1 THEN RAISE EXCEPTION 'Missing stay not reconciled'; END IF;
 UPDATE hotel_rooms SET notes='Concurrent change' WHERE property_id=f.property_id AND room_number='101';
 BEGIN
  PERFORM import_guest_report(f.property_id,rows,'full',request,preview->>'token');
  RAISE EXCEPTION 'Stale preview accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Stale preview accepted' THEN RAISE; END IF; END;
 preview:=import_guest_report(f.property_id,rows,'full',request);
 PERFORM import_guest_report(f.property_id,rows,'full',request,preview->>'token');
 IF NOT EXISTS(SELECT 1 FROM stays WHERE property_id=f.property_id AND room_number='102' AND status='checked_out') OR NOT EXISTS(SELECT 1 FROM hotel_rooms WHERE property_id=f.property_id AND room_number='102' AND status='dirty') THEN RAISE EXCEPTION 'Checkout or turnover failed'; END IF;
 -- Invalid late row rolls back all profile/room mutations.
 SELECT count(*) INTO before_count FROM guests WHERE organization_id=f.org;
 BEGIN
  PERFORM import_guest_report(f.property_id,jsonb_build_array(jsonb_build_object('guest_name','New guest','room_number','103','check_in_date',current_date,'check_out_date',current_date+3),jsonb_build_object('guest_name','Broken','room_number','104','check_in_date',current_date,'check_out_date',current_date-1)),'partial',gen_random_uuid());
  RAISE EXCEPTION 'Invalid report accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid report accepted' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM guests WHERE organization_id=f.org)<>before_count THEN RAISE EXCEPTION 'Failed import left partial data'; END IF;
 BEGIN
  PERFORM import_guest_report(f.property_id,rows||rows,'full',gen_random_uuid()); RAISE EXCEPTION 'Duplicate room accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Duplicate room accepted' THEN RAISE; END IF; END;
 -- A different guest must not be silently merged into the continuing stay.
 BEGIN
  PERFORM import_guest_report(f.property_id,jsonb_build_array((rows->0)||'{"guest_name":"Replacement","email":"replacement@test.local"}'::jsonb),'full',gen_random_uuid()); RAISE EXCEPTION 'Unready turnover accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unready turnover accepted' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM stays WHERE property_id=f.property_id AND room_number='101' AND status='active') THEN RAISE EXCEPTION 'Failed turnover committed checkout'; END IF;
 request:=gen_random_uuid(); preview:=import_guest_report(f.property_id,'[]','full',request);
 PERFORM import_guest_report(f.property_id,'[]','full',request,preview->>'token');
 IF EXISTS(SELECT 1 FROM stays WHERE property_id=f.property_id AND status='active') THEN RAISE EXCEPTION 'Empty full report did not checkout'; END IF;
 IF (SELECT count(*) FROM guest_imports WHERE property_id=f.property_id)<>5 THEN RAISE EXCEPTION 'Import history missing or retry duplicated'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',reader_id::text,true) FROM import_fixture;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM import_guest_report((SELECT property_id FROM import_fixture),'[]','full',gen_random_uuid()); RAISE EXCEPTION 'Reader imported'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM guest_imports) THEN RAISE EXCEPTION 'Reader saw import history'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',owner_id::text,true) FROM import_fixture;
SELECT provision_workspace_user(reader_id,org,'import-reader@test.local','Importer',false,ARRAY[property_id],ARRAY['module:hospitality','module_access:configured','import_guests']) FROM import_fixture;
SELECT set_config('request.jwt.claim.sub',reader_id::text,true) FROM import_fixture;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM import_guest_report(gen_random_uuid(),'[]','full',gen_random_uuid()); RAISE EXCEPTION 'Importer escaped assigned property'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM import_guest_report((SELECT property_id FROM import_fixture),'[]','full',gen_random_uuid());
 IF NOT EXISTS(SELECT 1 FROM guest_imports) THEN RAISE EXCEPTION 'Authorized importer cannot see history'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',owner_id::text,true) FROM import_fixture;
-- Prove the complete persistence path on disposable records only.
DO $$ DECLARE f record; rows jsonb; preview jsonb; request uuid:=gen_random_uuid(); imported_stay_id uuid; saved jsonb; feedback_count integer;
BEGIN
 SELECT * INTO f FROM import_fixture;
 rows:=jsonb_build_array(jsonb_build_object('guest_name','Feedback guest','room_number','105','check_in_date',current_date,'check_out_date',current_date+2,'guest_count',1));
 preview:=import_guest_report(f.property_id,rows,'partial',request);
 PERFORM import_guest_report(f.property_id,rows,'partial',request,preview->>'token');
 SELECT id INTO STRICT imported_stay_id FROM stays WHERE property_id=f.property_id AND room_number='105' AND status='active';
 saved:=submit_guest_feedback(jsonb_build_object('organization_id',f.org,'property_id',f.property_id,'stay_id',imported_stay_id,
  'guest_name','Feedback guest','room_number','105','department','Front Desk','rating',5,'status','resolved','tone','positive','resolved_at',now()),'[]');
 IF (saved->>'stay_id')::uuid<>imported_stay_id OR NOT EXISTS(SELECT 1 FROM feedback WHERE id=(saved->>'id')::uuid AND feedback.stay_id=imported_stay_id AND property_id=f.property_id AND organization_id=f.org) THEN
  RAISE EXCEPTION 'Imported guest feedback did not persist against its stay and property';
 END IF;
 SELECT count(*) INTO feedback_count FROM feedback WHERE property_id=f.property_id;
 BEGIN
  PERFORM submit_guest_feedback(jsonb_build_object('organization_id',f.org,'property_id',f.property_id,
   'guest_name','Feedback guest','room_number','105','department','Front Desk','rating',5,'status','resolved','tone','positive'),
   jsonb_build_array(jsonb_build_object('questionId',gen_random_uuid(),'questionText','Invalid question','answerValue','Invalid')));
  RAISE EXCEPTION 'Invalid answer accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 WHEN raise_exception THEN IF SQLERRM<>'Linked record belongs to another company' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM feedback WHERE property_id=f.property_id)<>feedback_count THEN RAISE EXCEPTION 'Failed questionnaire left partial feedback'; END IF;
END $$;
-- Collection and management outcomes must remain distinct, persisted and scoped.
DO $$ DECLARE f record; data jsonb; sid uuid; job uuid; response jsonb;
BEGIN
 SELECT * INTO f FROM import_fixture;
 data:=feedback_collection_directory(current_date,'pending');
 IF jsonb_array_length(data->'guests')<>0 THEN RAISE EXCEPTION 'Collected active stay still pending'; END IF;
 data:=feedback_collection_directory(current_date+1,'pending');
 IF jsonb_array_length(data->'guests')<>0 THEN RAISE EXCEPTION 'Collection incorrectly reset next day'; END IF;
 data:=feedback_collection_directory(current_date,'collected');
 IF jsonb_array_length(data->'guests')<>1 THEN RAISE EXCEPTION 'Collection date missing response'; END IF;
 -- The property's local day, rather than the database UTC day, owns collection filters.
 UPDATE properties SET timezone='Pacific/Kiritimati' WHERE id=f.property_id;
 UPDATE feedback SET created_at=current_date::timestamp+interval '23 hours' WHERE property_id=f.property_id;
 data:=feedback_collection_directory(current_date+1,'collected');
 IF jsonb_array_length(data->'guests')<>1 THEN RAISE EXCEPTION 'Property timezone ignored'; END IF;
 UPDATE properties SET timezone='UTC' WHERE id=f.property_id;
 UPDATE feedback SET created_at=now() WHERE property_id=f.property_id;
 data:=feedback_collection_directory(current_date-1,'collected');
 IF jsonb_array_length(data->'guests')<>0 THEN RAISE EXCEPTION 'Collection date ignored'; END IF;
 SELECT id INTO sid FROM stays WHERE property_id=f.property_id AND room_number='105';
 UPDATE stays SET status='checked_out' WHERE id=sid;
 IF EXISTS(SELECT 1 FROM service_jobs WHERE source_key='feedback-checkout:'||sid) THEN RAISE EXCEPTION 'Collected checkout created a missing-feedback job'; END IF;
 data:=feedback_collection_directory(current_date,'missed');
 IF jsonb_array_length(data->'guests')<>2 THEN RAISE EXCEPTION 'Missing checkouts lost: %',data; END IF;
 SELECT id INTO sid FROM stays WHERE property_id=f.property_id AND room_number='102';
 job:=feedback_checkout_followup(sid);
 IF job<>feedback_checkout_followup(sid) OR (SELECT count(*) FROM service_jobs WHERE source_key='feedback-checkout:'||sid)<>1 THEN RAISE EXCEPTION 'Duplicate management review'; END IF;
 IF NOT EXISTS(SELECT 1 FROM stays WHERE id=sid AND checked_out_at IS NOT NULL) THEN RAISE EXCEPTION 'Checkout timestamp missing'; END IF;
 BEGIN
  UPDATE service_jobs SET status='completed' WHERE id=job;
  RAISE EXCEPTION 'Empty review accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Empty review accepted' THEN RAISE; END IF; END;
 PERFORM omniops_command('job_resolve',jsonb_build_object('property_id',f.property_id,'job_id',job,'resolution_notes','Guest left before collection; manager called and no response was received.'),gen_random_uuid());
 data:=feedback_collection_directory(current_date,'reviewed');
 IF jsonb_array_length(data->'guests')<>1 OR data->'guests'->0->>'collectionStatus'<>'reviewed' THEN RAISE EXCEPTION 'Management outcome missing'; END IF;
 IF EXISTS(SELECT 1 FROM feedback WHERE stay_id=sid) THEN RAISE EXCEPTION 'Review fabricated guest feedback'; END IF;
 -- A saved response that finishes at checkout closes the pending review.
 SELECT id INTO sid FROM stays WHERE property_id=f.property_id AND room_number='101';
 response:=submit_guest_feedback(jsonb_build_object('organization_id',f.org,'property_id',f.property_id,'stay_id',sid,'guest_name','Alex','room_number','101','department','Front Desk','rating',5,'status','resolved','tone','positive'),'[]');
 IF NOT EXISTS(SELECT 1 FROM service_jobs WHERE source_key='feedback-checkout:'||sid AND status='completed' AND resolution_notes LIKE 'Guest feedback was received after checkout%') THEN RAISE EXCEPTION 'Late response left an open review'; END IF;
 data:=feedback_collection_directory(NULL,'all');
 IF data::text LIKE '%public_token%' OR data::text LIKE '%email%' OR data::text LIKE '%comment%' THEN RAISE EXCEPTION 'Directory leaked private fields'; END IF;
END $$;
-- Only assigned operations staff may close a review, and the follow-up RPC stays property-scoped.
SELECT provision_workspace_user(reader_id,org,'import-reader@test.local','Reviewer',false,ARRAY[property_id],ARRAY['module:feedback','module:hospitality','module_access:configured','view_feedback','manage_service_jobs']) FROM import_fixture;
SELECT set_config('request.jwt.claim.sub',reader_id::text,true) FROM import_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f record; sid uuid; job uuid; BEGIN
 SELECT * INTO f FROM import_fixture;
 SELECT id INTO sid FROM stays WHERE property_id=f.property_id AND room_number='102';
 SELECT id INTO job FROM service_jobs WHERE source_key='feedback-checkout:'||sid;
 BEGIN
  PERFORM omniops_command('job_resolve',jsonb_build_object('property_id',f.property_id,'job_id',job,'resolution_notes','Unauthorized attempt'),gen_random_uuid());
  RAISE EXCEPTION 'Unassigned staff resolved review';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM feedback_checkout_followup(gen_random_uuid()); RAISE EXCEPTION 'Follow-up escaped property scope'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',owner_id::text,true) FROM import_fixture;
-- Non-PII readers get collection metadata even for responses outside their department.
SELECT provision_workspace_user(reader_id,org,'import-reader@test.local','Feedback reader',false,ARRAY[property_id],ARRAY['module:feedback','module_access:configured','view_feedback']) FROM import_fixture;
SELECT set_config('request.jwt.claim.sub',reader_id::text,true) FROM import_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE data jsonb; sid uuid; BEGIN
 data:=feedback_collection_directory(NULL,'collected');
 IF jsonb_array_length(data->'guests')<>2 OR data->>'canTakeFeedback'<>'false' OR EXISTS(SELECT 1 FROM jsonb_array_elements(data->'guests') g WHERE g->>'guestName'<>'Guest' OR g->'followup'<>'null'::jsonb) THEN RAISE EXCEPTION 'Reader metadata/privacy incorrect: %',data; END IF;
 SELECT id INTO sid FROM stays LIMIT 1;
 BEGIN PERFORM feedback_checkout_followup(sid); RAISE EXCEPTION 'Reader created management follow-up'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',owner_id::text,true) FROM import_fixture;
DO $$ DECLARE f record; rows jsonb; preview jsonb; request uuid:=gen_random_uuid(); BEGIN
 SELECT * INTO f FROM import_fixture;
 rows:=jsonb_build_array(jsonb_build_object('guest_name','Staff import guest','room_number','110','check_in_date',current_date,'check_out_date',current_date+2));
 preview:=import_guest_report(f.property_id,rows,'partial',request);
 PERFORM import_guest_report(f.property_id,rows,'partial',request,preview->>'token');
END $$;
SELECT provision_workspace_user(reader_id,org,'import-reader@test.local','Importer',false,ARRAY[property_id],ARRAY['module:hospitality','module_access:configured','import_guests']) FROM import_fixture;
SELECT set_config('request.jwt.claim.sub',reader_id::text,true) FROM import_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f record; preview jsonb; request uuid:=gen_random_uuid(); BEGIN
 SELECT * INTO f FROM import_fixture;
 preview:=import_guest_report(f.property_id,'[]','full',request);
 PERFORM import_guest_report(f.property_id,'[]','full',request,preview->>'token');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',owner_id::text,true) FROM import_fixture;
DO $$ DECLARE f record; BEGIN
 SELECT * INTO f FROM import_fixture;
 IF NOT EXISTS(SELECT 1 FROM service_jobs j JOIN stays s ON j.source_key='feedback-checkout:'||s.id WHERE s.property_id=f.property_id AND s.room_number='110' AND s.checked_out_at IS NOT NULL AND j.assigned_to=f.owner_id AND j.status='open') THEN RAISE EXCEPTION 'Staff checkout failed to persist assigned management review'; END IF;
 UPDATE service_jobs SET assigned_to=f.reader_id WHERE source_key='feedback-checkout:'||(SELECT id FROM stays WHERE property_id=f.property_id AND room_number='110');
END $$;
SELECT provision_workspace_user(reader_id,org,'import-reader@test.local','Reviewer',false,ARRAY[property_id],ARRAY['module:feedback','module:hospitality','module_access:configured','view_feedback','manage_service_jobs']) FROM import_fixture;
SELECT set_config('request.jwt.claim.sub',reader_id::text,true) FROM import_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f record; sid uuid; job uuid; data jsonb; BEGIN
 SELECT * INTO f FROM import_fixture;
 SELECT id INTO sid FROM stays WHERE property_id=f.property_id AND room_number='110';
 SELECT id INTO job FROM service_jobs WHERE source_key='feedback-checkout:'||sid;
 data:=feedback_collection_directory(current_date,'missed');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(data->'guests') g WHERE g->>'id'=sid::text AND (g->>'canReviewFollowup')::boolean) THEN RAISE EXCEPTION 'Assigned reviewer cannot review'; END IF;
 PERFORM omniops_command('job_resolve',jsonb_build_object('property_id',f.property_id,'job_id',job,'resolution_notes','Guest departed early; follow-up attempted by reception.'),gen_random_uuid());
 IF NOT EXISTS(SELECT 1 FROM service_jobs WHERE id=job AND status='completed' AND length(resolution_notes)>0) OR EXISTS(SELECT 1 FROM feedback WHERE stay_id=sid) THEN RAISE EXCEPTION 'Assigned review did not persist separately from guest feedback'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
` });
console.log('Guest import database acceptance passed.');
