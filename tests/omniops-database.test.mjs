import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const url = process.env.VISTORA_TEST_DATABASE_URL;
assert.ok(
  url && new URL(url).pathname === "/vistora_test",
  "Use a disposable database named vistora_test.",
);
const run = (sql) =>
  execFileSync(
    process.env.PSQL_BIN || "psql",
    [url, "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t"],
    { input: sql, encoding: "utf8" },
  ).trim();
const output = run(String.raw`
BEGIN;
CREATE TEMP TABLE ops_fixture AS SELECT gen_random_uuid() owner_a,gen_random_uuid() owner_b,gen_random_uuid() staff,gen_random_uuid() reader,gen_random_uuid() property_a,gen_random_uuid() property_b,gen_random_uuid() room_a,gen_random_uuid() guest_a,gen_random_uuid() stay_a,gen_random_uuid() cleaning_request,gen_random_uuid() complete_request;
INSERT INTO auth.users(id,email) SELECT owner_a,'ops-a@test.local' FROM ops_fixture UNION ALL SELECT owner_b,'ops-b@test.local' FROM ops_fixture UNION ALL SELECT staff,'ops-staff@test.local' FROM ops_fixture UNION ALL SELECT reader,'ops-reader@test.local' FROM ops_fixture;
SELECT create_company(owner_a,'Ops A','ops-a-'||owner_a) FROM ops_fixture;
SELECT create_company(owner_b,'Ops B','ops-b-'||owner_b) FROM ops_fixture;
ALTER TABLE ops_fixture ADD COLUMN org_a uuid;ALTER TABLE ops_fixture ADD COLUMN org_b uuid;ALTER TABLE ops_fixture ADD COLUMN cleaning_id uuid;ALTER TABLE ops_fixture ADD COLUMN item_id uuid;ALTER TABLE ops_fixture ADD COLUMN asset_id uuid;ALTER TABLE ops_fixture ADD COLUMN template_id uuid;ALTER TABLE ops_fixture ADD COLUMN luggage_id uuid;ALTER TABLE ops_fixture ADD COLUMN valet_id uuid;ALTER TABLE ops_fixture ADD COLUMN guest_link uuid;ALTER TABLE ops_fixture ADD COLUMN source_feedback_id uuid;
UPDATE ops_fixture SET org_a=(SELECT organization_id FROM organization_members WHERE user_id=owner_a),org_b=(SELECT organization_id FROM organization_members WHERE user_id=owner_b);
INSERT INTO properties(id,organization_id,name,slug,code,location,country,timezone) SELECT property_a,org_a,'Ops A','ops-a','OPSA','City','India','UTC' FROM ops_fixture UNION ALL SELECT property_b,org_b,'Ops B','ops-b','OPSB','City','India','UTC' FROM ops_fixture;
SELECT provision_workspace_user(staff,org_a,'ops-staff@test.local','Cleaner',false,ARRAY[property_a],ARRAY['module:hospitality','module_access:configured','manage_service_jobs','dept_scope:Housekeeping']) FROM ops_fixture;
SELECT provision_workspace_user(reader,org_a,'ops-reader@test.local','Reader',false,ARRAY[property_a],ARRAY['module:hospitality','module_access:configured']) FROM ops_fixture;
GRANT SELECT,UPDATE ON ops_fixture TO authenticated;
SELECT set_config('request.jwt.claim.sub',owner_a::text,true) FROM ops_fixture;
SET LOCAL ROLE authenticated;
SELECT save_hotel_settings(jsonb_build_object('organizationName','Ops A','defaultTimezone','UTC','hospitality',jsonb_build_object('requireInspection',false,'currency','INR'))) FROM ops_fixture;
INSERT INTO hotel_rooms(id,organization_id,property_id,room_number,status) SELECT room_a,org_a,property_a,'101','clean' FROM ops_fixture;
INSERT INTO guests(id,organization_id,full_name) SELECT guest_a,org_a,'Guest A' FROM ops_fixture;
INSERT INTO stays(id,organization_id,property_id,guest_id,room_id,room_number,check_in_date,check_out_date,public_token,status) SELECT stay_a,org_a,property_a,guest_a,room_a,'101',current_date,current_date+2,'ops-'||stay_a,'reserved' FROM ops_fixture;
UPDATE stays SET status='active' WHERE id=(SELECT stay_a FROM ops_fixture);
UPDATE ops_fixture f SET item_id=(omniops_command('catalog',jsonb_build_object('property_id',f.property_a,'name','Water','price_minor',125,'par_level',3),gen_random_uuid())->>'id')::uuid;
UPDATE ops_fixture f SET cleaning_id=(omniops_command('job_create',jsonb_build_object('property_id',f.property_a,'room_id',f.room_a,'title','Clean 101','kind','cleaning','department','Housekeeping','priority','normal','assigned_to',f.staff,'due_at',now()+interval '1 hour'),f.cleaning_request)->>'id')::uuid;
SELECT omniops_command('job_create','{}',cleaning_request) FROM ops_fixture;
DO $$ BEGIN IF (SELECT count(*) FROM service_jobs WHERE title='Clean 101')<>1 THEN RAISE EXCEPTION 'Job retry duplicated work'; END IF; END $$;
RESET ROLE;
UPDATE ops_fixture f SET source_feedback_id=(submit_guest_feedback(jsonb_build_object('organization_id',f.org_a,'property_id',f.property_a,'guest_name','Test guest','room_number','101','department','Front Desk','rating',4,'status','under_review','tone','positive'))->>'id')::uuid;
SET LOCAL ROLE authenticated;
SELECT omniops_command('job_create',jsonb_build_object('property_id',property_a,'room_id',room_a,'feedback_id',source_feedback_id,'title','Linked feedback follow-up','kind','guest_request','department','Front Desk','priority','normal','due_at',now()+interval '1 hour'),gen_random_uuid()) FROM ops_fixture;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM service_jobs j,ops_fixture f WHERE j.title='Linked feedback follow-up' AND j.feedback_id=f.source_feedback_id) THEN RAISE EXCEPTION 'Manual feedback-to-job linking was lost';END IF;END $$;
SELECT omniops_command('job_create',jsonb_build_object('property_id',property_a,'room_id',room_a,'title','Configured response target','kind','guest_request','department','Front Desk','priority','normal'),gen_random_uuid()) FROM ops_fixture;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM service_jobs WHERE title='Configured response target' AND due_at=now()+interval '120 minutes') THEN RAISE EXCEPTION 'Workspace default response target was lost';END IF;END $$;
UPDATE ops_fixture f SET asset_id=(omniops_command('asset',jsonb_build_object('property_id',f.property_a,'name','AC 101','category','HVAC','location','101','room_id',f.room_a),gen_random_uuid())->>'id')::uuid;
SELECT omniops_command('maintenance',jsonb_build_object('property_id',property_a,'asset_id',asset_id,'title','Monthly HVAC','interval_days',30,'next_due_at',now()-interval '1 minute'),gen_random_uuid()) FROM ops_fixture;
UPDATE ops_fixture f SET template_id=(omniops_command('template',jsonb_build_object('property_id',f.property_a,'name','Safety','checks',jsonb_build_array('Fire exit','Lighting')),gen_random_uuid())->>'id')::uuid;
UPDATE ops_fixture f SET luggage_id=(omniops_command('luggage',jsonb_build_object('property_id',f.property_a,'stay_id',f.stay_a,'pieces',2,'storage_location','Rack A'),gen_random_uuid())->>'id')::uuid;
UPDATE ops_fixture f SET valet_id=(omniops_command('valet',jsonb_build_object('property_id',f.property_a,'stay_id',f.stay_a,'registration','TEST101','parking_bay','B1'),gen_random_uuid())->>'id')::uuid;
DO $$ DECLARE f ops_fixture;BEGIN SELECT * INTO f FROM ops_fixture;
 BEGIN PERFORM omniops_command('asset',jsonb_build_object('property_id',f.property_b,'name','Cross tenant','category','HVAC','location','X'),gen_random_uuid());RAISE EXCEPTION 'Cross-tenant command accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM omniops_command('luggage_status',jsonb_build_object('property_id',f.property_a,'id',f.luggage_id,'status','delivered'),gen_random_uuid());RAISE EXCEPTION 'Unverified handover accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Unverified handover accepted' THEN RAISE;END IF;END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',reader::text,true) FROM ops_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f ops_fixture;BEGIN SELECT * INTO f FROM ops_fixture;
 BEGIN PERFORM omniops_command('breakfast',jsonb_build_object('property_id',f.property_a,'stay_id',f.stay_a,'guest_count',1),gen_random_uuid());RAISE EXCEPTION 'Read-only member wrote attendance';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO luggage_logs(organization_id,property_id,stay_id,pieces,storage_location) VALUES(f.org_a,f.property_a,f.stay_a,1,'X');RAISE EXCEPTION 'Direct extension write allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF EXISTS(SELECT 1 FROM folio_entries) THEN RAISE EXCEPTION 'Reader saw financials';END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',staff::text,true) FROM ops_fixture;
SET LOCAL ROLE authenticated;
UPDATE service_jobs SET status='in_progress' WHERE id=(SELECT cleaning_id FROM ops_fixture);
DO $$ DECLARE f ops_fixture;BEGIN SELECT * INTO f FROM ops_fixture;
 BEGIN PERFORM omniops_command('job_create',jsonb_build_object('property_id',f.property_a,'room_id',f.room_a,'feedback_id',f.source_feedback_id,'title','Unauthorized source','kind','guest_request','department','Housekeeping','priority','normal','due_at',now()+interval '1 hour'),gen_random_uuid());RAISE EXCEPTION 'Feedback linkage bypassed feedback-read permission';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE service_jobs SET status='completed' WHERE id=f.cleaning_id;RAISE EXCEPTION 'Cleaning bypassed checklist';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Cleaning bypassed checklist' THEN RAISE;END IF;END;
 BEGIN PERFORM omniops_command('cleaning',jsonb_build_object('property_id',f.property_a,'job_id',f.cleaning_id,'access_confirmed',true,'linen_changed',true,'amenities_restocked',true,'minibar_restocked',true,'minibar',jsonb_build_array(jsonb_build_object('item_id',f.item_id,'quantity',4))),gen_random_uuid());RAISE EXCEPTION 'Excess minibar quantity accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Excess minibar quantity accepted' THEN RAISE;END IF;END;
END $$;
SELECT omniops_command('cleaning',jsonb_build_object('property_id',property_a,'job_id',cleaning_id,'access_confirmed',true,'linen_changed',true,'amenities_restocked',true,'minibar_restocked',true,'minibar',jsonb_build_array(jsonb_build_object('item_id',item_id,'quantity',2,'price_minor',1))),complete_request) FROM ops_fixture;
SELECT omniops_command('cleaning','{}',complete_request) FROM ops_fixture;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM folio_entries) THEN RAISE EXCEPTION 'Cleaner saw financial entries';END IF; END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM room_cleaning_runs c,ops_fixture f WHERE c.job_id=f.cleaning_id)<>1 THEN RAISE EXCEPTION 'Cleaning retry duplicated completion';END IF;
 IF NOT EXISTS(SELECT 1 FROM folio_entries e,ops_fixture f WHERE e.stay_id=f.stay_a AND e.amount_minor=250 AND e.status='pending') THEN RAISE EXCEPTION 'Minibar price not authoritative'; END IF;
 IF NOT EXISTS(SELECT 1 FROM service_jobs j,ops_fixture f WHERE j.id=f.cleaning_id AND j.status='completed') THEN RAISE EXCEPTION 'Cleaning did not close job';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',owner_a::text,true) FROM ops_fixture;
SET LOCAL ROLE authenticated;
RESET ROLE;
INSERT INTO webhook_endpoints(organization_id,url,secret_encrypted) SELECT org_a,'https://example.test/housekeeping','test-only-secret' FROM ops_fixture;
SET LOCAL ROLE authenticated;
SELECT omniops_command('breakfast_webhook',jsonb_build_object('property_id',property_a,'endpoint_id',(SELECT id FROM webhook_endpoints LIMIT 1)),gen_random_uuid()) FROM ops_fixture;
SELECT omniops_command('breakfast',jsonb_build_object('property_id',property_a,'stay_id',stay_a,'guest_count',1),gen_random_uuid()) FROM ops_fixture;
DO $$ DECLARE f ops_fixture;BEGIN SELECT * INTO f FROM ops_fixture;
 BEGIN PERFORM omniops_command('breakfast',jsonb_build_object('property_id',f.property_a,'stay_id',f.stay_a,'guest_count',1),gen_random_uuid());RAISE EXCEPTION 'Breakfast duplicate accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Breakfast duplicate accepted' THEN RAISE;END IF;END;
 IF (SELECT count(*) FROM notification_outbox WHERE payload->>'event'='housekeeping.breakfast_attended')<>1 THEN RAISE EXCEPTION 'Breakfast webhook was missing or duplicated';END IF;
 IF NOT EXISTS(SELECT 1 FROM stays WHERE id=f.stay_a AND status='active') THEN RAISE EXCEPTION 'Breakfast changed occupancy';END IF;
END $$;
SELECT omniops_command('inspection',jsonb_build_object('property_id',property_a,'template_id',template_id,'location','Lobby','answers',jsonb_build_array(jsonb_build_object('label','Fire exit','passed',true),jsonb_build_object('label','Lighting','passed',false))),gen_random_uuid()) FROM ops_fixture;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM service_jobs WHERE inspection_id IS NOT NULL AND location='Lobby' AND department='Engineering') THEN RAISE EXCEPTION 'Failed public area check did not create linked engineering job';END IF; END $$;
SELECT submit_service_complaint(jsonb_build_object('property_id',property_a,'issue_type','noise','location','101','title','Noise incident')) FROM ops_fixture;
SELECT omniops_command('compensation',jsonb_build_object('property_id',property_a,'job_id',(SELECT id FROM service_jobs WHERE issue_type='noise' LIMIT 1),'stay_id',stay_a,'kind','amenity_credit','reason','Guest recovery approved for review','amount_minor',500),gen_random_uuid()) FROM ops_fixture;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM incident_compensations c JOIN folio_entries e ON e.id=c.folio_entry_id WHERE e.amount_minor=-500 AND e.status='pending') THEN RAISE EXCEPTION 'Compensation did not create pending credit';END IF;END $$;
SELECT omniops_command('job_resolve',jsonb_build_object('property_id',property_a,'job_id',(SELECT id FROM service_jobs WHERE issue_type='noise' LIMIT 1),'resolution_notes','Noise source removed; guest informed'),gen_random_uuid()) FROM ops_fixture;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM service_jobs WHERE issue_type='noise' AND status='completed' AND resolution_notes='Noise source removed; guest informed') THEN RAISE EXCEPTION 'Resolution notes were not preserved';END IF;END $$;
SELECT omniops_command('telephony',jsonb_build_object('property_id',property_a,'stay_id',stay_a,'kind','wake_up','scheduled_at',now()+interval '1 hour','notes','Wake-up test'),gen_random_uuid()) FROM ops_fixture;
SELECT omniops_command('job_create',jsonb_build_object('property_id',property_a,'room_id',room_a,'title','Push lease test','kind','guest_request','department','Housekeeping','priority','high','assigned_to',staff,'due_at',now()+interval '1 hour'),gen_random_uuid()) FROM ops_fixture;

SELECT omniops_command('luggage_status',jsonb_build_object('property_id',property_a,'id',luggage_id,'status','requested'),gen_random_uuid()) FROM ops_fixture;
SELECT omniops_command('luggage_status',jsonb_build_object('property_id',property_a,'id',luggage_id,'status','in_transit'),gen_random_uuid()) FROM ops_fixture;
SELECT omniops_command('luggage_status',jsonb_build_object('property_id',property_a,'id',luggage_id,'status','delivered','verification','Guest verified'),gen_random_uuid()) FROM ops_fixture;
UPDATE properties SET timezone='Asia/Kolkata' WHERE id=(SELECT property_a FROM ops_fixture);
SELECT omniops_command('guest_link',jsonb_build_object('property_id',property_a,'stay_id',stay_a,'token_hash',repeat('a',64)),gen_random_uuid()) FROM ops_fixture;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM guest_service_links l JOIN stays s ON s.id=l.stay_id WHERE l.expires_at=((s.check_out_date+1)::timestamp AT TIME ZONE 'Asia/Kolkata')) THEN RAISE EXCEPTION 'Guest link expiry did not use property time zone';END IF;END $$;
INSERT INTO ops_push_subscriptions(organization_id,user_id,endpoint,subscription) SELECT org_a,staff,'https://fcm.googleapis.com/test-lease','{}'::jsonb FROM ops_fixture;
DO $$ DECLARE first_batch jsonb;BEGIN
 first_batch:=claim_ops_push(NULL,20);
 IF jsonb_array_length(first_batch)<>1 THEN RAISE EXCEPTION 'Eligible owner push was missing';END IF;
 IF jsonb_array_length(claim_ops_push(NULL,20))<>0 THEN RAISE EXCEPTION 'Concurrent push lease duplicated notice';END IF;
 UPDATE ops_push_deliveries SET retry_after=now()-interval '1 second';
 IF jsonb_array_length(claim_ops_push(NULL,20))<>1 THEN RAISE EXCEPTION 'Expired push lease was not recovered';END IF;
 UPDATE ops_push_deliveries SET delivered_at=now();
 IF jsonb_array_length(claim_ops_push(NULL,20))<>0 THEN RAISE EXCEPTION 'Delivered push retried';END IF;
END $$;
SELECT ops_guest_request(repeat('a',64),'valet','11111111-1111-4111-8111-111111111111');
SELECT ops_guest_request(repeat('a',64),'valet','11111111-1111-4111-8111-111111111111');
DO $$ BEGIN IF (SELECT count(*) FROM guest_service_requests)<>1 THEN RAISE EXCEPTION 'Guest retry duplicated request';END IF; IF NOT EXISTS(SELECT 1 FROM valet_tickets WHERE status='requested') THEN RAISE EXCEPTION 'Guest retrieval did not dispatch vehicle';END IF;END $$;
UPDATE telephony_events SET scheduled_at=now()-interval '1 minute' WHERE kind='wake_up';
SELECT schedule_omniops_work(org_a) FROM ops_fixture;
SELECT schedule_omniops_work(org_a) FROM ops_fixture;
DO $$ BEGIN IF (SELECT count(*) FROM service_jobs WHERE title='Monthly HVAC')<>1 THEN RAISE EXCEPTION 'Recurring worker duplicated maintenance';END IF;END $$;
DO $$ BEGIN IF (SELECT count(*) FROM service_jobs WHERE title='Wake-up call')<>1 THEN RAISE EXCEPTION 'Wake-up dispatch was missing or duplicated';END IF;END $$;
SELECT set_config('request.jwt.claim.sub',owner_b::text,true) FROM ops_fixture;
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM ops_assets) OR EXISTS(SELECT 1 FROM luggage_logs) OR EXISTS(SELECT 1 FROM audit_trails) OR EXISTS(SELECT 1 FROM folio_entries) THEN RAISE EXCEPTION 'Cross-tenant extension visibility';END IF;END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',owner_a::text,true) FROM ops_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f ops_fixture;e public.folio_entries;BEGIN SELECT * INTO f FROM ops_fixture; SELECT * INTO e FROM folio_entries LIMIT 1;
 PERFORM omniops_command('folio_status',jsonb_build_object('property_id',f.property_a,'id',e.id,'status','approved'),gen_random_uuid());
 BEGIN PERFORM omniops_command('folio_status',jsonb_build_object('property_id',f.property_a,'id',e.id,'status','posted'),gen_random_uuid());RAISE EXCEPTION 'Posting without reference accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Posting without reference accepted' THEN RAISE;END IF;END;
 PERFORM omniops_command('folio_status',jsonb_build_object('property_id',f.property_a,'id',e.id,'status','posted','external_reference','PMS-101'),gen_random_uuid());
 BEGIN PERFORM omniops_command('folio_status',jsonb_build_object('property_id',f.property_a,'id',e.id,'status','rejected'),gen_random_uuid());RAISE EXCEPTION 'Posted entry changed';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Posted entry changed' THEN RAISE;END IF;END;
 IF jsonb_array_length(omniops_trend(f.property_a))<>14 THEN RAISE EXCEPTION 'Chart calendar incomplete';END IF;
END $$;
UPDATE stays SET status='checked_out' WHERE id=(SELECT stay_a FROM ops_fixture);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN BEGIN PERFORM ops_guest_request(repeat('a',64),'towels',gen_random_uuid());RAISE EXCEPTION 'Checked out guest requested service';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Checked out guest requested service' THEN RAISE;END IF;END;END $$;
ROLLBACK;
SELECT 'OmniOps transaction, isolation and workflow tests passed';
`);
assert.ok(
  output.includes("OmniOps transaction, isolation and workflow tests passed"),
);
console.log(
  "OmniOps database tests passed: tenant isolation, permissions, idempotency, cleaning/billing, breakfast, inspections, luggage, guest portal, maintenance, folio finality and checkout revocation.",
);
