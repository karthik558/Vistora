import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const backfill=readFileSync(new URL('../supabase/migrations/20261103_questionnaires_and_short_links.sql',import.meta.url),'utf8').split('-- BEGIN LEGACY FORM BACKFILL')[1].split('-- END LEGACY FORM BACKFILL')[0];
const url=process.env.VISTORA_TEST_DATABASE_URL;
assert.ok(url&&new URL(url).pathname==='/vistora_test','Use a disposable database named vistora_test.');
execFileSync(process.env.PSQL_BIN||'psql',[url,'-v','ON_ERROR_STOP=1','-q'],{stdio:['pipe','inherit','inherit'],input:String.raw`
BEGIN;
CREATE TEMP TABLE form_fixture AS SELECT gen_random_uuid() owner_a,gen_random_uuid() owner_b,gen_random_uuid() manager,gen_random_uuid() prop_a,gen_random_uuid() prop_a2,gen_random_uuid() prop_b,gen_random_uuid() form_a,gen_random_uuid() form_a2,gen_random_uuid() form_b,gen_random_uuid() question_a,gen_random_uuid() question_a2;
INSERT INTO auth.users(id,email) SELECT owner_a,'form-owner-a@test.local' FROM form_fixture UNION ALL SELECT owner_b,'form-owner-b@test.local' FROM form_fixture UNION ALL SELECT manager,'form-manager@test.local' FROM form_fixture;
SELECT create_company(owner_a,'Forms A','forms-a-'||owner_a) FROM form_fixture;
SELECT create_company(owner_b,'Forms B','forms-b-'||owner_b) FROM form_fixture;
ALTER TABLE form_fixture ADD COLUMN org_a uuid;ALTER TABLE form_fixture ADD COLUMN org_b uuid;
UPDATE form_fixture SET org_a=(SELECT organization_id FROM organization_members WHERE user_id=owner_a),org_b=(SELECT organization_id FROM organization_members WHERE user_id=owner_b);
INSERT INTO properties(id,organization_id,name,slug,code,location,country) SELECT prop_a,org_a,'Forms A','a-'||prop_a,'A','City','India' FROM form_fixture UNION ALL SELECT prop_a2,org_a,'Forms A2','a2-'||prop_a2,'A2','City','India' FROM form_fixture UNION ALL SELECT prop_b,org_b,'Forms B','b-'||prop_b,'B','City','India' FROM form_fixture;
INSERT INTO feedback_questions(organization_id,property_id,question_text,question_type) SELECT org_a,NULL,'Legacy shared question','text' FROM form_fixture;
${backfill}
${backfill}
DO $$ BEGIN IF (SELECT count(*) FROM feedback_questionnaires WHERE property_id=(SELECT prop_a FROM form_fixture))<>1 OR (SELECT count(*) FROM feedback_questions WHERE property_id=(SELECT prop_a FROM form_fixture) AND questionnaire_id IS NOT NULL)<>1 THEN RAISE EXCEPTION 'Legacy questionnaire not preserved independently or was duplicated'; END IF; END $$;
SELECT provision_workspace_user(manager,org_a,'form-manager@test.local','Manager',false,ARRAY[prop_a],ARRAY['module:feedback','manage_questionnaire']) FROM form_fixture;
INSERT INTO feedback_questionnaires(id,organization_id,property_id,name,title,introduction,accent_color) SELECT form_a,org_a,prop_a,'Post-stay','How was your stay?','Tell our team.','#334455' FROM form_fixture UNION ALL SELECT form_a2,org_a,prop_a,'Dining','How was your meal?','Tell our restaurant.','#556677' FROM form_fixture UNION ALL SELECT form_b,org_b,prop_b,'Post-stay','Other property','Other intro','#778899' FROM form_fixture;
INSERT INTO feedback_questions(id,organization_id,property_id,questionnaire_id,question_text,question_type,options,is_required,is_active) SELECT question_a,org_a,prop_a,form_a,'Stay question','choice','["Yes","No"]'::jsonb,true,true FROM form_fixture UNION ALL SELECT question_a2,org_a,prop_a,form_a2,'Dining question','text','[]'::jsonb,false,true FROM form_fixture;
INSERT INTO guest_feedback_links(organization_id,property_id,token_hash,room) SELECT org_a,prop_a,'test-link-'||prop_a,'101' FROM form_fixture;
GRANT SELECT ON form_fixture TO authenticated,anon;
SELECT set_config('request.jwt.claim.sub',manager::text,true) FROM form_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f form_fixture; count_forms int; selected jsonb; BEGIN
 SELECT * INTO f FROM form_fixture;
 SELECT count(*) INTO count_forms FROM feedback_questionnaires;
 IF count_forms<>3 THEN RAISE EXCEPTION 'Questionnaires leaked across properties/tenants'; END IF;
 selected:=select_guest_questionnaire(f.form_a);
 IF (selected->>'id')::uuid<>f.form_a THEN RAISE EXCEPTION 'Wrong guest form selected'; END IF;
 selected:=select_guest_questionnaire(f.form_a2);
 IF NOT EXISTS(SELECT 1 FROM feedback_questionnaires WHERE id=f.form_a2 AND is_default) OR EXISTS(SELECT 1 FROM feedback_questionnaires WHERE id=f.form_a AND is_default) THEN RAISE EXCEPTION 'Default selection did not switch atomically'; END IF;
 IF (SELECT count(*) FROM feedback_questionnaires WHERE property_id=f.prop_a AND is_default)<>1 THEN RAISE EXCEPTION 'Multiple guest forms selected'; END IF;
 IF NOT EXISTS(SELECT 1 FROM feedback_questions WHERE id=f.question_a AND questionnaire_id=f.form_a) THEN RAISE EXCEPTION 'Switching forms removed old questions'; END IF;
 UPDATE feedback_questions SET question_text='Edited question',options='["Good","Poor"]',is_required=false,translations='{"th":{"questionText":"Translated"}}' WHERE id=f.question_a;
 IF NOT EXISTS(SELECT 1 FROM feedback_questions WHERE id=f.question_a AND question_text='Edited question' AND options->>0='Good' AND translations->'th'->>'questionText'='Translated' AND NOT is_required) THEN RAISE EXCEPTION 'Question editing failed'; END IF;
 INSERT INTO feedback_questionnaires(organization_id,property_id,name) VALUES(f.org_a,f.prop_a,'Third questionnaire');
 BEGIN PERFORM select_guest_questionnaire(f.form_b);RAISE EXCEPTION 'Other tenant form selected';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN UPDATE feedback_questionnaires SET property_id=f.prop_a2 WHERE id=f.form_a;RAISE EXCEPTION 'Questionnaire moved properties';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO feedback_questions(organization_id,property_id,questionnaire_id,question_text,question_type) VALUES(f.org_a,f.prop_a,f.form_b,'Invalid','text');RAISE EXCEPTION 'Question linked across properties';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM * FROM guest_feedback_links;RAISE EXCEPTION 'Authenticated client read public link secrets';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
DO $$ DECLARE f form_fixture; BEGIN
 SELECT * INTO f FROM form_fixture;
 BEGIN UPDATE guest_feedback_links SET property_id=f.prop_a2 WHERE property_id=f.prop_a;RAISE EXCEPTION 'Shared link moved properties';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM * FROM feedback_questionnaires;RAISE EXCEPTION 'Anonymous questionnaire directory exposed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM * FROM guest_feedback_links;RAISE EXCEPTION 'Anonymous links exposed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
ROLLBACK;
`});
console.log('Questionnaire and short-link database checks passed (fixtures rolled back).');
