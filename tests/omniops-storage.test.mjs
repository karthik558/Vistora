import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
// The application test database has no Supabase Storage service. Exercise the exact
// migration policies against compatible metadata tables, all inside a rollback.
const migration = readFileSync(
  new URL("../supabase/migrations/20261029_omniops.sql", import.meta.url),
  "utf8",
)
  .replace(/^BEGIN;\s*$/m, "")
  .replace(/^COMMIT;\s*$/m, "");
run(`BEGIN;
SET LOCAL client_min_messages=warning;
CREATE SCHEMA IF NOT EXISTS storage;
DO $$ BEGIN IF to_regclass('storage.objects') IS NOT NULL THEN RAISE EXCEPTION 'Use the plain disposable test database without existing Storage metadata for this fixture';END IF;END $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
INSERT INTO storage.buckets(id,name,public) VALUES('operations-evidence','operations-evidence',true);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text NOT NULL);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
${migration}
CREATE TEMP TABLE photo_fixture AS SELECT gen_random_uuid() owner_a,gen_random_uuid() owner_b,gen_random_uuid() staff,gen_random_uuid() property_a;
INSERT INTO auth.users(id,email) SELECT owner_a,'photo-a@test.local' FROM photo_fixture UNION ALL SELECT owner_b,'photo-b@test.local' FROM photo_fixture UNION ALL SELECT staff,'photo-staff@test.local' FROM photo_fixture;
SELECT create_company(owner_a,'Photo A','photo-a-'||owner_a) FROM photo_fixture;
SELECT create_company(owner_b,'Photo B','photo-b-'||owner_b) FROM photo_fixture;
ALTER TABLE photo_fixture ADD COLUMN org_a uuid;
UPDATE photo_fixture SET org_a=(SELECT organization_id FROM organization_members WHERE user_id=owner_a);
INSERT INTO properties(id,organization_id,name,slug,code,location,country,timezone) SELECT property_a,org_a,'Photo A','photo-a','PHOTO','City','India','UTC' FROM photo_fixture;
SELECT provision_workspace_user(staff,org_a,'photo-staff@test.local','Staff',false,ARRAY[property_a],ARRAY['module:hospitality','module_access:configured']) FROM photo_fixture;
GRANT SELECT ON photo_fixture TO authenticated;
SELECT set_config('request.jwt.claim.sub',owner_a::text,true) FROM photo_fixture;
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name) SELECT 'operations-evidence',org_a||'/'||property_a||'/'||owner_a||'/proof.jpg' FROM photo_fixture;
SELECT omniops_command('evidence',jsonb_build_object('property_id',property_a,'object_path',org_a||'/'||property_a||'/'||owner_a||'/proof.jpg','check_label','Lighting'),gen_random_uuid()) FROM photo_fixture;
DO $$ DECLARE f photo_fixture;BEGIN SELECT * INTO f FROM photo_fixture;
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('operations-evidence',f.org_a||'/'||f.property_a||'/'||f.staff||'/forged.jpg');RAISE EXCEPTION 'Uploader identity folder was forgeable';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF (SELECT count(*) FROM storage.objects)<>1 THEN RAISE EXCEPTION 'Owner could not read authorized evidence';END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',staff::text,true) FROM photo_fixture;
SET LOCAL ROLE authenticated;
DO $$ DECLARE f photo_fixture;BEGIN SELECT * INTO f FROM photo_fixture;
 IF (SELECT count(*) FROM storage.objects)<>1 THEN RAISE EXCEPTION 'Assigned property staff could not view evidence';END IF;
 BEGIN INSERT INTO storage.objects(bucket_id,name) VALUES('operations-evidence',f.org_a||'/'||f.property_a||'/'||f.staff||'/staff.jpg');RAISE EXCEPTION 'Non-supervisor uploaded inspection evidence';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',owner_b::text,true) FROM photo_fixture;
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.objects) THEN RAISE EXCEPTION 'Another company saw private evidence';END IF;END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT public FROM storage.buckets WHERE id='operations-evidence') THEN RAISE EXCEPTION 'Evidence bucket is public';END IF;END $$;
ROLLBACK;
`);
console.log(
  "Operations Storage policies passed: private bucket, uploader path enforcement, supervisor-only uploads, property-scoped reads and tenant isolation.",
);
