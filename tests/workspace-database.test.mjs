// Run only against a disposable database with the schema already installed.
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const url=process.env.VISTORA_TEST_DATABASE_URL;
assert.ok(url&&new URL(url).pathname==="/vistora_test","Set VISTORA_TEST_DATABASE_URL to a disposable database named vistora_test.");
const sql=String.raw`
BEGIN;
CREATE TEMP TABLE fixture AS SELECT gen_random_uuid() owner_a,gen_random_uuid() owner_b,gen_random_uuid() staff,gen_random_uuid() outsider,gen_random_uuid() property_a,gen_random_uuid() property_b,gen_random_uuid() case_a,gen_random_uuid() case_house,gen_random_uuid() case_b;
INSERT INTO auth.users(id,email,raw_user_meta_data) SELECT owner_a,'a@test.local','{"full_name":"A","role":"admin"}'::jsonb FROM fixture UNION ALL SELECT owner_b,'b@test.local','{}'::jsonb FROM fixture UNION ALL SELECT staff,'staff@test.local','{}'::jsonb FROM fixture UNION ALL SELECT outsider,'invite@test.local','{"role":"admin"}'::jsonb FROM fixture;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM profiles p,fixture f WHERE p.id=f.outsider AND (p.role<>'visitor' OR p.organization_id IS NOT NULL)) THEN RAISE EXCEPTION 'Signup metadata granted access'; END IF; END $$;
SELECT create_company(owner_a,'Company A','test-a-'||owner_a) FROM fixture;
SELECT create_company(owner_b,'Company B','test-b-'||owner_b) FROM fixture;
ALTER TABLE fixture ADD COLUMN org_a uuid; ALTER TABLE fixture ADD COLUMN org_b uuid;
UPDATE fixture SET org_a=(SELECT organization_id FROM organization_members WHERE user_id=owner_a),org_b=(SELECT organization_id FROM organization_members WHERE user_id=owner_b);
INSERT INTO properties(id,organization_id,name,slug,code,location,country) SELECT property_a,org_a,'A','same-code','SAME','City','India' FROM fixture UNION ALL SELECT property_b,org_b,'B','same-code','SAME','City','India' FROM fixture;
SELECT provision_workspace_user(staff,org_a,'staff@test.local','Staff',false,ARRAY[property_a],ARRAY['view_feedback','manage_complaints','dept_scope:Housekeeping']) FROM fixture;
INSERT INTO feedback(id,organization_id,property_id,guest_name,guest_email,room_number,department,rating,recommendation_score,status) SELECT case_a,org_a,property_a,'Guest','guest@test.local','101','Front Desk'::department_type,2,10,'needs_attention'::feedback_status FROM fixture UNION ALL SELECT case_house,org_a,property_a,'Guest',null,'102','Housekeeping'::department_type,3,0,'under_review'::feedback_status FROM fixture UNION ALL SELECT case_b,org_b,property_b,'Guest',null,'103','Front Desk'::department_type,5,null,'resolved'::feedback_status FROM fixture;
GRANT SELECT ON fixture TO authenticated,anon;
SELECT set_config('request.jwt.claim.sub',staff::text,true) FROM fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM feedback; IF n<>1 THEN RAISE EXCEPTION 'Staff department/company boundary failed: %',n; END IF;
 IF EXISTS(SELECT 1 FROM feedback WHERE guest_email IS NOT NULL OR guest_phone IS NOT NULL) THEN RAISE EXCEPTION 'Contact details leaked through feedback'; END IF;
 IF EXISTS(SELECT 1 FROM feedback_contacts) THEN RAISE EXCEPTION 'Staff read private contact details without permission'; END IF;
 IF EXISTS(SELECT 1 FROM feedback f,fixture x WHERE f.organization_id=x.org_b) THEN RAISE EXCEPTION 'Company B leaked'; END IF;
 UPDATE profiles SET rights=ARRAY['manage_users'] WHERE id=auth.uid(); GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Staff elevated privileges'; END IF;
 UPDATE feedback SET status='resolved' WHERE id=(SELECT case_b FROM fixture); GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-company write allowed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM count(*) FROM feedback; RAISE EXCEPTION 'Anonymous feedback read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM claim_workspace_jobs(NULL,5); RAISE EXCEPTION 'Anonymous worker allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',owner_a::text,true) FROM fixture;
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM feedback_contacts c,fixture f WHERE c.feedback_id=f.case_a AND c.email='guest@test.local') THEN RAISE EXCEPTION 'Admin contact access failed'; END IF; END $$;
INSERT INTO organization_settings(organization_id,settings) SELECT org_a,'{"alertEmail":"ops@test.local","autoGuestFollowUp":true}' FROM fixture ON CONFLICT(organization_id) DO UPDATE SET settings=excluded.settings;
INSERT INTO feedback_comments(organization_id,feedback_id,author_id,body) SELECT org_a,case_a,owner_a,'Internal recovery discussion' FROM fixture;
UPDATE feedback SET status='resolved',assigned_to='A',resolution_notes='Guest contacted' WHERE id=(SELECT case_a FROM fixture);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM feedback_activity f,fixture x WHERE f.feedback_id=x.case_a AND f.actor_id=x.owner_a AND f.changes?'status') THEN RAISE EXCEPTION 'Attributed history missing'; END IF; END $$;
RESET ROLE;
DO $$ DECLARE raw text; BEGIN
 SELECT q.payload->>'token' INTO raw FROM notification_outbox q,fixture x WHERE q.organization_id=x.org_a AND q.kind='followup';
 IF raw IS NULL THEN RAISE EXCEPTION 'Follow-up was not queued'; END IF;
 IF NOT respond_recovery(encode(digest(raw,'sha256'),'hex'),5,0,'Recovered') THEN RAISE EXCEPTION 'Follow-up failed'; END IF;
 IF respond_recovery(encode(digest(raw,'sha256'),'hex'),1,1,'Replay') THEN RAISE EXCEPTION 'Follow-up replay accepted'; END IF;
END $$;
UPDATE feedback SET sla_deadline=now()-interval '1 hour' WHERE id=(SELECT case_house FROM fixture);
SELECT schedule_workspace_work(org_a) FROM fixture;
SELECT schedule_workspace_work(org_a) FROM fixture;
DO $$ BEGIN IF (SELECT count(*) FROM notification_outbox q,fixture x WHERE q.organization_id=x.org_a AND q.kind='sla')<>1 THEN RAISE EXCEPTION 'Duplicate SLA alert'; END IF; END $$;
CREATE TEMP TABLE claimed AS SELECT q.* FROM fixture x CROSS JOIN LATERAL claim_workspace_jobs(x.org_a,25) q;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM fixture x CROSS JOIN LATERAL claim_workspace_jobs(x.org_a,25) q) THEN RAISE EXCEPTION 'Concurrent duplicate claim'; END IF; END $$;
DO $$ DECLARE job notification_outbox; BEGIN
 SELECT * INTO job FROM claimed LIMIT 1;
 IF finish_workspace_job(job.id,gen_random_uuid(),'delivered','Stale worker') THEN RAISE EXCEPTION 'Wrong lease accepted'; END IF;
 IF NOT finish_workspace_job(job.id,job.lease_token,'blocked','Provider unconfigured') THEN RAISE EXCEPTION 'Worker completion failed'; END IF;
 PERFORM retry_workspace_job(job.id,job.organization_id);
 IF (SELECT count(*) FROM notification_deliveries WHERE outbox_id=job.id)<>1 THEN RAISE EXCEPTION 'Retry erased history'; END IF;
END $$;
DO $$ DECLARE invitation uuid; result jsonb; n int; BEGIN
 INSERT INTO guest_invitations(organization_id,property_id,token_hash,guest_name,room_number) SELECT org_a,property_a,encode(digest('single-use','sha256'),'hex'),'Guest','101' FROM fixture RETURNING id INTO invitation;
 SELECT submit_guest_feedback(jsonb_build_object('organization_id',org_a,'property_id',property_a,'invitation_id',invitation,'recommendation_score',0,'guest_name','Guest','room_number','101','department','Front Desk','rating',3,'status','under_review','tone','review'),'[]') INTO result FROM fixture;
 IF NOT EXISTS(SELECT 1 FROM guest_invitations WHERE id=invitation AND status='completed' AND feedback_id=(result->>'id')::uuid) THEN RAISE EXCEPTION 'Invitation completion failed'; END IF;
 BEGIN
  PERFORM submit_guest_feedback(jsonb_build_object('organization_id',org_a,'property_id',property_a,'invitation_id',invitation,'guest_name','Guest','room_number','101','department','Front Desk','rating',3,'status','under_review','tone','review'),'[]') FROM fixture;
  RAISE EXCEPTION 'Invitation replay accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Invitation replay accepted' THEN RAISE; END IF; END;
 SELECT count(*) INTO n FROM feedback WHERE organization_id=(SELECT org_a FROM fixture);
 BEGIN
  PERFORM submit_guest_feedback(jsonb_build_object('organization_id',org_a,'property_id',property_a,'guest_name','Guest','room_number','101','department','Front Desk','rating',3,'status','under_review','tone','review'),'[{"questionId":"00000000-0000-0000-0000-000000000099","questionText":"Invalid","answerValue":"No"}]') FROM fixture;
 EXCEPTION WHEN foreign_key_violation OR raise_exception THEN NULL; END;
 IF (SELECT count(*) FROM feedback WHERE organization_id=(SELECT org_a FROM fixture))<>n THEN RAISE EXCEPTION 'Partial guest submission committed'; END IF;
END $$;
DO $$ DECLARE invitation uuid; org uuid; BEGIN
 INSERT INTO team_invitations(organization_id,email,token_hash,invited_by,property_ids) SELECT org_a,'invite@test.local',encode(digest('team-token','sha256'),'hex'),owner_a,ARRAY[property_a] FROM fixture RETURNING id INTO invitation;
 SELECT accept_team_invitation(outsider,encode(digest('team-token','sha256'),'hex')) INTO org FROM fixture;
 IF org<>(SELECT org_a FROM fixture) THEN RAISE EXCEPTION 'Wrong company accepted'; END IF;
 BEGIN PERFORM accept_team_invitation(outsider,encode(digest('team-token','sha256'),'hex')) FROM fixture; RAISE EXCEPTION 'Team invitation replay accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Team invitation replay accepted' THEN RAISE; END IF; END;
END $$;
DO $$ BEGIN
 BEGIN INSERT INTO feedback_comments(organization_id,feedback_id,author_id,body) SELECT org_a,case_b,owner_a,'Cross company' FROM fixture; RAISE EXCEPTION 'Cross-company parent allowed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Cross-company parent allowed' THEN RAISE; END IF; END;
END $$;
INSERT INTO report_schedules(organization_id,created_by,name,recipient_email,frequency,period_days) SELECT org_a,owner_a,'Weekly','ops@test.local','weekly',7 FROM fixture;
SELECT schedule_workspace_work(org_a) FROM fixture;
SELECT schedule_workspace_work(org_a) FROM fixture;
DO $$ BEGIN IF (SELECT count(*) FROM report_runs r,fixture f WHERE r.organization_id=f.org_a)<>1 THEN RAISE EXCEPTION 'Report schedule duplicated'; END IF; END $$;
DO $$ DECLARE result jsonb; BEGIN
 SELECT create_guest_invitation(jsonb_build_object('organization_id',org_a,'property_id',property_a,'guest_name','Queued Guest','guest_email','guest@test.local','room_number','101','channel','email','token_encrypted','test-only'),'queued-invitation') INTO result FROM fixture;
 IF NOT EXISTS(SELECT 1 FROM notification_outbox WHERE dedup_key='invitation:'||(result->>'id')) THEN RAISE EXCEPTION 'Invitation outbox was not committed atomically'; END IF;
END $$;
INSERT INTO feedback_attachments(organization_id,feedback_id,uploaded_by,object_path,filename,content_type,size_bytes) SELECT org_a,case_house,owner_a,org_a::text||'/'||case_house::text||'/test-object','test.txt','text/plain',10 FROM fixture;
DELETE FROM feedback WHERE id=(SELECT case_house FROM fixture);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM notification_outbox q,fixture f WHERE q.organization_id=f.org_a AND q.kind='asset_cleanup') THEN RAISE EXCEPTION 'Attachment cleanup missing'; END IF; END $$;
DELETE FROM properties WHERE id=(SELECT property_a FROM fixture);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM profiles p,fixture f WHERE p.id=f.staff AND f.property_a=ANY(p.property_ids)) THEN RAISE EXCEPTION 'Deleted property assignment retained'; END IF; IF NOT EXISTS(SELECT 1 FROM properties p,fixture f WHERE p.id=f.property_b) THEN RAISE EXCEPTION 'Other company property deleted'; END IF; END $$;
ROLLBACK;
SELECT 'Workspace database checks passed';
`;
const out=execFileSync(process.env.PSQL_BIN||"psql",[url,"-v","ON_ERROR_STOP=1","-q"],{input:sql,encoding:"utf8"});
console.log(out.trim());
