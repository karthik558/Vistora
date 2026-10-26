import {execFileSync,execFile} from "node:child_process";
import {promisify} from "node:util";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const url=process.env.VISTORA_TEST_DATABASE_URL,psql=process.env.PSQL_BIN||"psql";
assert.ok(url&&new URL(url).pathname==="/vistora_test","Use a disposable database named vistora_test.");
const run=sql=>execFileSync(psql,[url,"-v","ON_ERROR_STOP=1","-q","-A","-t"],{input:sql,encoding:"utf8"}).trim();
run(String.raw`
BEGIN;
CREATE TEMP TABLE hotel_fixture AS SELECT gen_random_uuid() owner_a,gen_random_uuid() owner_b,gen_random_uuid() staff,gen_random_uuid() property_a,gen_random_uuid() property_b,gen_random_uuid() room_a,gen_random_uuid() guest_a,gen_random_uuid() stay_a;
INSERT INTO auth.users(id,email) SELECT owner_a,'hotel-a@test.local' FROM hotel_fixture UNION ALL SELECT owner_b,'hotel-b@test.local' FROM hotel_fixture UNION ALL SELECT staff,'hotel-staff@test.local' FROM hotel_fixture;
SELECT create_company(owner_a,'Hotel A','hotel-a-'||owner_a) FROM hotel_fixture;
SELECT create_company(owner_b,'Hotel B','hotel-b-'||owner_b) FROM hotel_fixture;
ALTER TABLE hotel_fixture ADD COLUMN org_a uuid;ALTER TABLE hotel_fixture ADD COLUMN org_b uuid;
UPDATE hotel_fixture SET org_a=(SELECT organization_id FROM organization_members WHERE user_id=owner_a),org_b=(SELECT organization_id FROM organization_members WHERE user_id=owner_b);
INSERT INTO properties(id,organization_id,name,slug,code,location,country,timezone) SELECT property_a,org_a,'Hotel A','hotel-a','HOTEL','City','India','UTC' FROM hotel_fixture UNION ALL SELECT property_b,org_b,'Hotel B','hotel-b','HOTEL','City','India','UTC' FROM hotel_fixture;
SELECT provision_workspace_user(staff,org_a,'hotel-staff@test.local','Staff',false,ARRAY[property_a],ARRAY['view_feedback','manage_complaints','manage_settings']) FROM hotel_fixture;
GRANT SELECT ON hotel_fixture TO authenticated;
SELECT set_config('request.jwt.claim.sub',owner_a::text,true) FROM hotel_fixture;
SET LOCAL ROLE authenticated;
SELECT save_hotel_settings(jsonb_build_object('organizationName','Hotel A','defaultTimezone','UTC','guestWelcomeMessage','Welcome','hospitality',jsonb_build_object('currency','USD','monthlyBudgetMinor',10000,'perExpenseLimitMinor',5000,'approvalThresholdMinor',1000,'requireInspection',true,'inspectionChecklist',jsonb_build_array('Clean','Safety'),'alertsEnabled',true))) FROM hotel_fixture;
INSERT INTO hotel_rooms(id,organization_id,property_id,room_number,capacity) SELECT room_a,org_a,property_a,'101',2 FROM hotel_fixture;
INSERT INTO guests(id,organization_id,full_name,email,preferences) SELECT guest_a,org_a,'Test guest','guest@test.local','Quiet room' FROM hotel_fixture;
INSERT INTO stays(id,organization_id,property_id,guest_id,room_id,room_number,check_in_date,check_out_date,public_token,status) SELECT stay_a,org_a,property_a,guest_a,room_a,'101',(now() AT TIME ZONE 'UTC')::date,(now() AT TIME ZONE 'UTC')::date+2,'test-'||stay_a,'reserved' FROM hotel_fixture;
DO $$ BEGIN
 BEGIN INSERT INTO stays(organization_id,property_id,guest_id,room_id,room_number,check_in_date,check_out_date,public_token,status) SELECT org_a,property_a,guest_a,room_a,'101',(now() AT TIME ZONE 'UTC')::date+1,(now() AT TIME ZONE 'UTC')::date+3,'overlap-'||stay_a,'reserved' FROM hotel_fixture; RAISE EXCEPTION 'Room overlap accepted'; EXCEPTION WHEN exclusion_violation THEN NULL; END;
 BEGIN UPDATE stays SET status='active' WHERE id=(SELECT stay_a FROM hotel_fixture); RAISE EXCEPTION 'Uninspected check-in accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Uninspected check-in accepted' THEN RAISE; END IF; END;
 BEGIN INSERT INTO hotel_rooms(organization_id,property_id,room_number) SELECT org_a,property_b,'999' FROM hotel_fixture; RAISE EXCEPTION 'Cross-company room accepted'; EXCEPTION WHEN raise_exception OR insufficient_privilege THEN IF SQLERRM='Cross-company room accepted' THEN RAISE; END IF; END;
END $$;
INSERT INTO room_inspections(organization_id,property_id,room_id,inspector_id,answers,passed) SELECT org_a,property_a,room_a,owner_a,'[{"label":"Clean","passed":true},{"label":"Safety","passed":false}]',true FROM hotel_fixture;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM room_inspections WHERE passed) THEN RAISE EXCEPTION 'Client forged inspection result'; END IF;
 IF (SELECT count(*) FROM service_jobs)<>1 THEN RAISE EXCEPTION 'Failed inspection did not create follow-up'; END IF;
END $$;
INSERT INTO room_inspections(organization_id,property_id,room_id,inspector_id,answers) SELECT org_a,property_a,room_a,owner_a,'[{"label":"Clean","passed":true},{"label":"Safety","passed":true}]' FROM hotel_fixture;
UPDATE stays SET status='active' WHERE id=(SELECT stay_a FROM hotel_fixture);
RESET ROLE;
SELECT submit_guest_feedback(jsonb_build_object('organization_id',org_a,'property_id',property_a,'stay_id',stay_a,'guest_name','Test guest','room_number','101','department','Front Desk','rating',4,'status','resolved','tone','positive')) FROM hotel_fixture;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM feedback f,hotel_fixture h WHERE f.stay_id=h.stay_a AND f.property_id=h.property_a) THEN RAISE EXCEPTION 'Stay feedback history missing'; END IF;
 BEGIN UPDATE feedback SET property_id=(SELECT property_b FROM hotel_fixture) WHERE stay_id=(SELECT stay_a FROM hotel_fixture); RAISE EXCEPTION 'Stay feedback moved across properties'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Stay feedback moved across properties' THEN RAISE; END IF; END;
END $$;
SET LOCAL ROLE authenticated;
UPDATE stays SET status='checked_out' WHERE id=(SELECT stay_a FROM hotel_fixture);
DO $$ BEGIN
 BEGIN UPDATE hotel_rooms SET status='inspected' WHERE id=(SELECT room_a FROM hotel_fixture); RAISE EXCEPTION 'Old inspection reused after checkout'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Old inspection reused after checkout' THEN RAISE; END IF; END;
END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM hotel_rooms r,hotel_fixture f WHERE r.id=f.room_a AND r.status='dirty') THEN RAISE EXCEPTION 'Checkout did not mark dirty'; END IF; END $$;
INSERT INTO service_jobs(organization_id,property_id,room_id,created_by,kind,title,due_at) SELECT org_a,property_a,room_a,owner_a,'cleaning','Turnover cleaning',now()-interval '1 hour' FROM hotel_fixture;
UPDATE service_jobs SET status='completed' WHERE kind='cleaning';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM hotel_rooms r,hotel_fixture f WHERE r.id=f.room_a AND r.status='clean') THEN RAISE EXCEPTION 'Cleaning did not mark clean'; END IF; END $$;
INSERT INTO service_jobs(organization_id,property_id,room_id,created_by,kind,title,due_at) SELECT org_a,property_a,room_a,owner_a,'maintenance','Overdue maintenance',now()-interval '1 hour' FROM hotel_fixture;
INSERT INTO operating_costs(organization_id,property_id,requested_by,description,category,amount_minor,currency) SELECT org_a,property_a,owner_a,'Small supply','supplies',500,'FORGED' FROM hotel_fixture;
INSERT INTO operating_costs(organization_id,property_id,requested_by,description,category,amount_minor,currency) SELECT org_a,property_a,owner_a,'Repair request','maintenance',3000,'USD' FROM hotel_fixture;
INSERT INTO operating_costs(organization_id,property_id,requested_by,description,category,amount_minor,currency) SELECT org_a,property_a,owner_a,'Second request','maintenance',5000,'USD' FROM hotel_fixture;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM operating_costs WHERE description='Small supply' AND status='approved' AND currency='USD') THEN RAISE EXCEPTION 'Automatic approval or currency stamping failed'; END IF;
 IF (hotel_budget_snapshot()->>'remaining')::bigint<>1500 THEN RAISE EXCEPTION 'Pending expenses did not reserve budget'; END IF;
 BEGIN INSERT INTO operating_costs(organization_id,property_id,requested_by,description,category,amount_minor,currency) SELECT org_a,property_a,owner_a,'Over cap','other',2000,'USD' FROM hotel_fixture; RAISE EXCEPTION 'Monthly cap bypassed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Monthly cap bypassed' THEN RAISE; END IF; END;
 BEGIN INSERT INTO operating_costs(organization_id,property_id,requested_by,description,category,amount_minor,currency) SELECT org_a,property_a,owner_a,'Over item limit','other',5001,'USD' FROM hotel_fixture; RAISE EXCEPTION 'Per-expense cap bypassed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Per-expense cap bypassed' THEN RAISE; END IF; END;
 BEGIN UPDATE organization_settings SET settings=settings-'hospitality'; RAISE EXCEPTION 'Budget settings cleared'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Budget settings cleared' THEN RAISE; END IF; END;
 BEGIN DELETE FROM organization_settings; RAISE EXCEPTION 'Budget settings deleted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Budget settings deleted' THEN RAISE; END IF; END;
 BEGIN PERFORM save_hotel_settings(jsonb_build_object('organizationName','Should roll back','defaultTimezone','UTC','hospitality',jsonb_build_object('currency','USD','monthlyBudgetMinor',100))); RAISE EXCEPTION 'Budget lowered below reservations'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Budget lowered below reservations' THEN RAISE; END IF; END;
 IF (SELECT name FROM organizations)<>'Hotel A' THEN RAISE EXCEPTION 'Settings were not atomic'; END IF;
END $$;
UPDATE operating_costs SET status='rejected' WHERE description='Repair request';
UPDATE operating_costs SET status='approved' WHERE description='Second request';
DO $$ BEGIN
 IF (hotel_budget_snapshot()->>'remaining')::bigint<>4500 THEN RAISE EXCEPTION 'Approval/rejection arithmetic failed'; END IF;
 BEGIN UPDATE operating_costs SET amount_minor=1 WHERE status='approved'; RAISE EXCEPTION 'Final cost altered'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Final cost altered' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM hotel_activity a,hotel_fixture f WHERE a.actor_id=f.owner_a AND a.entity_type='service_jobs') THEN RAISE EXCEPTION 'Attributed operations history missing'; END IF;
END $$;
RESET ROLE;
SELECT schedule_hotel_work(org_a) FROM hotel_fixture;
SELECT schedule_hotel_work(org_a) FROM hotel_fixture;
DO $$ BEGIN IF (SELECT count(*) FROM notification_outbox q,hotel_fixture f WHERE q.organization_id=f.org_a AND q.kind='operations_alert')<>1 THEN RAISE EXCEPTION 'Overdue alerts duplicated'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub',staff::text,true) FROM hotel_fixture;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM hotel_rooms) OR EXISTS(SELECT 1 FROM service_jobs) OR EXISTS(SELECT 1 FROM operating_costs) THEN RAISE EXCEPTION 'Staff accessed admin operations'; END IF;
 BEGIN INSERT INTO hotel_rooms(organization_id,property_id,room_number) SELECT org_a,property_a,'999' FROM hotel_fixture; RAISE EXCEPTION 'Staff created room'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM save_hotel_settings('{}'); RAISE EXCEPTION 'Staff changed configuration'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE profiles SET rights=ARRAY['module_access:configured','module:hospitality','view_feedback','manage_complaints'] WHERE id=(SELECT staff FROM hotel_fixture);
INSERT INTO properties(id,organization_id,name,slug,code,location,country) SELECT gen_random_uuid(),org_a,'Unassigned hotel','unassigned-hotel','OTHER','City','India' FROM hotel_fixture;
INSERT INTO hotel_rooms(organization_id,property_id,room_number) SELECT org_a,p.id,'PRIVATE' FROM hotel_fixture f JOIN properties p ON p.organization_id=f.org_a AND p.name='Unassigned hotel';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT workspace_module('hospitality') OR workspace_module('feedback') OR workspace_right('view_feedback') THEN RAISE EXCEPTION 'Explicit module grant not enforced'; END IF;
 IF (SELECT count(*) FROM hotel_rooms)<>1 OR EXISTS(SELECT 1 FROM hotel_rooms WHERE room_number='PRIVATE') THEN RAISE EXCEPTION 'Module grant crossed assigned property scope'; END IF;
 IF EXISTS(SELECT 1 FROM operating_costs) OR EXISTS(SELECT 1 FROM feedback) THEN RAISE EXCEPTION 'Hotel read access exposed financial or revoked feedback data'; END IF;
 UPDATE hotel_rooms SET notes='Staff must not edit';
 IF EXISTS(SELECT 1 FROM hotel_rooms WHERE notes='Staff must not edit') THEN RAISE EXCEPTION 'Read-only module grant permitted editing'; END IF;
END $$;
RESET ROLE;
UPDATE profiles SET rights=ARRAY['module_access:configured','module:feedback','view_feedback'] WHERE id=(SELECT staff FROM hotel_fixture);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM hotel_rooms) OR EXISTS(SELECT 1 FROM service_jobs) THEN RAISE EXCEPTION 'Revoked module remains accessible'; END IF;
 IF NOT workspace_right('view_feedback') OR NOT EXISTS(SELECT 1 FROM feedback) THEN RAISE EXCEPTION 'Assigned feedback module did not restore action permissions'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
`);
console.log("Hotel workflows, room overlap, inspections, budgets, isolation and atomic configuration passed.");

