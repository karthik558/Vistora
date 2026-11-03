import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const url = process.env.VISTORA_TEST_DATABASE_URL;
assert.ok(url && new URL(url).pathname === '/vistora_test', 'Use a disposable database named vistora_test.');
const sql = String.raw`
BEGIN;
CREATE TEMP TABLE security_fixture AS SELECT gen_random_uuid() owner_a,gen_random_uuid() owner_b,gen_random_uuid() manager,gen_random_uuid() property_a,gen_random_uuid() property_a2,gen_random_uuid() property_b,gen_random_uuid() invitation;
INSERT INTO auth.users(id,email,raw_user_meta_data) SELECT owner_a,'security-owner-a@test.local','{}'::jsonb FROM security_fixture UNION ALL SELECT owner_b,'security-owner-b@test.local','{}'::jsonb FROM security_fixture UNION ALL SELECT manager,'security-manager@test.local','{}'::jsonb FROM security_fixture;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM profiles p,security_fixture f WHERE p.id IN (f.owner_a,f.owner_b,f.manager) AND (p.organization_id IS NOT NULL OR p.role<>'visitor' OR cardinality(p.rights)>0)) THEN RAISE EXCEPTION 'Signup acquired workspace access'; END IF; END $$;
SELECT create_company(owner_a,'Security A','security-a-'||owner_a) FROM security_fixture;
SELECT create_company(owner_b,'Security B','security-b-'||owner_b) FROM security_fixture;
ALTER TABLE security_fixture ADD COLUMN org_a uuid; ALTER TABLE security_fixture ADD COLUMN org_b uuid;
UPDATE security_fixture SET org_a=(SELECT organization_id FROM organization_members WHERE user_id=owner_a),org_b=(SELECT organization_id FROM organization_members WHERE user_id=owner_b);
INSERT INTO properties(id,organization_id,name,slug,code,location,country) SELECT property_a,org_a,'A','security-a-'||property_a,'A','City','India' FROM security_fixture UNION ALL SELECT property_a2,org_a,'A2','security-a2-'||property_a2,'A2','City','India' FROM security_fixture UNION ALL SELECT property_b,org_b,'B','security-b-'||property_b,'B','City','India' FROM security_fixture;
SELECT provision_workspace_user(manager,org_a,'security-manager@test.local','Manager',false,ARRAY[property_a],ARRAY['module:feedback','view_feedback','manage_users','manage_properties','manage_settings','manage_role_mapping']) FROM security_fixture;
INSERT INTO guest_invitations(id,organization_id,property_id,token_hash,guest_name,room_number) SELECT invitation,org_a,property_a,'security-'||invitation,'Guest','101' FROM security_fixture;
GRANT SELECT ON security_fixture TO authenticated,anon;
SELECT set_config('request.jwt.claim.sub',manager::text,true) FROM security_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer; BEGIN
 UPDATE profiles SET rights=ARRAY['org_role:super_admin'] WHERE id=auth.uid(); GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Delegated manager elevated their own profile'; END IF;
 UPDATE profiles SET rights=ARRAY['org_role:super_admin'] WHERE id=(SELECT owner_a FROM security_fixture); GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Delegated manager modified owner rights'; END IF;
 UPDATE properties SET name='Unauthorized' WHERE id=(SELECT property_a FROM security_fixture); GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Direct property administration bypassed API policy'; END IF;
 UPDATE organization_settings SET settings='{}'; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Direct settings update bypassed API policy'; END IF;
 BEGIN
  INSERT INTO role_mappings(organization_id,module,property_id,department,role_name,assignee_id,max_rating) SELECT org_a,'feedback',property_a2,'Front Desk','Duty manager',owner_a,3 FROM security_fixture;
  RAISE EXCEPTION 'Manager configured another property';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM submit_guest_feedback('{}'::jsonb,'[]'::jsonb);
  RAISE EXCEPTION 'Authenticated users can call the privileged submission RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM * FROM public.properties; RAISE EXCEPTION 'Anonymous properties exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM submit_guest_feedback('{}'::jsonb,'[]'::jsonb); RAISE EXCEPTION 'Anonymous privileged submission allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Two accepted HTTP requests must not save a one-time invitation twice.
SELECT submit_guest_feedback(jsonb_build_object('organization_id',org_a,'property_id',property_a,'invitation_id',invitation,'guest_name','Guest','room_number','101','department','Front Desk','rating',5,'status','resolved','tone','positive'),'[]'::jsonb) FROM security_fixture;
DO $$ DECLARE f security_fixture; n integer; BEGIN
 SELECT * INTO f FROM security_fixture;
 IF NOT EXISTS(SELECT 1 FROM guest_invitations WHERE id=f.invitation AND status='completed' AND feedback_id IS NOT NULL) THEN RAISE EXCEPTION 'Invitation completion was not atomic'; END IF;
 BEGIN
  PERFORM submit_guest_feedback(jsonb_build_object('organization_id',f.org_a,'property_id',f.property_a,'invitation_id',f.invitation,'guest_name','Guest','room_number','101','department','Front Desk','rating',5,'status','resolved','tone','positive'),'[]'::jsonb);
  RAISE EXCEPTION 'Invitation replay accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT count(*) INTO n FROM feedback WHERE invitation_id=f.invitation;
 IF n<>1 THEN RAISE EXCEPTION 'Duplicate invitation feedback'; END IF;
 BEGIN
  PERFORM submit_guest_feedback(jsonb_build_object('organization_id',f.org_b,'property_id',f.property_a,'guest_name','Guest','room_number','101','department','Front Desk','rating',5,'status','resolved','tone','positive'),'[]'::jsonb);
  RAISE EXCEPTION 'Cross-tenant property accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
`;
execFileSync(process.env.PSQL_BIN || 'psql', [url, '-v', 'ON_ERROR_STOP=1', '-q'], { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
console.log('Database security checks passed (fixtures rolled back).');