const owner=randomUUID(),property=randomUUID(),slug="race-"+randomUUID();
const org=run(`INSERT INTO auth.users(id,email) VALUES('${owner}','budget-race@test.local'); SELECT create_company('${owner}','Budget race','${slug}');`).split("\n").at(-1);
try{
 run(`INSERT INTO properties(id,organization_id,name,slug,code,location,country) VALUES('${property}','${org}','Race','race','RACE','Test','India'); UPDATE organization_settings SET settings=jsonb_set(settings,'{hospitality}','{"currency":"USD","monthlyBudgetMinor":10000,"perExpenseLimitMinor":10000,"approvalThresholdMinor":0}'::jsonb) WHERE organization_id='${org}';`);
 const execute=promisify(execFile);
 const request=`BEGIN; SELECT set_config('request.jwt.claim.sub','${owner}',true); SET LOCAL ROLE authenticated; INSERT INTO operating_costs(organization_id,property_id,requested_by,description,category,amount_minor,currency) VALUES('${org}','${property}','${owner}','Concurrent expense','other',6000,'USD'); SELECT pg_sleep(.15); COMMIT;`;
 const results=await Promise.allSettled([execute(psql,[url,"-v","ON_ERROR_STOP=1","-q","-c",request]),execute(psql,[url,"-v","ON_ERROR_STOP=1","-q","-c",request])]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1,"Only one competing expense may reserve the remaining budget.");
 assert.equal(run(`SELECT sum(amount_minor) FROM operating_costs WHERE organization_id='${org}'`),"6000");
 console.log("Concurrent budget reservation passed: exactly one request accepted.");
}finally{
 run(`DELETE FROM operating_costs WHERE organization_id='${org}'; DELETE FROM hotel_activity WHERE organization_id='${org}'; DELETE FROM properties WHERE organization_id='${org}'; DELETE FROM organization_settings WHERE organization_id='${org}'; DELETE FROM organization_members WHERE organization_id='${org}'; DELETE FROM profiles WHERE id='${owner}'; DELETE FROM auth.users WHERE id='${owner}'; DELETE FROM organizations WHERE id='${org}';`);
}
