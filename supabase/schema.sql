-- ==============================================================================
-- VISTORA GUEST EXPERIENCE OPERATIONS - COMPREHENSIVE SUPABASE SCHEMA
-- ==============================================================================
-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. ENUM TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE feedback_status AS ENUM ('needs_attention', 'under_review', 'resolved', 'escalated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE feedback_tone AS ENUM ('urgent', 'review', 'positive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE department_type AS ENUM (
        'Housekeeping',
        'Front Desk',
        'Food & Beverage',
        'Concierge',
        'Facilities & Room',
        'Spa & Wellness',
        'Valet & Transfers'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'staff', 'visitor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TABLES
-- ------------------------------------------------------------------------------

-- Properties (Hotels / Resorts)
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL DEFAULT 'Vistora Hotels & Resorts',
    location TEXT NOT NULL,
    country TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    total_rooms INTEGER NOT NULL DEFAULT 280,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profiles (Role-based access control linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Operations User',
    role user_role NOT NULL DEFAULT 'visitor',
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    avatar_url TEXT,
    rights TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure profile and property columns exist even if created earlier
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rights TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS property_ids UUID[] DEFAULT '{}';

-- Automatically synchronize property_ids from property_id if property_ids is empty
UPDATE public.profiles
SET property_ids = ARRAY[property_id]
WHERE property_id IS NOT NULL AND (property_ids IS NULL OR cardinality(property_ids) = 0);


-- Clean up: Drop unnecessary views and legacy tables.
-- All operational user data (role, property_id, rights) is consolidated directly inside public.profiles,
-- and passwords/credentials are handled natively by Supabase Auth (auth.users).
DROP VIEW IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.user_credentials CASCADE;
DROP TABLE IF EXISTS public.user_rights CASCADE;

-- Cleanup: ensure avatar_url contains only legitimate image URLs and never JSON or password hashes
UPDATE public.profiles
SET avatar_url = NULL
WHERE avatar_url LIKE '{"%' OR avatar_url LIKE 'pwd:%';

-- Guests (Guest directory)
CREATE TABLE IF NOT EXISTS public.guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    vip_tier TEXT NOT NULL DEFAULT 'Standard',
    total_stays INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guest Stays (Sessions for feedback tokens)
CREATE TABLE IF NOT EXISTS public.stays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    public_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guest Feedback Submissions
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    stay_id UUID REFERENCES public.stays(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT,
    guest_phone TEXT,
    room_number TEXT NOT NULL,
    department department_type NOT NULL DEFAULT 'Front Desk',
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    wants_contact BOOLEAN NOT NULL DEFAULT FALSE,
    contact_preference TEXT,
    status feedback_status NOT NULL DEFAULT 'under_review',
    tone feedback_tone NOT NULL DEFAULT 'review',
    sla_deadline TIMESTAMPTZ,
    assigned_to TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_feedback_property_id ON public.feedback(property_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stays_public_token ON public.stays(public_token);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Properties Policies
DROP POLICY IF EXISTS "Anyone can view properties" ON public.properties;
CREATE POLICY "Anyone can view properties"
    ON public.properties FOR SELECT
    TO anon, authenticated
    USING (true);

-- Stays Policies: Anonymous public users can read stays via token to submit feedback
DROP POLICY IF EXISTS "Public can view stay by token" ON public.stays;
CREATE POLICY "Public can view stay by token"
    ON public.stays FOR SELECT
    TO anon, authenticated
    USING (true);

-- Feedback Policies: Anyone can submit feedback; authenticated users can read/update
DROP POLICY IF EXISTS "Public can insert guest feedback" ON public.feedback;
CREATE POLICY "Public can insert guest feedback"
    ON public.feedback FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view feedback" ON public.feedback;
CREATE POLICY "Users can view feedback"
    ON public.feedback FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can update feedback" ON public.feedback;
CREATE POLICY "Users can update feedback"
    ON public.feedback FOR UPDATE
    TO anon, authenticated
    USING (true);

-- Guests Policies
DROP POLICY IF EXISTS "Users can view guests" ON public.guests;
CREATE POLICY "Users can view guests"
    ON public.guests FOR SELECT
    TO anon, authenticated
    USING (true);

-- Profiles Policies (RBAC)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role has full access to profiles" ON public.profiles;
CREATE POLICY "Service role has full access to profiles"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role');
-- ------------------------------------------------------------------------------
-- 6. AUTOMATED USER PROFILE SYNCHRONIZATION TRIGGER
-- ------------------------------------------------------------------------------
-- When a user registers or updates in auth.users, automatically maintain their public profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
    assigned_role public.user_role := 'visitor'::public.user_role;
    meta_role text;
BEGIN
    meta_role := NEW.raw_user_meta_data->>'role';
    IF meta_role = 'admin' THEN
        assigned_role := 'admin'::public.user_role;
    ELSIF meta_role = 'staff' THEN
        assigned_role := 'staff'::public.user_role;
    ELSE
        assigned_role := 'visitor'::public.user_role;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, property_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        assigned_role,
        CASE WHEN NEW.raw_user_meta_data->>'property_id' IS NOT NULL AND NEW.raw_user_meta_data->>'property_id' != ''
             THEN (NEW.raw_user_meta_data->>'property_id')::uuid ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        property_id = COALESCE(EXCLUDED.property_id, public.profiles.property_id),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing auth.users into public.profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', SPLIT_PART(email, '@', 1)),
    CASE 
        WHEN raw_user_meta_data->>'role' = 'staff' THEN 'staff'::user_role
        WHEN raw_user_meta_data->>'role' = 'admin' THEN 'admin'::user_role
        ELSE 'visitor'::user_role
    END
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. SEED DATA FOR DEVELOPMENT & INITIAL LOAD
-- ------------------------------------------------------------------------------
INSERT INTO public.properties (id, name, slug, code, brand, location, country, timezone, total_rooms)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Vistora Riverside Bangkok', 'vistora-riverside-bangkok', 'VRB', 'Vistora Hotels & Resorts', 'Bangkok', 'Thailand', 'Asia/Bangkok', 376),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Vistora Siam Bangkok', 'vistora-siam-bangkok', 'VSB', 'Vistora Hotels & Resorts', 'Bangkok', 'Thailand', 'Asia/Bangkok', 354),
    ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Vistora Chiang Mai Resort', 'vistora-chiang-mai', 'VCM', 'Vistora Hotels & Resorts', 'Chiang Mai', 'Thailand', 'Asia/Bangkok', 84)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    code = EXCLUDED.code,
    brand = EXCLUDED.brand,
    location = EXCLUDED.location,
    country = EXCLUDED.country,
    timezone = EXCLUDED.timezone,
    total_rooms = EXCLUDED.total_rooms;

INSERT INTO public.guests (id, full_name, email, phone, vip_tier, total_stays)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Aisha Khan', 'aisha.khan@luxurytravel.com', '+65 9123 4567', 'VIP Gold', 4),
    ('22222222-2222-2222-2222-222222222222', 'James Morrison', 'j.morrison@oxfordcap.co.uk', '+44 7700 900123', 'Standard', 1),
    ('33333333-3333-3333-3333-333333333333', 'Nadia Rahman', 'nadia.rahman@kualalumpur.my', '+60 12 345 6789', 'Ambassador', 7),
    ('44444444-4444-4444-4444-444444444444', 'Daniel Lee', 'daniel.lee@sydneyfin.com.au', '+61 412 345 678', 'VIP Gold', 3),
    ('55555555-5555-5555-5555-555555555555', 'Elena Rostova', 'elena.rostova@geneva-corp.ch', '+41 22 123 4567', 'Standard', 2),
    ('66666666-6666-6666-6666-666666666666', 'Marcus Vance', 'marcus.v@seattleventures.io', '+1 206 555 0199', 'Standard', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.stays (id, property_id, guest_id, room_number, check_in_date, check_out_date, public_token, status)
VALUES
    ('a1111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '11111111-1111-1111-1111-111111111111', '602', '2024-06-14', '2024-06-18', 'demo-stay', 'active'),
    ('a2222222-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '22222222-2222-2222-2222-222222222222', '314', '2024-06-15', '2024-06-19', 'stay-jm-314', 'active'),
    ('a3333333-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '33333333-3333-3333-3333-333333333333', 'Villa 4', '2024-06-12', '2024-06-18', 'stay-nr-v4', 'active'),
    ('a4444444-0000-0000-0000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '44444444-4444-4444-4444-444444444444', '818', '2024-06-16', '2024-06-20', 'stay-dl-818', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.feedback (id, property_id, stay_id, guest_name, guest_email, guest_phone, room_number, department, rating, comment, wants_contact, contact_preference, status, tone, sla_deadline, assigned_to, resolution_notes, resolved_at, created_at)
VALUES
    (
        'f0000001-0000-0000-0000-000000000001',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'a1111111-0000-0000-0000-000000000001',
        'Aisha Khan',
        'aisha.khan@luxurytravel.com',
        '+65 9123 4567',
        '602',
        'Housekeeping',
        5,
        'Evening turndown service was flawless, including the aromatherapy pillow mist. Room 602 has been immaculate throughout my stay.',
        false,
        'email',
        'resolved',
        'positive',
        null,
        'Housekeeping Lead',
        'Commended room attendant Somchai for exceptional detail.',
        NOW() - INTERVAL '45 minutes',
        NOW() - INTERVAL '1 hour'
    ),
    (
        'f0000002-0000-0000-0000-000000000002',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'a2222222-0000-0000-0000-000000000002',
        'James Morrison',
        'j.morrison@oxfordcap.co.uk',
        '+44 7700 900123',
        '314',
        'Front Desk',
        2,
        'Check-in took over 25 minutes after a 14-hour flight. Key cards failed upon reaching the 3rd floor, requiring a walk back down to the lobby.',
        true,
        'phone',
        'needs_attention',
        'urgent',
        NOW() + INTERVAL '12 minutes',
        'Front Office Manager',
        null,
        null,
        NOW() - INTERVAL '1 hour 15 minutes'
    ),
    (
        'f0000003-0000-0000-0000-000000000003',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'a3333333-0000-0000-0000-000000000003',
        'Nadia Rahman',
        'nadia.rahman@kualalumpur.my',
        '+60 12 345 6789',
        'Restaurant · Dining',
        'Food & Beverage',
        4,
        'The river terrace dinner was sublime. Breakfast buffet was slightly crowded at 9 AM, but the barista made a wonderful flat white.',
        false,
        null,
        'under_review',
        'review',
        NOW() + INTERVAL '2 hours',
        'F&B Operations',
        null,
        null,
        NOW() - INTERVAL '1 hour 45 minutes'
    ),
    (
        'f0000004-0000-0000-0000-000000000004',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'a4444444-0000-0000-0000-000000000004',
        'Daniel Lee',
        'daniel.lee@sydneyfin.com.au',
        '+61 412 345 678',
        '818',
        'Concierge',
        5,
        'The concierge team arranged a private longtail boat charter on 2 hours notice. Impeccable recommendation for riverside temples.',
        false,
        null,
        'resolved',
        'positive',
        null,
        'Head Concierge',
        'Passed compliments directly to Khun Chai.',
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '2 hours'
    ),
    (
        'f0000005-0000-0000-0000-000000000005',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        null,
        'Elena Rostova',
        'elena.rostova@geneva-corp.ch',
        '+41 22 123 4567',
        '507',
        'Housekeeping',
        3,
        'Extra feather pillows requested at 7 PM were not delivered until after 10 PM. Otherwise the room was quiet and pleasant.',
        true,
        'email',
        'under_review',
        'review',
        NOW() + INTERVAL '1 hour 45 minutes',
        'Guest Relations Lead',
        null,
        null,
        NOW() - INTERVAL '3 hours'
    ),
    (
        'f0000006-0000-0000-0000-000000000006',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        null,
        'Marcus Vance',
        'marcus.v@seattleventures.io',
        '+1 206 555 0199',
        'Transfer Service',
        'Valet & Transfers',
        2,
        'Airport transfer Mercedes chauffeur arrived 20 minutes late at Suvarnabhumi Airport. No greeting sign visible at Door 5.',
        true,
        'phone',
        'needs_attention',
        'urgent',
        NOW() + INTERVAL '45 minutes',
        'Transport Manager',
        null,
        null,
        NOW() - INTERVAL '4 hours'
    ),
    (
        'f0000007-0000-0000-0000-000000000007',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        null,
        'Sophie Dubois',
        'sophie.dubois@paris-design.fr',
        '+33 6 12 34 56 78',
        'Suite 902',
        'Spa & Wellness',
        5,
        'The 90-minute traditional Thai massage was world-class. Peaceful garden surroundings and skilled therapists.',
        false,
        null,
        'resolved',
        'positive',
        null,
        'Spa Director',
        'Acknowledged therapist Mayuree.',
        NOW() - INTERVAL '4 hours',
        NOW() - INTERVAL '5 hours'
    ),
    (
        'f0000008-0000-0000-0000-000000000008',
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        null,
        'David Chen',
        'd.chen@hktech.hk',
        '+852 9876 5432',
        '412',
        'Facilities & Room',
        4,
        'Air conditioning cooling was quick and quiet. Would appreciate a USB-C outlet next to the left nightstand.',
        false,
        null,
        'resolved',
        'positive',
        null,
        'Engineering',
        'Logged adapter request with housekeeping.',
        NOW() - INTERVAL '5 hours',
        NOW() - INTERVAL '6 hours'
    )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. QUESTIONNAIRE QUESTIONS & RESPONSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'choice', -- 'choice', 'rating', 'yes_no', 'text'
    options JSONB DEFAULT '[]'::jsonb,
    translations JSONB DEFAULT '{}'::jsonb,
    department department_type,
    is_required BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback_questions ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.feedback_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.feedback_questions(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    answer_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_property_id ON public.feedback_questions(property_id);
CREATE INDEX IF NOT EXISTS idx_questions_active ON public.feedback_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_answers_feedback_id ON public.feedback_answers(feedback_id);

ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public questions are viewable by everyone" ON public.feedback_questions;
CREATE POLICY "Public questions are viewable by everyone"
    ON public.feedback_questions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role full access to questions" ON public.feedback_questions;
CREATE POLICY "Service role full access to questions"
    ON public.feedback_questions FOR ALL
    USING (true);

DROP POLICY IF EXISTS "Public can submit feedback answers" ON public.feedback_answers;
CREATE POLICY "Public can submit feedback answers"
    ON public.feedback_answers FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to answers" ON public.feedback_answers;
CREATE POLICY "Service role full access to answers"
    ON public.feedback_answers FOR ALL
    USING (true);

-- Seed default questionnaire questions
INSERT INTO public.feedback_questions (id, property_id, question_text, question_type, options, is_required, display_order, is_active)
VALUES
    (
        'b0000001-0000-0000-0000-000000000001',
        null,
        'How smooth was your check-in and arrival experience?',
        'choice',
        '["Seamless & prompt", "Standard / acceptable", "Delayed or congested"]'::jsonb,
        true,
        1,
        true
    ),
    (
        'b0000002-0000-0000-0000-000000000002',
        null,
        'How satisfied were you with room cleanliness and ambiance?',
        'rating',
        '[]'::jsonb,
        true,
        2,
        true
    ),
    (
        'b0000003-0000-0000-0000-000000000003',
        null,
        'Would you recommend Vistora to friends or colleagues?',
        'choice',
        '["Definitely", "Likely", "Unlikely"]'::jsonb,
        false,
        3,
        true
    ),
    (
        'b0000004-0000-0000-0000-000000000004',
        null,
        'Did our team promptly assist you with all requests?',
        'yes_no',
        '["Yes, absolutely", "Could be faster", "No, unattended"]'::jsonb,
        false,
        4,
        true
    )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 10. ENTERPRISE AUDIT LOGS (IMMUTABLE AUDIT TRAIL & GDPR COMPLIANCE)
-- Optional table for persistent multi-year compliance storage in Supabase.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    actor_name TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL DEFAULT 'staff',
    action TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('pii_access', 'export', 'sla_status', 'permission', 'security', 'system')),
    resource TEXT NOT NULL,
    details TEXT,
    ip TEXT DEFAULT '127.0.0.1',
    hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'warning', 'alert')),
    compliance_tag TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to audit logs" ON public.audit_logs;
CREATE POLICY "Service role full access to audit logs"
    ON public.audit_logs FOR ALL
    USING (true);

-- ------------------------------------------------------------------------------
-- 11. PROPERTY ACCESS (EXPLICIT USER-PROPERTY MAPPING TABLE)
-- Dedicated relational junction table mapping hotel staff & admins to properties.
-- Shows up directly in Supabase Studio Table Editor as "property_access".
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.property_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_access_user ON public.property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_property ON public.property_access(property_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.property_access ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view their own property assignments
DROP POLICY IF EXISTS "Users can view their own property access" ON public.property_access;
CREATE POLICY "Users can view their own property access"
    ON public.property_access FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Administrators have full management over property assignments
DROP POLICY IF EXISTS "Admins full access to property access" ON public.property_access;
CREATE POLICY "Admins full access to property access"
    ON public.property_access FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR 'org_role:super_admin' = ANY(profiles.rights))
        )
    );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to property access" ON public.property_access;
CREATE POLICY "Service role full access to property access"
    ON public.property_access FOR ALL
    USING (true);

-- Synchronize existing property assignments from profiles table
INSERT INTO public.property_access (user_id, property_id, role)
SELECT 
    p.id as user_id, 
    unnest(p.property_ids) as property_id,
    p.role
FROM public.profiles p
WHERE p.property_ids IS NOT NULL AND cardinality(p.property_ids) > 0
ON CONFLICT (user_id, property_id) DO NOTHING;

INSERT INTO public.property_access (user_id, property_id, role)
SELECT 
    p.id as user_id, 
    p.property_id,
    p.role
FROM public.profiles p
WHERE p.property_id IS NOT NULL
ON CONFLICT (user_id, property_id) DO NOTHING;

-- ==============================================================================
-- 12. COMPANY WORKSPACES AND PERSISTENT OPERATIONS (append-only upgrade, 2026-10-26)
-- Run this section onward for an existing installation. Existing records are kept.
-- All existing unassigned records belong to the legacy workspace, never a new customer.
-- ==============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  slug text NOT NULL UNIQUE, logo_url text, brand_color text NOT NULL DEFAULT '#3e5a4b',
  welcome_message text NOT NULL DEFAULT 'Tell us about your stay.',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata', is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.organizations(id,name,slug) VALUES
 ('00000000-0000-4000-8000-000000000001','Existing Vistora workspace','vistora-legacy') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','member')),
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,user_id)
);
DO $$ DECLARE t text; fresh boolean; BEGIN
  FOREACH t IN ARRAY ARRAY['properties','profiles','guests','stays','feedback','feedback_questions','feedback_answers','audit_logs','property_access'] LOOP
    SELECT NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='organization_id') INTO fresh;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id)',t);
    IF fresh THEN EXECUTE format('UPDATE public.%I SET organization_id = %L WHERE organization_id IS NULL',t,'00000000-0000-4000-8000-000000000001'); END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(organization_id)',t||'_organization_idx',t);
  END LOOP;
END $$;
-- Backfill memberships once; rerunning never changes roles or reactivates members.
INSERT INTO public.organization_members(organization_id,user_id,role)
SELECT organization_id,id,CASE WHEN role::text='admin' THEN 'admin' ELSE 'member' END
FROM public.profiles WHERE organization_id IS NOT NULL ON CONFLICT(user_id) DO NOTHING;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS recommendation_score smallint CHECK(recommendation_score BETWEEN 0 AND 10);
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical'));
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS first_response_at timestamptz;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

CREATE OR REPLACE FUNCTION public.workspace_org() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT organization_id FROM public.organization_members WHERE user_id=auth.uid() AND is_active LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.workspace_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=auth.uid() AND is_active AND role IN ('owner','admin'))
$$;
CREATE OR REPLACE FUNCTION public.workspace_right(r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.workspace_admin() OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.organization_id=public.workspace_org() AND r=ANY(p.rights))
$$;
CREATE OR REPLACE FUNCTION public.workspace_property(pid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.properties h WHERE h.id=pid AND h.organization_id=public.workspace_org() AND
 (public.workspace_admin() OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND
 (p.property_id=pid OR pid=ANY(p.property_ids))) OR EXISTS(SELECT 1 FROM public.property_access a WHERE a.user_id=auth.uid() AND a.property_id=pid AND a.organization_id=public.workspace_org())))
$$;
CREATE OR REPLACE FUNCTION public.workspace_department(dept text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.workspace_admin()
 OR NOT EXISTS(SELECT 1 FROM public.profiles p,unnest(p.rights) r WHERE p.id=auth.uid() AND r LIKE 'dept_scope:%')
 OR EXISTS(SELECT 1 FROM public.profiles p,unnest(p.rights) r WHERE p.id=auth.uid() AND r IN ('dept_scope:*','dept_scope:All Departments','dept_scope:'||dept))
$$;
CREATE OR REPLACE FUNCTION public.stamp_workspace() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.organization_id IS NULL THEN NEW.organization_id:=public.workspace_org(); END IF;
 IF TG_TABLE_NAME='profiles' AND NEW.organization_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.organization_id IS NULL THEN RAISE EXCEPTION 'Workspace is required'; END IF;
 IF TG_OP='UPDATE' AND OLD.organization_id IS NOT NULL AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN RAISE EXCEPTION 'Moving records between companies is prohibited'; END IF;
 RETURN NEW;
END $$;
CREATE TABLE IF NOT EXISTS public.organization_settings (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id), settings jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.property_settings (
 property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES public.organizations(id), settings jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.guest_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id), token_hash text NOT NULL UNIQUE,
 guest_name text NOT NULL, guest_email text, guest_phone text, room_number text NOT NULL,
 channel text NOT NULL DEFAULT 'direct_link' CHECK(channel IN ('direct_link','email','sms','whatsapp')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','expired')),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days', completed_at timestamptz,
 feedback_id uuid REFERENCES public.feedback(id), feedback_rating smallint CHECK(feedback_rating BETWEEN 1 AND 5),
 notes text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guest_invitations ADD COLUMN IF NOT EXISTS token_encrypted text;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS invitation_id uuid UNIQUE REFERENCES public.guest_invitations(id);
CREATE TABLE IF NOT EXISTS public.feedback_comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES public.profiles(id), body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.feedback_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, action text NOT NULL, changes jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.feedback_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
 uploaded_by uuid NOT NULL REFERENCES public.profiles(id), object_path text NOT NULL UNIQUE,
 filename text NOT NULL, content_type text NOT NULL, size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sla_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id), department text NOT NULL,
 response_minutes integer NOT NULL CHECK(response_minutes BETWEEN 1 AND 10080),
 escalation_email text NOT NULL, UNIQUE(property_id,department), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.recovery_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 feedback_id uuid NOT NULL REFERENCES public.feedback(id), token_hash text NOT NULL UNIQUE,
 resolution_cycle timestamptz NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 responded_at timestamptz, rating smallint CHECK(rating BETWEEN 1 AND 5), recommendation_score smallint CHECK(recommendation_score BETWEEN 0 AND 10), comment text,
 UNIQUE(feedback_id,resolution_cycle), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.saved_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 user_id uuid NOT NULL REFERENCES public.profiles(id), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 filters jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.report_schedules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid REFERENCES public.properties(id), created_by uuid NOT NULL REFERENCES public.profiles(id),
 name text NOT NULL, recipient_email text NOT NULL, frequency text NOT NULL CHECK(frequency IN ('daily','weekly','monthly')),
 period_days integer NOT NULL CHECK(period_days BETWEEN 1 AND 366), next_run_at timestamptz NOT NULL DEFAULT now(),
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.report_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 schedule_id uuid REFERENCES public.report_schedules(id) ON DELETE SET NULL, scheduled_for timestamptz NOT NULL,
 summary jsonb, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','generated','delivered','failed','blocked')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(schedule_id,scheduled_for)
);
CREATE TABLE IF NOT EXISTS public.team_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 email text NOT NULL, token_hash text NOT NULL UNIQUE, invited_by uuid NOT NULL REFERENCES public.profiles(id),
 property_ids uuid[] NOT NULL DEFAULT '{}', rights text[] NOT NULL DEFAULT '{view_feedback}',
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days', accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.api_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 name text NOT NULL, key_hash text NOT NULL UNIQUE, prefix text NOT NULL, scopes text[] NOT NULL DEFAULT '{feedback:read}',
 created_by uuid NOT NULL REFERENCES public.profiles(id), expires_at timestamptz NOT NULL, revoked_at timestamptz, last_used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 url text NOT NULL CHECK(url LIKE 'https://%'), secret_encrypted text NOT NULL,
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.notification_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 kind text NOT NULL CHECK(kind IN ('sla','followup','invitation','team_invitation','report','webhook')),
 dedup_key text NOT NULL UNIQUE, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','delivered','failed','blocked')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 locked_until timestamptz, lease_token uuid, last_error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 outbox_id uuid NOT NULL REFERENCES public.notification_outbox(id), attempt integer NOT NULL,
 status text NOT NULL CHECK(status IN ('delivered','retry','failed','blocked')), detail text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(outbox_id,attempt)
);
ALTER TABLE public.notification_outbox ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;
CREATE INDEX IF NOT EXISTS outbox_due_idx ON public.notification_outbox(status,available_at);
CREATE INDEX IF NOT EXISTS feedback_due_idx ON public.feedback(organization_id,sla_deadline) WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS comments_feedback_idx ON public.feedback_comments(feedback_id,created_at);
CREATE INDEX IF NOT EXISTS activity_feedback_idx ON public.feedback_activity(feedback_id,created_at);

-- Enforce matching organizations even when a privileged worker writes child records.
CREATE OR REPLACE FUNCTION public.check_workspace_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE parent_org uuid; parent_id uuid; field text;
BEGIN
 IF to_jsonb(NEW)?'property_id' AND to_jsonb(NEW)->>'property_id' IS NOT NULL THEN
  parent_id:=(to_jsonb(NEW)->>'property_id')::uuid;
  SELECT organization_id INTO parent_org FROM public.properties WHERE id=parent_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN RAISE EXCEPTION 'Property belongs to another company'; END IF;
 END IF;
 IF to_jsonb(NEW)?'feedback_id' AND to_jsonb(NEW)->>'feedback_id' IS NOT NULL THEN
  SELECT organization_id INTO parent_org FROM public.feedback WHERE id=(to_jsonb(NEW)->>'feedback_id')::uuid;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN RAISE EXCEPTION 'Feedback belongs to another company'; END IF;
 END IF;
 IF to_jsonb(NEW)?'user_id' AND to_jsonb(NEW)->>'user_id' IS NOT NULL THEN
  SELECT organization_id INTO parent_org FROM public.profiles WHERE id=(to_jsonb(NEW)->>'user_id')::uuid;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN RAISE EXCEPTION 'User belongs to another company'; END IF;
 END IF;
 FOREACH field IN ARRAY ARRAY['guest_id','stay_id','question_id'] LOOP
  parent_id:=(to_jsonb(NEW)->>field)::uuid;
  IF parent_id IS NOT NULL THEN
   IF field='guest_id' THEN SELECT organization_id INTO parent_org FROM public.guests WHERE id=parent_id;
   ELSIF field='stay_id' THEN SELECT organization_id INTO parent_org FROM public.stays WHERE id=parent_id;
   ELSE SELECT organization_id INTO parent_org FROM public.feedback_questions WHERE id=parent_id; END IF;
   IF parent_org IS DISTINCT FROM NEW.organization_id THEN RAISE EXCEPTION 'Linked record belongs to another company'; END IF;
  END IF;
 END LOOP;
 IF to_jsonb(NEW)?'property_ids' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(to_jsonb(NEW)->'property_ids') v WHERE NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=v::uuid AND p.organization_id=NEW.organization_id)) THEN RAISE EXCEPTION 'Property assignment belongs to another company'; END IF;
 RETURN NEW;
END $$;

-- Remove permissive legacy policies, including policies without a TO clause.
DO $$ DECLARE t text; pol record; BEGIN
 FOREACH t IN ARRAY ARRAY['organizations','organization_members','properties','profiles','guests','stays','feedback','feedback_questions','feedback_answers','audit_logs','property_access','organization_settings','property_settings','guest_invitations','feedback_comments','feedback_activity','feedback_attachments','sla_policies','recovery_followups','saved_views','report_schedules','report_runs','team_invitations','api_keys','webhook_endpoints','notification_outbox','notification_deliveries'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',pol.policyname,t);
  END LOOP;
  EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
  IF t NOT IN ('organizations','organization_members') THEN
   EXECUTE format('DROP TRIGGER IF EXISTS stamp_workspace_trigger ON public.%I',t);
   EXECUTE format('CREATE TRIGGER stamp_workspace_trigger BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace()',t);
   EXECUTE format('DROP TRIGGER IF EXISTS workspace_links_trigger ON public.%I',t);
   EXECUTE format('CREATE TRIGGER workspace_links_trigger BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.check_workspace_links()',t);
  END IF;
 END LOOP;
END $$;
CREATE POLICY org_read ON public.organizations FOR SELECT TO authenticated USING(id=public.workspace_org());
CREATE POLICY org_update ON public.organizations FOR UPDATE TO authenticated USING(id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(id=public.workspace_org());
CREATE POLICY members_read ON public.organization_members FOR SELECT TO authenticated USING(organization_id=public.workspace_org());
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(organization_id=public.workspace_org());
CREATE POLICY profiles_manage ON public.profiles FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
CREATE POLICY properties_read ON public.properties FOR SELECT TO authenticated USING(public.workspace_property(id));
CREATE POLICY properties_manage ON public.properties FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_right('manage_properties')) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_right('manage_properties'));
CREATE POLICY feedback_read ON public.feedback FOR SELECT TO authenticated USING(public.workspace_property(property_id) AND public.workspace_department(department::text) AND (public.workspace_right('view_feedback') OR public.workspace_right('manage_complaints') OR public.workspace_right('export_reports')));
CREATE POLICY feedback_update ON public.feedback FOR UPDATE TO authenticated USING(public.workspace_property(property_id) AND public.workspace_department(department::text) AND public.workspace_right('manage_complaints')) WITH CHECK(public.workspace_property(property_id) AND organization_id=public.workspace_org() AND public.workspace_department(department::text));
CREATE POLICY feedback_delete ON public.feedback FOR DELETE TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin());
CREATE POLICY questions_read ON public.feedback_questions FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND (property_id IS NULL OR public.workspace_property(property_id)));
CREATE POLICY questions_manage ON public.feedback_questions FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_right('manage_questionnaire')) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_right('manage_questionnaire') AND (property_id IS NULL OR public.workspace_property(property_id)));
CREATE POLICY answers_read ON public.feedback_answers FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.feedback f WHERE f.id=feedback_id));
CREATE POLICY property_access_read ON public.property_access FOR SELECT TO authenticated USING(organization_id=public.workspace_org());
CREATE POLICY property_access_manage ON public.property_access FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_right('view_audit_log'));
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK(organization_id=public.workspace_org() AND actor_email=(SELECT email FROM public.profiles WHERE id=auth.uid()));
CREATE POLICY guest_read ON public.guests FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_right('view_guest_pii'));
CREATE POLICY stays_read ON public.stays FOR SELECT TO authenticated USING(public.workspace_property(property_id));
CREATE POLICY comments_read ON public.feedback_comments FOR SELECT TO authenticated USING(public.workspace_right('manage_complaints') AND EXISTS(SELECT 1 FROM public.feedback f WHERE f.id=feedback_id));
CREATE POLICY comments_insert ON public.feedback_comments FOR INSERT TO authenticated WITH CHECK(organization_id=public.workspace_org() AND author_id=auth.uid() AND public.workspace_right('manage_complaints') AND EXISTS(SELECT 1 FROM public.feedback f WHERE f.id=feedback_id));
CREATE POLICY activity_read ON public.feedback_activity FOR SELECT TO authenticated USING(public.workspace_right('manage_complaints') AND EXISTS(SELECT 1 FROM public.feedback f WHERE f.id=feedback_id));
CREATE POLICY attachments_read ON public.feedback_attachments FOR SELECT TO authenticated USING(public.workspace_right('manage_complaints') AND EXISTS(SELECT 1 FROM public.feedback f WHERE f.id=feedback_id));
CREATE POLICY attachments_insert ON public.feedback_attachments FOR INSERT TO authenticated WITH CHECK(uploaded_by=auth.uid() AND organization_id=public.workspace_org() AND public.workspace_right('manage_complaints') AND EXISTS(SELECT 1 FROM public.feedback f WHERE f.id=feedback_id));
CREATE POLICY views_own ON public.saved_views FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND user_id=auth.uid()) WITH CHECK(organization_id=public.workspace_org() AND user_id=auth.uid());
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['organization_settings','property_settings','sla_policies','report_schedules','team_invitations','api_keys','webhook_endpoints'] LOOP
  EXECUTE format('CREATE POLICY company_admin ON public.%I FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin())',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['organization_settings','property_settings','guest_invitations','sla_policies','recovery_followups','report_runs','notification_outbox','notification_deliveries'] LOOP
  EXECUTE format('CREATE POLICY company_read ON public.%I FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin())',t);
 END LOOP;
END $$;
CREATE POLICY invitation_manage ON public.guest_invitations FOR ALL TO authenticated USING(public.workspace_property(property_id) AND public.workspace_right('manage_questionnaire')) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_property(property_id) AND public.workspace_right('manage_questionnaire'));

-- Safe Auth trigger: user-controlled metadata never grants workspace membership or privileges.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.profiles(id,email,full_name,role,rights)
 VALUES(NEW.id,NEW.email,COALESCE(NEW.raw_user_meta_data->>'full_name','Team member'),'visitor','{}') ON CONFLICT(id) DO NOTHING;
 RETURN NEW;
END $$;
-- Existing schemas may use a differently named auth sync trigger: replace all profile sync triggers explicitly.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.provision_workspace_user(p_user uuid,p_org uuid,p_email text,p_name text,p_admin boolean,p_properties uuid[],p_rights text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=p_user AND organization_id<>p_org) THEN RAISE EXCEPTION 'Account already belongs to another company'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_properties) x LEFT JOIN public.properties h ON h.id=x WHERE h.organization_id IS DISTINCT FROM p_org) THEN RAISE EXCEPTION 'Invalid property assignment'; END IF;
 -- New Auth profiles have no organization. They are assigned only through this service-only function.
 UPDATE public.profiles SET organization_id=p_org,email=p_email,full_name=p_name,role=CASE WHEN p_admin THEN 'admin'::user_role ELSE 'staff'::user_role END,
 property_ids=p_properties,property_id=p_properties[1],rights=p_rights WHERE id=p_user AND (organization_id IS NULL OR organization_id=p_org);
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(p_org,p_user,CASE WHEN p_admin THEN 'admin' ELSE 'member' END)
 ON CONFLICT(user_id) DO UPDATE SET role=CASE WHEN organization_members.role='owner' THEN 'owner' ELSE excluded.role END,is_active=true;
END $$;
REVOKE ALL ON FUNCTION public.provision_workspace_user(uuid,uuid,text,text,boolean,uuid[],text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.provision_workspace_user(uuid,uuid,text,text,boolean,uuid[],text[]) TO service_role;

-- Private attachment storage, when installed in Supabase. Access is mediated by verified API routes.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  VALUES('case-attachments','case-attachments',false,5242880,ARRAY['image/jpeg','image/png','application/pdf','text/plain']) ON CONFLICT(id) DO NOTHING;
 END IF;
END $$;
COMMIT;

-- 13. TRANSACTIONAL CASE HISTORY, FOLLOW-UPS, AND RELIABLE BACKGROUND WORK
BEGIN;
CREATE OR REPLACE FUNCTION public.case_workflow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE minutes integer; invitation public.guest_invitations; changes jsonb := '{}'; raw_token text; follow_id uuid; endpoint record; auto_follow boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.invitation_id IS NOT NULL THEN
   SELECT * INTO invitation FROM public.guest_invitations WHERE id=NEW.invitation_id FOR UPDATE;
   IF NOT FOUND OR invitation.property_id<>NEW.property_id OR invitation.organization_id<>NEW.organization_id OR invitation.status<>'pending' OR invitation.expires_at<=now() THEN RAISE EXCEPTION 'Invitation is invalid, expired, or already used'; END IF;
   UPDATE public.guest_invitations SET status='completed',completed_at=now(),feedback_rating=NEW.rating WHERE id=invitation.id;
  END IF;
  IF NEW.status<>'resolved' AND NEW.sla_deadline IS NULL THEN
   SELECT response_minutes INTO minutes FROM public.sla_policies WHERE property_id=NEW.property_id AND department=NEW.department::text;
   IF minutes IS NULL THEN SELECT (settings->>CASE WHEN NEW.rating<=2 THEN 'slaCriticalMinutes' ELSE 'slaStandardMinutes' END)::integer INTO minutes FROM public.organization_settings WHERE organization_id=NEW.organization_id; END IF;
   NEW.sla_deadline:=now()+make_interval(mins=>COALESCE(minutes,CASE WHEN NEW.rating<=2 THEN 15 ELSE 120 END));
  END IF;
  IF NEW.rating<=2 THEN NEW.priority:='high'; END IF;
 ELSE
  IF OLD.status='resolved' AND NEW.status<>'resolved' THEN
   NEW.resolved_at:=NULL;
   SELECT response_minutes INTO minutes FROM public.sla_policies WHERE property_id=NEW.property_id AND department=NEW.department::text;
   IF minutes IS NULL THEN SELECT (settings->>CASE WHEN NEW.rating<=2 THEN 'slaCriticalMinutes' ELSE 'slaStandardMinutes' END)::integer INTO minutes FROM public.organization_settings WHERE organization_id=NEW.organization_id; END IF;
   NEW.sla_deadline:=now()+make_interval(mins=>COALESCE(minutes,CASE WHEN NEW.rating<=2 THEN 15 ELSE 120 END));
  END IF;
  IF auth.uid() IS NOT NULL AND NEW.first_response_at IS NULL AND (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.status IS DISTINCT FROM OLD.status OR NEW.resolution_notes IS DISTINCT FROM OLD.resolution_notes) THEN NEW.first_response_at:=now(); END IF;
  IF NEW.status='resolved' AND OLD.status<>'resolved' THEN NEW.resolved_at:=now(); END IF;
 END IF;
 NEW.updated_at:=now();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS case_workflow_before ON public.feedback;
CREATE TRIGGER case_workflow_before BEFORE INSERT OR UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.case_workflow();

CREATE OR REPLACE FUNCTION public.case_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changes jsonb; raw_token text; follow_id uuid; endpoint record; auto_follow boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  changes:=jsonb_build_object('status',NEW.status,'priority',NEW.priority);
  IF NEW.invitation_id IS NOT NULL THEN UPDATE public.guest_invitations SET feedback_id=NEW.id WHERE id=NEW.invitation_id; END IF;
 ELSE
  changes:=(SELECT COALESCE(jsonb_object_agg(n.key,jsonb_build_object('from',o.value,'to',n.value)),'{}')
   FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o ON o.key=n.key
   WHERE n.value IS DISTINCT FROM o.value AND n.key IN ('status','assigned_to','priority','sla_deadline','resolution_notes','category'));
 END IF;
 IF changes<>'{}' THEN
  INSERT INTO public.feedback_activity(organization_id,feedback_id,actor_id,action,changes)
   VALUES(NEW.organization_id,NEW.id,auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,changes);
  FOR endpoint IN SELECT * FROM public.webhook_endpoints WHERE organization_id=NEW.organization_id AND is_active LOOP
   INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(NEW.organization_id,'webhook',
    'webhook:'||endpoint.id||':'||NEW.id||':'||NEW.updated_at,
    jsonb_build_object('endpointId',endpoint.id,'event','feedback.'||CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,'feedbackId',NEW.id,'changes',changes)) ON CONFLICT(dedup_key) DO NOTHING;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS case_history_after ON public.feedback;
CREATE TRIGGER case_history_after AFTER INSERT OR UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.case_history();

CREATE OR REPLACE FUNCTION public.schedule_workspace_work(p_org uuid DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item record; recipient text; count_jobs integer:=0; schedule record; run_id uuid;
BEGIN
 FOR item IN SELECT * FROM public.feedback WHERE status<>'resolved' AND sla_deadline<now() AND (p_org IS NULL OR organization_id=p_org) FOR UPDATE SKIP LOCKED LOOP
  SELECT escalation_email INTO recipient FROM public.sla_policies WHERE property_id=item.property_id AND department=item.department::text;
  IF recipient IS NULL THEN SELECT settings->>'alertEmail' INTO recipient FROM public.organization_settings WHERE organization_id=item.organization_id; END IF;
  INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(item.organization_id,'sla','sla:'||item.id||':'||item.sla_deadline,
   jsonb_build_object('feedbackId',item.id,'recipient',recipient,'department',item.department,'deadline',item.sla_deadline)) ON CONFLICT(dedup_key) DO NOTHING;
  UPDATE public.feedback SET status='escalated' WHERE id=item.id AND status<>'escalated';
  recipient:=NULL; count_jobs:=count_jobs+1;
 END LOOP;
 FOR schedule IN SELECT s.* FROM public.report_schedules s JOIN public.organization_members m ON m.user_id=s.created_by AND m.organization_id=s.organization_id
  WHERE s.is_active AND s.next_run_at<=now() AND m.is_active AND m.role IN ('owner','admin') AND (p_org IS NULL OR s.organization_id=p_org) FOR UPDATE OF s SKIP LOCKED LOOP
  INSERT INTO public.report_runs(organization_id,schedule_id,scheduled_for) VALUES(schedule.organization_id,schedule.id,schedule.next_run_at)
   ON CONFLICT(schedule_id,scheduled_for) DO NOTHING RETURNING id INTO run_id;
  IF run_id IS NOT NULL THEN
   INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(schedule.organization_id,'report','report:'||run_id,
    jsonb_build_object('runId',run_id,'propertyId',schedule.property_id,'periodDays',schedule.period_days,'recipient',schedule.recipient_email,'scheduledFor',schedule.next_run_at));
   count_jobs:=count_jobs+1;
  END IF;
  UPDATE public.report_schedules SET next_run_at=now()+CASE schedule.frequency WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '7 days' ELSE interval '1 month' END WHERE id=schedule.id;
 END LOOP;
 RETURN count_jobs;
END $$;
CREATE OR REPLACE FUNCTION public.claim_workspace_jobs(p_org uuid DEFAULT NULL, p_limit integer DEFAULT 10) RETURNS SETOF public.notification_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.notification_outbox SET status='failed',last_error='Worker lease expired after the final attempt',lease_token=NULL,locked_until=NULL WHERE status='sending' AND locked_until<now() AND attempts>=max_attempts AND (p_org IS NULL OR organization_id=p_org);
 RETURN QUERY UPDATE public.notification_outbox q SET status='sending',attempts=q.attempts+1,locked_until=now()+interval '2 minutes',lease_token=gen_random_uuid()
 WHERE q.id IN (SELECT id FROM public.notification_outbox WHERE ((status='queued' AND available_at<=now()) OR (status='sending' AND locked_until<now()))
 AND attempts<max_attempts AND (p_org IS NULL OR organization_id=p_org) ORDER BY available_at LIMIT LEAST(GREATEST(p_limit,1),25) FOR UPDATE SKIP LOCKED) RETURNING q.*;
END $$;
CREATE OR REPLACE FUNCTION public.finish_workspace_job(p_id uuid,p_lease uuid,p_status text,p_detail text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job public.notification_outbox;
BEGIN
 IF p_status NOT IN ('delivered','retry','failed','blocked') THEN RAISE EXCEPTION 'Invalid delivery state'; END IF;
 SELECT * INTO job FROM public.notification_outbox WHERE id=p_id AND lease_token=p_lease AND status='sending' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.notification_deliveries(organization_id,outbox_id,attempt,status,detail) VALUES(job.organization_id,job.id,job.attempts,p_status,left(p_detail,500)) ON CONFLICT(outbox_id,attempt) DO NOTHING;
 UPDATE public.notification_outbox SET status=CASE WHEN p_status='retry' AND attempts<max_attempts THEN 'queued' WHEN p_status='retry' THEN 'failed' ELSE p_status END,
 available_at=now()+make_interval(secs=>LEAST(3600,30*(2^attempts)::integer)),locked_until=NULL,lease_token=NULL,last_error=left(p_detail,500) WHERE id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.schedule_workspace_work(uuid), public.claim_workspace_jobs(uuid,integer), public.finish_workspace_job(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_workspace_work(uuid), public.claim_workspace_jobs(uuid,integer), public.finish_workspace_job(uuid,uuid,text,text) TO service_role;
COMMIT;

-- 14. ATOMIC ONBOARDING AND SINGLE-USE PUBLIC RECOVERY RESPONSES
BEGIN;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_slug_key;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS properties_company_slug ON public.properties(organization_id,slug);
CREATE UNIQUE INDEX IF NOT EXISTS properties_company_code ON public.properties(organization_id,code);
CREATE OR REPLACE FUNCTION public.create_company(p_user uuid,p_name text,p_slug text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; person record;
BEGIN
 IF EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=p_user) THEN RAISE EXCEPTION 'Account already has a workspace'; END IF;
 SELECT id,email,raw_user_meta_data INTO STRICT person FROM auth.users WHERE id=p_user;
 INSERT INTO public.organizations(name,slug) VALUES(p_name,p_slug) RETURNING id INTO org;
 PERFORM public.provision_workspace_user(p_user,org,person.email,COALESCE(person.raw_user_meta_data->>'full_name','Owner'),true,'{}',ARRAY['view_feedback','manage_complaints','manage_users','manage_properties','manage_questionnaire','manage_settings','export_reports','view_guest_pii','view_audit_log','org_role:super_admin']);
 UPDATE public.organization_members SET role='owner' WHERE user_id=p_user;
 INSERT INTO public.organization_settings(organization_id,settings) VALUES(org,jsonb_build_object('organizationName',p_name,'autoGuestFollowUp',true,'alertEmail',person.email));
 RETURN org;
END $$;
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_user uuid,p_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invitation public.team_invitations; person record;
BEGIN
 SELECT * INTO invitation FROM public.team_invitations WHERE token_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR invitation.accepted_at IS NOT NULL OR invitation.expires_at<=now() THEN RAISE EXCEPTION 'Invitation is expired or already used'; END IF;
 SELECT id,email,raw_user_meta_data INTO STRICT person FROM auth.users WHERE id=p_user;
 IF lower(person.email)<>lower(invitation.email) THEN RAISE EXCEPTION 'Sign in with the invited email address'; END IF;
 PERFORM public.provision_workspace_user(p_user,invitation.organization_id,person.email,COALESCE(person.raw_user_meta_data->>'full_name','Team member'),false,invitation.property_ids,invitation.rights);
 UPDATE public.team_invitations SET accepted_at=now() WHERE id=invitation.id;
 RETURN invitation.organization_id;
END $$;
CREATE OR REPLACE FUNCTION public.respond_recovery(p_hash text,p_rating integer,p_nps integer,p_comment text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_rating NOT BETWEEN 1 AND 5 OR (p_nps IS NOT NULL AND p_nps NOT BETWEEN 0 AND 10) OR length(COALESCE(p_comment,''))>2000 THEN RAISE EXCEPTION 'Invalid response'; END IF;
 UPDATE public.recovery_followups SET rating=p_rating,recommendation_score=p_nps,comment=p_comment,responded_at=now() WHERE token_hash=p_hash AND responded_at IS NULL AND expires_at>now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.create_company(uuid,text,text),public.accept_team_invitation(uuid,text),public.respond_recovery(text,integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_company(uuid,text,text),public.accept_team_invitation(uuid,text),public.respond_recovery(text,integer,integer,text) TO service_role;
-- Boundaries for relationships that do not use a property or feedback foreign key.
CREATE OR REPLACE FUNCTION public.check_workspace_actor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE field text; target uuid;
BEGIN
 FOREACH field IN ARRAY ARRAY['author_id','uploaded_by','created_by','invited_by'] LOOP
  IF to_jsonb(NEW)->>field IS NOT NULL THEN
   target:=(to_jsonb(NEW)->>field)::uuid;
   IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target AND organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Actor belongs to another company'; END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['feedback_comments','feedback_attachments','report_schedules','team_invitations','api_keys'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS workspace_actor_trigger ON public.%I',t);
  EXECUTE format('CREATE TRIGGER workspace_actor_trigger BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.check_workspace_actor()',t);
 END LOOP;
END $$;
COMMIT;


-- 15. ATOMIC GUEST SUBMISSION AND CONTROLLED RETRIES
BEGIN;
CREATE OR REPLACE FUNCTION public.submit_guest_feedback(p_feedback jsonb,p_answers jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.feedback; answer jsonb;
BEGIN
 INSERT INTO public.feedback(organization_id,property_id,invitation_id,recommendation_score,guest_name,guest_email,guest_phone,room_number,department,rating,comment,wants_contact,contact_preference,status,tone,resolved_at,resolution_notes)
 VALUES((p_feedback->>'organization_id')::uuid,(p_feedback->>'property_id')::uuid,(p_feedback->>'invitation_id')::uuid,(p_feedback->>'recommendation_score')::smallint,
 p_feedback->>'guest_name',p_feedback->>'guest_email',p_feedback->>'guest_phone',p_feedback->>'room_number',(p_feedback->>'department')::department_type,(p_feedback->>'rating')::smallint,p_feedback->>'comment',
 COALESCE((p_feedback->>'wants_contact')::boolean,false),p_feedback->>'contact_preference',(p_feedback->>'status')::feedback_status,(p_feedback->>'tone')::feedback_tone,(p_feedback->>'resolved_at')::timestamptz,p_feedback->>'resolution_notes') RETURNING * INTO row;
 FOR answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
  INSERT INTO public.feedback_answers(organization_id,feedback_id,question_id,question_text,answer_value)
  VALUES(row.organization_id,row.id,(answer->>'questionId')::uuid,answer->>'questionText',answer->>'answerValue');
 END LOOP;
 RETURN to_jsonb(row);
END $$;
CREATE OR REPLACE FUNCTION public.retry_workspace_job(p_id uuid,p_org uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.notification_outbox;
BEGIN
 UPDATE public.notification_outbox SET status='queued',max_attempts=attempts+5,last_error=NULL,available_at=now(),locked_until=NULL,lease_token=NULL
 WHERE id=p_id AND organization_id=p_org AND status IN ('failed','blocked') RETURNING * INTO row;
 IF NOT FOUND THEN RAISE EXCEPTION 'Delivery is not eligible for retry'; END IF;
 RETURN jsonb_build_object('id',row.id,'status',row.status);
END $$;
REVOKE ALL ON FUNCTION public.submit_guest_feedback(jsonb,jsonb),public.retry_workspace_job(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guest_feedback(jsonb,jsonb),public.retry_workspace_job(uuid,uuid) TO service_role;
COMMIT;

-- 16. INVITATION OUTBOX TRANSACTION AND PARENT LIFECYCLES
BEGIN;
CREATE OR REPLACE FUNCTION public.create_guest_invitation(p_invitation jsonb,p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.guest_invitations;
BEGIN
 INSERT INTO public.guest_invitations(organization_id,property_id,token_hash,token_encrypted,guest_name,guest_email,guest_phone,room_number,channel,notes)
 VALUES((p_invitation->>'organization_id')::uuid,(p_invitation->>'property_id')::uuid,encode(digest(p_token,'sha256'),'hex'),p_invitation->>'token_encrypted',p_invitation->>'guest_name',p_invitation->>'guest_email',p_invitation->>'guest_phone',p_invitation->>'room_number',p_invitation->>'channel',p_invitation->>'notes') RETURNING * INTO row;
 IF row.channel<>'direct_link' THEN
  INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(row.organization_id,'invitation','invitation:'||row.id,
   jsonb_build_object('recipient',CASE WHEN row.channel='email' THEN row.guest_email ELSE row.guest_phone END,'channel',row.channel,'token',p_token,'propertyId',row.property_id));
 END IF;
 RETURN to_jsonb(row);
END $$;
REVOKE ALL ON FUNCTION public.create_guest_invitation(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_invitation(jsonb,text) TO service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['feedback_comments','feedback_activity','feedback_attachments','recovery_followups'] LOOP
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',t,t||'_feedback_id_fkey');
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(feedback_id) REFERENCES public.feedback(id) ON DELETE CASCADE',t,t||'_feedback_id_fkey');
 END LOOP;
END $$;
ALTER TABLE public.guest_invitations DROP CONSTRAINT IF EXISTS guest_invitations_feedback_id_fkey;
ALTER TABLE public.guest_invitations ADD CONSTRAINT guest_invitations_feedback_id_fkey FOREIGN KEY(feedback_id) REFERENCES public.feedback(id) ON DELETE SET NULL;
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_invitation_id_fkey;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_invitation_id_fkey FOREIGN KEY(invitation_id) REFERENCES public.guest_invitations(id) ON DELETE SET NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='attachment_path_scope' AND conrelid='public.feedback_attachments'::regclass) THEN
  ALTER TABLE public.feedback_attachments ADD CONSTRAINT attachment_path_scope CHECK(object_path LIKE organization_id::text||'/'||feedback_id::text||'/%');
 END IF;
END $$;
COMMIT;

-- 17. PRIVATE ATTACHMENT CLEANUP AFTER CASE DELETION
BEGIN;
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check CHECK(kind IN ('sla','followup','invitation','team_invitation','report','webhook','asset_cleanup'));
CREATE OR REPLACE FUNCTION public.queue_attachment_cleanup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload)
 VALUES(OLD.organization_id,'asset_cleanup','asset:'||OLD.id,jsonb_build_object('objectPath',OLD.object_path)) ON CONFLICT(dedup_key) DO NOTHING;
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS attachment_cleanup ON public.feedback_attachments;
CREATE TRIGGER attachment_cleanup AFTER DELETE ON public.feedback_attachments FOR EACH ROW EXECUTE FUNCTION public.queue_attachment_cleanup();
COMMIT;


-- 18. PRIVATE GUEST CONTACTS AND AUDITED DISCLOSURE
BEGIN;
CREATE TABLE IF NOT EXISTS public.feedback_contacts (
 feedback_id uuid PRIMARY KEY REFERENCES public.feedback(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 organization_id uuid NOT NULL REFERENCES public.organizations(id), email text, phone text
);
ALTER TABLE public.feedback_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_contacts FROM anon,authenticated;
GRANT SELECT ON public.feedback_contacts TO authenticated;
GRANT ALL ON public.feedback_contacts TO service_role;
DROP POLICY IF EXISTS contact_read ON public.feedback_contacts;
CREATE POLICY contact_read ON public.feedback_contacts FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_right('view_guest_pii') AND EXISTS(SELECT 1 FROM public.feedback f WHERE f.id=feedback_id));
INSERT INTO public.feedback_contacts(feedback_id,organization_id,email,phone)
 SELECT id,organization_id,guest_email,guest_phone FROM public.feedback WHERE guest_email IS NOT NULL OR guest_phone IS NOT NULL
 ON CONFLICT(feedback_id) DO UPDATE SET email=COALESCE(excluded.email,feedback_contacts.email),phone=COALESCE(excluded.phone,feedback_contacts.phone);
UPDATE public.feedback SET guest_email=NULL,guest_phone=NULL WHERE guest_email IS NOT NULL OR guest_phone IS NOT NULL;
CREATE OR REPLACE FUNCTION public.capture_private_contacts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.guest_email IS NOT NULL OR NEW.guest_phone IS NOT NULL THEN
  INSERT INTO public.feedback_contacts(feedback_id,organization_id,email,phone) VALUES(NEW.id,NEW.organization_id,NEW.guest_email,NEW.guest_phone)
  ON CONFLICT(feedback_id) DO UPDATE SET email=COALESCE(excluded.email,feedback_contacts.email),phone=COALESCE(excluded.phone,feedback_contacts.phone);
  NEW.guest_email:=NULL;NEW.guest_phone:=NULL;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_capture_private_contacts ON public.feedback;
CREATE TRIGGER zz_capture_private_contacts BEFORE INSERT OR UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.capture_private_contacts();
CREATE OR REPLACE FUNCTION public.queue_private_recovery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE recipient text; enabled boolean; raw_token text; follow_id uuid;
BEGIN
 IF NEW.status='resolved' AND OLD.status<>'resolved' THEN
  SELECT email INTO recipient FROM public.feedback_contacts WHERE feedback_id=NEW.id;
  SELECT COALESCE((settings->>'autoGuestFollowUp')::boolean,true) INTO enabled FROM public.organization_settings WHERE organization_id=NEW.organization_id;
  IF recipient IS NOT NULL AND COALESCE(enabled,true) THEN
   raw_token:=encode(gen_random_bytes(32),'hex');
   INSERT INTO public.recovery_followups(organization_id,feedback_id,token_hash,resolution_cycle)
    VALUES(NEW.organization_id,NEW.id,encode(digest(raw_token,'sha256'),'hex'),NEW.resolved_at) ON CONFLICT(feedback_id,resolution_cycle) DO NOTHING RETURNING id INTO follow_id;
   IF follow_id IS NOT NULL THEN INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload)
    VALUES(NEW.organization_id,'followup','followup:'||follow_id,jsonb_build_object('recipient',recipient,'token',raw_token,'followupId',follow_id)); END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS recovery_after ON public.feedback;
CREATE TRIGGER recovery_after AFTER UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.queue_private_recovery();
COMMIT;

-- 19. PROPERTY DELETION KEEPS ASSIGNMENTS AND CHILD RECORDS CONSISTENT
BEGIN;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sla_policies','guest_invitations','report_schedules'] LOOP
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',t,t||'_property_id_fkey');
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(property_id) REFERENCES public.properties(id) ON DELETE CASCADE',t,t||'_property_id_fkey');
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.cleanup_property_assignments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.profiles SET property_ids=array_remove(property_ids,OLD.id),property_id=CASE WHEN property_id=OLD.id THEN NULL ELSE property_id END
 WHERE organization_id=OLD.organization_id AND (OLD.id=ANY(property_ids) OR property_id=OLD.id);
 UPDATE public.team_invitations SET property_ids=array_remove(property_ids,OLD.id) WHERE organization_id=OLD.organization_id AND OLD.id=ANY(property_ids);
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS cleanup_assignments ON public.properties;
CREATE TRIGGER cleanup_assignments BEFORE DELETE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.cleanup_property_assignments();
COMMIT;

-- 20. HOTEL OPERATIONS: GUEST STAYS, ROOM READINESS, JOBS AND INSPECTIONS
-- Apply section 20 onward to an installation already upgraded through section 19.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS preferences text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS public.hotel_rooms(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 room_number text NOT NULL CHECK(length(room_number) BETWEEN 1 AND 30), floor text NOT NULL DEFAULT '',
 room_type text NOT NULL DEFAULT 'Standard', capacity integer NOT NULL DEFAULT 2 CHECK(capacity BETWEEN 1 AND 20),
 status text NOT NULL DEFAULT 'dirty' CHECK(status IN ('dirty','clean','inspected','out_of_service')),
 notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(property_id,room_number)
);
ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.hotel_rooms(id) ON DELETE RESTRICT;
ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS guest_count integer NOT NULL DEFAULT 1 CHECK(guest_count BETWEEN 1 AND 20);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='hotel_stay_dates' AND conrelid='public.stays'::regclass) THEN
  ALTER TABLE public.stays ADD CONSTRAINT hotel_stay_dates CHECK(room_id IS NULL OR check_out_date>check_in_date);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='hotel_stay_no_overlap' AND conrelid='public.stays'::regclass) THEN
  ALTER TABLE public.stays ADD CONSTRAINT hotel_stay_no_overlap EXCLUDE USING gist
   (room_id WITH =,daterange(check_in_date,check_out_date,'[)') WITH &&)
   WHERE(room_id IS NOT NULL AND status IN ('reserved','active'));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.service_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 room_id uuid REFERENCES public.hotel_rooms(id) ON DELETE SET NULL, feedback_id uuid REFERENCES public.feedback(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK(kind IN ('guest_request','cleaning','maintenance','inspection')),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160), description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','completed','cancelled')),
 priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','critical')),
 assigned_to uuid REFERENCES public.profiles(id), created_by uuid REFERENCES public.profiles(id),
 due_at timestamptz NOT NULL, escalated_at timestamptz, completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.room_inspections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
 room_id uuid NOT NULL REFERENCES public.hotel_rooms(id) ON DELETE CASCADE,
 inspector_id uuid NOT NULL REFERENCES public.profiles(id), answers jsonb NOT NULL, passed boolean NOT NULL DEFAULT false,
 notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.hotel_activity(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 entity_type text NOT NULL, entity_id uuid NOT NULL, actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 action text NOT NULL, changes jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hotel_rooms_property ON public.hotel_rooms(organization_id,property_id,status);
CREATE INDEX IF NOT EXISTS hotel_stays_room ON public.stays(room_id,status,check_in_date);
CREATE INDEX IF NOT EXISTS service_jobs_due ON public.service_jobs(organization_id,status,due_at);
CREATE INDEX IF NOT EXISTS room_inspections_room ON public.room_inspections(room_id,created_at DESC);
CREATE INDEX IF NOT EXISTS hotel_activity_company ON public.hotel_activity(organization_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.hotel_enabled(module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT (settings->'hospitality'->'modules'->>module)::boolean FROM public.organization_settings WHERE organization_id=public.workspace_org()),true)
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['hotel_rooms','service_jobs','room_inspections','hotel_activity'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('DROP POLICY IF EXISTS hotel_read ON public.%I',t);
  EXECUTE format('CREATE POLICY hotel_read ON public.%I FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin())',t);
  IF t<>'hotel_activity' THEN
   EXECUTE format('GRANT INSERT,UPDATE ON public.%I TO authenticated',t);
   EXECUTE format('DROP POLICY IF EXISTS hotel_write ON public.%I',t);
   EXECUTE format('CREATE POLICY hotel_write ON public.%I FOR INSERT TO authenticated WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin())',t);
   IF t<>'room_inspections' THEN
    EXECUTE format('DROP POLICY IF EXISTS hotel_update ON public.%I',t);
    EXECUTE format('CREATE POLICY hotel_update ON public.%I FOR UPDATE TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin())',t);
   END IF;
   EXECUTE format('DROP TRIGGER IF EXISTS stamp_workspace_trigger ON public.%I',t);
   EXECUTE format('CREATE TRIGGER stamp_workspace_trigger BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace()',t);
   EXECUTE format('DROP TRIGGER IF EXISTS workspace_links_trigger ON public.%I',t);
   EXECUTE format('CREATE TRIGGER workspace_links_trigger BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.check_workspace_links()',t);
  END IF;
 END LOOP;
END $$;
DROP POLICY IF EXISTS hotel_guest_insert ON public.guests;
CREATE POLICY hotel_guest_insert ON public.guests FOR INSERT TO authenticated WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin() AND public.hotel_enabled('guests'));
DROP POLICY IF EXISTS hotel_guest_update ON public.guests;
CREATE POLICY hotel_guest_update ON public.guests FOR UPDATE TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin() AND public.hotel_enabled('guests'));
DROP POLICY IF EXISTS hotel_stay_insert ON public.stays;
CREATE POLICY hotel_stay_insert ON public.stays FOR INSERT TO authenticated WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin() AND public.hotel_enabled('guests'));
DROP POLICY IF EXISTS hotel_stay_update ON public.stays;
CREATE POLICY hotel_stay_update ON public.stays FOR UPDATE TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin() AND public.hotel_enabled('guests'));

CREATE OR REPLACE FUNCTION public.hotel_record_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changes jsonb;
BEGIN
 IF TG_OP='INSERT' THEN changes:=jsonb_build_object('event','created');
 ELSE changes:=(SELECT COALESCE(jsonb_object_agg(n.key,jsonb_build_object('from',o.value,'to',n.value)),'{}') FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING(key) WHERE n.value IS DISTINCT FROM o.value AND n.key IN ('status','priority','assigned_to','due_at','passed')); END IF;
 IF changes<>'{}' THEN INSERT INTO public.hotel_activity(organization_id,entity_type,entity_id,actor_id,action,changes) VALUES(NEW.organization_id,TG_TABLE_NAME,NEW.id,auth.uid(),lower(TG_OP),changes); END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['guests','stays','hotel_rooms','service_jobs','room_inspections'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS hotel_history ON public.%I',t);
  EXECUTE format('CREATE TRIGGER hotel_history AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hotel_record_activity()',t);
 END LOOP;
END $$;

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
  IF NEW.inspector_id IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Inspection must be attributed to the signed-in administrator'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=NEW.inspector_id AND organization_id=NEW.organization_id AND is_active AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'Inspector must be an active company administrator'; END IF;
  checklist:=COALESCE(config->'inspectionChecklist','["Room cleaned and linen replaced","Bathroom and amenities checked","Safety equipment checked","Maintenance issues cleared"]'::jsonb);
  IF jsonb_typeof(NEW.answers)<>'array' OR jsonb_array_length(NEW.answers)<>jsonb_array_length(checklist) THEN RAISE EXCEPTION 'Answer every inspection check'; END IF;
  SELECT count(DISTINCT a->>'label'),bool_and((a->>'passed')::boolean) INTO matched,all_passed FROM jsonb_array_elements(NEW.answers) a WHERE checklist @> jsonb_build_array(a->>'label') AND jsonb_typeof(a->'passed')='boolean';
  IF matched<>jsonb_array_length(checklist) THEN RAISE EXCEPTION 'Inspection checklist changed; reload before submitting'; END IF;
  NEW.passed:=COALESCE(all_passed,false); RETURN NEW;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['hotel_rooms','stays','service_jobs','room_inspections'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS zz_hotel_guard ON public.%I',t);
  EXECUTE format('CREATE TRIGGER zz_hotel_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hotel_guard()',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.apply_inspection_result() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.hotel_rooms SET status=CASE WHEN status='out_of_service' THEN status WHEN NEW.passed THEN 'inspected' ELSE 'dirty' END WHERE id=NEW.room_id;
 IF NOT NEW.passed THEN INSERT INTO public.service_jobs(organization_id,property_id,room_id,kind,title,description,priority,created_by,due_at)
 VALUES(NEW.organization_id,NEW.property_id,NEW.room_id,'maintenance','Inspection follow-up','Review failed checks from inspection '||NEW.id,'high',NEW.inspector_id,now()+make_interval(mins=>COALESCE((SELECT (settings->'hospitality'->>'taskResponseMinutes')::integer FROM public.organization_settings WHERE organization_id=NEW.organization_id),120))); END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS inspection_result ON public.room_inspections;
CREATE TRIGGER inspection_result AFTER INSERT ON public.room_inspections FOR EACH ROW EXECUTE FUNCTION public.apply_inspection_result();
COMMIT;

-- 21. COST APPROVALS WITH TRANSACTIONAL HARD BUDGET LIMITS
BEGIN;
CREATE TABLE IF NOT EXISTS public.operating_costs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
 job_id uuid REFERENCES public.service_jobs(id) ON DELETE RESTRICT, description text NOT NULL CHECK(length(description) BETWEEN 1 AND 300),
 category text NOT NULL CHECK(category IN ('supplies','maintenance','guest_recovery','other')),
 amount_minor bigint NOT NULL CHECK(amount_minor>0), currency text NOT NULL, expense_date date NOT NULL DEFAULT CURRENT_DATE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by uuid NOT NULL REFERENCES public.profiles(id), approved_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS operating_costs_month ON public.operating_costs(organization_id,expense_date,currency,status);
ALTER TABLE public.operating_costs ALTER COLUMN expense_date SET DEFAULT (now() AT TIME ZONE 'UTC')::date;
ALTER TABLE public.operating_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operating_costs FROM anon,authenticated;
GRANT ALL ON public.operating_costs TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.operating_costs TO authenticated;
DROP POLICY IF EXISTS costs_admin ON public.operating_costs;
CREATE POLICY costs_admin ON public.operating_costs FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
DROP TRIGGER IF EXISTS stamp_workspace_trigger ON public.operating_costs;
CREATE TRIGGER stamp_workspace_trigger BEFORE INSERT OR UPDATE ON public.operating_costs FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace();
DROP TRIGGER IF EXISTS workspace_links_trigger ON public.operating_costs;
CREATE TRIGGER workspace_links_trigger BEFORE INSERT OR UPDATE ON public.operating_costs FOR EACH ROW EXECUTE FUNCTION public.check_workspace_links();
CREATE OR REPLACE FUNCTION public.guard_operating_cost() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE config jsonb; used bigint; cap bigint; per_expense bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text,0));
 SELECT settings->'hospitality' INTO config FROM public.organization_settings WHERE organization_id=NEW.organization_id;
 cap:=COALESCE((config->>'monthlyBudgetMinor')::bigint,0);per_expense:=COALESCE((config->>'perExpenseLimitMinor')::bigint,0);
 IF TG_OP='UPDATE' THEN
  IF (NEW.organization_id,NEW.property_id,NEW.job_id,NEW.amount_minor,NEW.currency,NEW.expense_date,NEW.description,NEW.category,NEW.requested_by) IS DISTINCT FROM (OLD.organization_id,OLD.property_id,OLD.job_id,OLD.amount_minor,OLD.currency,OLD.expense_date,OLD.description,OLD.category,OLD.requested_by) THEN RAISE EXCEPTION 'Cost details are immutable; reject a pending entry and create a correction'; END IF;
  IF OLD.status<>'pending' THEN RAISE EXCEPTION 'Final cost decisions are immutable'; END IF;
  IF NEW.status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Choose approve or reject'; END IF;
 ELSE
  NEW.currency:=COALESCE(config->>'currency','INR');
  NEW.status:=CASE WHEN NEW.amount_minor<=COALESCE((config->>'approvalThresholdMinor')::bigint,0) THEN 'approved' ELSE 'pending' END;
  NEW.requested_by:=COALESCE(auth.uid(),NEW.requested_by);
  IF date_trunc('month',NEW.expense_date)<>date_trunc('month',(now() AT TIME ZONE 'UTC')::date) THEN RAISE EXCEPTION 'New operating costs must belong to the current UTC month'; END IF;
 END IF;
 IF NEW.job_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.service_jobs WHERE id=NEW.job_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id) THEN RAISE EXCEPTION 'Job belongs to another property'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=NEW.requested_by AND organization_id=NEW.organization_id AND is_active AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'Cost creator must be a company administrator'; END IF;
 IF NEW.status IN ('pending','approved') THEN
  IF cap<=0 OR per_expense<=0 THEN RAISE EXCEPTION 'Configure positive monthly and per-expense limits in Settings before recording costs'; END IF;
  IF NEW.amount_minor>per_expense THEN RAISE EXCEPTION 'Per-expense hard limit exceeded'; END IF;
  SELECT COALESCE(sum(amount_minor),0) INTO used FROM public.operating_costs WHERE organization_id=NEW.organization_id AND currency=NEW.currency AND date_trunc('month',expense_date)=date_trunc('month',NEW.expense_date) AND status IN ('pending','approved') AND id<>NEW.id;
  IF used+NEW.amount_minor>cap THEN RAISE EXCEPTION 'Monthly hard budget limit exceeded; pending approvals also reserve budget'; END IF;
 END IF;
 NEW.approved_by:=CASE WHEN NEW.status IN ('approved','rejected') THEN COALESCE(auth.uid(),NEW.requested_by) ELSE NULL END;
 NEW.updated_at:=now();RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_cost_guard ON public.operating_costs;
CREATE TRIGGER zz_cost_guard BEFORE INSERT OR UPDATE ON public.operating_costs FOR EACH ROW EXECUTE FUNCTION public.guard_operating_cost();
DROP TRIGGER IF EXISTS hotel_history ON public.operating_costs;
CREATE TRIGGER hotel_history AFTER INSERT OR UPDATE ON public.operating_costs FOR EACH ROW EXECUTE FUNCTION public.hotel_record_activity();
CREATE OR REPLACE FUNCTION public.guard_hotel_budget_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE config jsonb; previous jsonb; used bigint; old_currency text;
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(OLD.organization_id::text,0));
  IF EXISTS(SELECT 1 FROM public.operating_costs WHERE organization_id=OLD.organization_id AND date_trunc('month',expense_date)=date_trunc('month',(now() AT TIME ZONE 'UTC')::date) AND status IN ('pending','approved')) THEN RAISE EXCEPTION 'Cannot remove budget settings while current-month costs are reserved or approved'; END IF;
  RETURN OLD;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text,0));
 config:=NEW.settings->'hospitality';
 IF config IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.operating_costs WHERE organization_id=NEW.organization_id AND date_trunc('month',expense_date)=date_trunc('month',(now() AT TIME ZONE 'UTC')::date) AND status IN ('pending','approved')) THEN RAISE EXCEPTION 'Budget settings are required while current-month costs are reserved or approved'; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN previous:=OLD.settings->'hospitality'; END IF;
 old_currency:=COALESCE(previous->>'currency','INR');
 SELECT COALESCE(sum(amount_minor),0) INTO used FROM public.operating_costs WHERE organization_id=NEW.organization_id AND date_trunc('month',expense_date)=date_trunc('month',(now() AT TIME ZONE 'UTC')::date) AND status IN ('pending','approved');
 IF EXISTS(SELECT 1 FROM public.operating_costs WHERE organization_id=NEW.organization_id AND currency<>COALESCE(config->>'currency','INR') AND date_trunc('month',expense_date)=date_trunc('month',(now() AT TIME ZONE 'UTC')::date) AND status IN ('pending','approved')) THEN RAISE EXCEPTION 'Currency cannot change while this month has reserved or approved costs'; END IF;
 IF used>0 AND COALESCE(config->>'currency','INR')<>old_currency THEN RAISE EXCEPTION 'Currency cannot change while this month has reserved or approved costs'; END IF;
 IF used>COALESCE((config->>'monthlyBudgetMinor')::bigint,0) THEN RAISE EXCEPTION 'Monthly budget cannot be lower than this month reserved and approved costs'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hotel_budget_settings ON public.organization_settings;
CREATE TRIGGER hotel_budget_settings BEFORE INSERT OR UPDATE OR DELETE ON public.organization_settings FOR EACH ROW EXECUTE FUNCTION public.guard_hotel_budget_settings();
CREATE OR REPLACE FUNCTION public.hotel_budget_snapshot(p_month date DEFAULT CURRENT_DATE) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE config jsonb; approved bigint; pending bigint; cap bigint;
BEGIN
 IF NOT public.workspace_admin() THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 SELECT settings->'hospitality' INTO config FROM public.organization_settings WHERE organization_id=public.workspace_org();
 cap:=COALESCE((config->>'monthlyBudgetMinor')::bigint,0);
 SELECT COALESCE(sum(amount_minor) FILTER(WHERE status='approved'),0),COALESCE(sum(amount_minor) FILTER(WHERE status='pending'),0) INTO approved,pending FROM public.operating_costs WHERE organization_id=public.workspace_org() AND currency=COALESCE(config->>'currency','INR') AND date_trunc('month',expense_date)=date_trunc('month',p_month);
 RETURN jsonb_build_object('currency',COALESCE(config->>'currency','INR'),'limit',cap,'approved',approved,'pending',pending,'remaining',GREATEST(0,cap-approved-pending));
END $$;
GRANT EXECUTE ON FUNCTION public.hotel_budget_snapshot(date) TO authenticated,service_role;
COMMIT;

-- 22. OVERDUE OPERATIONS ALERTS THROUGH THE EXISTING DELIVERY WORKER
BEGIN;
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check CHECK(kind IN ('sla','followup','invitation','team_invitation','report','webhook','asset_cleanup','operations_alert'));
CREATE OR REPLACE FUNCTION public.schedule_hotel_work(p_org uuid DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job record; recipient text; queued integer:=0; inserted integer;
BEGIN
 FOR job IN SELECT j.* FROM public.service_jobs j JOIN public.organization_settings s ON s.organization_id=j.organization_id WHERE j.status IN ('open','in_progress') AND j.due_at<now() AND COALESCE((s.settings->'hospitality'->>'alertsEnabled')::boolean,false) AND (p_org IS NULL OR j.organization_id=p_org) FOR UPDATE OF j SKIP LOCKED LOOP
  SELECT settings->>'alertEmail' INTO recipient FROM public.organization_settings WHERE organization_id=job.organization_id;
  INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(job.organization_id,'operations_alert','hotel-job:'||job.id||':'||job.due_at,jsonb_build_object('jobId',job.id,'title',job.title,'deadline',job.due_at,'recipient',recipient)) ON CONFLICT(dedup_key) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;queued:=queued+inserted;
  UPDATE public.service_jobs SET escalated_at=COALESCE(escalated_at,now()) WHERE id=job.id AND escalated_at IS NULL;
 END LOOP;
 RETURN queued;
END $$;
REVOKE ALL ON FUNCTION public.schedule_hotel_work(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_hotel_work(uuid) TO service_role;
COMMIT;

-- 23. ATOMIC ADMIN CONFIGURATION
BEGIN;
CREATE OR REPLACE FUNCTION public.save_hotel_settings(p_settings jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE org uuid;
BEGIN
 IF NOT public.workspace_admin() THEN RAISE EXCEPTION 'Company administrator required' USING ERRCODE='42501'; END IF;
 org:=public.workspace_org();
 UPDATE public.organizations SET name=p_settings->>'organizationName',timezone=p_settings->>'defaultTimezone',
 logo_url=NULLIF(p_settings->>'logoUrl',''),welcome_message=COALESCE(p_settings->>'guestWelcomeMessage',''),
 brand_color=COALESCE(p_settings->'hospitality'->'colors'->>'feedback',brand_color) WHERE id=org;
 INSERT INTO public.organization_settings(organization_id,settings,updated_at) VALUES(org,p_settings,now())
 ON CONFLICT(organization_id) DO UPDATE SET settings=excluded.settings,updated_at=now();
 RETURN p_settings;
END $$;
REVOKE ALL ON FUNCTION public.save_hotel_settings(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_hotel_settings(jsonb) TO authenticated;
COMMIT;


-- 24. LINK VERIFIED STAY FEEDBACK TO GUEST HISTORY
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_feedback_stay() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.stay_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.stays WHERE id=NEW.stay_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id) THEN
  RAISE EXCEPTION 'Feedback must belong to the same property as its guest stay';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zz_feedback_stay ON public.feedback;
CREATE TRIGGER zz_feedback_stay BEFORE INSERT OR UPDATE OF stay_id,property_id,organization_id ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.guard_feedback_stay();
CREATE OR REPLACE FUNCTION public.submit_guest_feedback(p_feedback jsonb,p_answers jsonb DEFAULT '[]') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row public.feedback; answer jsonb;
BEGIN
 INSERT INTO public.feedback(organization_id,property_id,stay_id,invitation_id,recommendation_score,guest_name,guest_email,guest_phone,room_number,department,rating,comment,wants_contact,contact_preference,status,tone,resolved_at,resolution_notes)
 VALUES((p_feedback->>'organization_id')::uuid,(p_feedback->>'property_id')::uuid,(p_feedback->>'stay_id')::uuid,(p_feedback->>'invitation_id')::uuid,(p_feedback->>'recommendation_score')::smallint,
 p_feedback->>'guest_name',p_feedback->>'guest_email',p_feedback->>'guest_phone',p_feedback->>'room_number',(p_feedback->>'department')::department_type,(p_feedback->>'rating')::smallint,p_feedback->>'comment',
 COALESCE((p_feedback->>'wants_contact')::boolean,false),p_feedback->>'contact_preference',(p_feedback->>'status')::feedback_status,(p_feedback->>'tone')::feedback_tone,(p_feedback->>'resolved_at')::timestamptz,p_feedback->>'resolution_notes') RETURNING * INTO row;
 FOR answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
  INSERT INTO public.feedback_answers(organization_id,feedback_id,question_id,question_text,answer_value)
  VALUES(row.organization_id,row.id,(answer->>'questionId')::uuid,answer->>'questionText',answer->>'answerValue');
 END LOOP;
 RETURN to_jsonb(row);
END $$;
REVOKE ALL ON FUNCTION public.submit_guest_feedback(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guest_feedback(jsonb,jsonb) TO service_role;
COMMIT;

-- 25. EXPLICIT MODULE GRANTS AND PROPERTY-SCOPED HOTEL READ ACCESS
-- Existing users retain feedback access until an administrator saves explicit module assignments.
BEGIN;
CREATE OR REPLACE FUNCTION public.workspace_module(module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.workspace_admin() OR EXISTS(
  SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.organization_id=public.workspace_org() AND
  (('module:'||module)=ANY(p.rights) OR (module='feedback' AND NOT ('module_access:configured'=ANY(p.rights)) AND p.rights && ARRAY['view_feedback','manage_complaints','reassign_property','manage_questionnaire','export_reports','view_audit_log']::text[]))
 )
$$;
REVOKE ALL ON FUNCTION public.workspace_module(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.workspace_module(text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.workspace_right(r text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.workspace_admin() OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.organization_id=public.workspace_org() AND r=ANY(p.rights)
 AND (r NOT IN ('view_feedback','manage_complaints','reassign_property','manage_questionnaire','export_reports','view_audit_log') OR public.workspace_module('feedback')))
$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['hotel_rooms','service_jobs','room_inspections'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS hotel_module_read ON public.%I',t);
  EXECUTE format('CREATE POLICY hotel_module_read ON public.%I FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_module(''hospitality'') AND public.workspace_property(property_id))',t);
 END LOOP;
END $$;
COMMIT;

-- 26. PROPERTY / COUNTRY ROLE ROUTING (apply after sections 12–25)
BEGIN;
CREATE TABLE IF NOT EXISTS public.role_mappings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 module text NOT NULL CHECK(module IN ('feedback','hospitality')),
 property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
 country text NOT NULL DEFAULT '',
 department text NOT NULL DEFAULT '*' CHECK(department IN ('*','Front Desk','Housekeeping','Food & Beverage','Concierge','Facilities & Room','Spa & Wellness','Valet & Transfers')),
 role_name text NOT NULL CHECK(length(trim(role_name)) BETWEEN 1 AND 80),
 assignee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 max_rating integer NOT NULL DEFAULT 3 CHECK(max_rating BETWEEN 1 AND 3),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(property_id IS NULL OR country='')
);
CREATE UNIQUE INDEX IF NOT EXISTS role_mapping_scope ON public.role_mappings(organization_id,module,COALESCE(property_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(country),department);
ALTER TABLE public.role_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_mapping_admin ON public.role_mappings;
CREATE POLICY role_mapping_admin ON public.role_mappings FOR ALL TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_admin()) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_admin());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.role_mappings TO authenticated;
GRANT ALL ON public.role_mappings TO service_role;
CREATE OR REPLACE FUNCTION public.guard_role_mapping() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND (NOT public.workspace_admin() OR NEW.organization_id IS DISTINCT FROM public.workspace_org()) THEN RAISE EXCEPTION 'Company administrator access required' USING ERRCODE='42501'; END IF;
 NEW.country:=trim(NEW.country); NEW.role_name:=trim(NEW.role_name);
 IF NEW.property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=NEW.property_id AND organization_id=NEW.organization_id AND is_active) THEN RAISE EXCEPTION 'Choose an active property in this company'; END IF;
 IF NEW.country<>'' AND NOT EXISTS(SELECT 1 FROM public.properties WHERE organization_id=NEW.organization_id AND lower(country)=lower(NEW.country) AND is_active) THEN RAISE EXCEPTION 'Choose a country with active properties in this company'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.organization_id=NEW.organization_id AND p.organization_id=NEW.organization_id AND m.user_id=NEW.assignee_id AND m.is_active) THEN RAISE EXCEPTION 'Choose an active company member'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS role_mapping_guard ON public.role_mappings;
CREATE TRIGGER role_mapping_guard BEFORE INSERT OR UPDATE ON public.role_mappings FOR EACH ROW EXECUTE FUNCTION public.guard_role_mapping();
-- Resolve a responsibility only while the member still has permission for the actual property/module.
-- More specific rules win: property > country > company, then exact department > all departments.
CREATE OR REPLACE FUNCTION public.resolve_role_owner(p_org uuid,p_property uuid,p_module text,p_department text,p_rating integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.assignee_id FROM public.role_mappings r
 JOIN public.properties h ON h.id=p_property AND h.organization_id=p_org AND h.is_active
 JOIN public.organization_members m ON m.user_id=r.assignee_id AND m.organization_id=p_org AND m.is_active
 JOIN public.profiles p ON p.id=m.user_id AND p.organization_id=p_org
 WHERE r.organization_id=p_org AND r.is_active AND r.module=p_module
 AND (r.property_id=p_property OR (r.property_id IS NULL AND (r.country='' OR lower(r.country)=lower(h.country))))
 AND (r.department='*' OR r.department=p_department) AND p_rating<=r.max_rating
 AND (m.role IN ('owner','admin') OR (
  (p.property_id=p_property OR p_property=ANY(p.property_ids))
  AND (('module:'||p_module)=ANY(p.rights) OR (p_module='feedback' AND NOT ('module_access:configured'=ANY(p.rights)) AND p.rights && ARRAY['view_feedback','manage_complaints']))
  AND (p_module<>'feedback' OR ('manage_complaints'=ANY(p.rights) AND (NOT EXISTS(SELECT 1 FROM unnest(p.rights) x WHERE x LIKE 'dept_scope:%') OR ('dept_scope:'||p_department)=ANY(p.rights))))
 ))
 ORDER BY CASE WHEN r.property_id IS NOT NULL THEN 0 WHEN r.country<>'' THEN 1 ELSE 2 END,CASE WHEN r.department='*' THEN 1 ELSE 0 END,r.id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_role_owner(uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.route_attention_work() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; dept text:='*'; score integer:=3; should_route boolean;
BEGIN
 IF TG_TABLE_NAME='feedback' THEN
  IF TG_OP='INSERT' AND NEW.rating<=3 THEN NEW.status:='needs_attention'; NEW.resolved_at:=NULL; END IF;
  should_route:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN should_route:=NEW.property_id IS DISTINCT FROM OLD.property_id OR (OLD.status='resolved' AND NEW.status<>'resolved'); END IF;
  IF should_route AND NEW.rating<=3 AND NEW.status<>'resolved' AND NEW.assigned_to IS NULL AND NEW.assigned_user_id IS NULL THEN
   owner_id:=public.resolve_role_owner(NEW.organization_id,NEW.property_id,'feedback',NEW.department::text,NEW.rating);
   IF owner_id IS NOT NULL THEN NEW.assigned_user_id:=owner_id; SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id=owner_id; END IF;
  END IF;
 ELSE
  IF NEW.feedback_id IS NOT NULL THEN SELECT department::text,rating INTO dept,score FROM public.feedback WHERE id=NEW.feedback_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id; END IF;
  IF TG_OP='INSERT' AND NEW.assigned_to IS NULL AND (NEW.priority IN ('high','critical') OR (NEW.feedback_id IS NOT NULL AND score<=3)) THEN
   NEW.assigned_to:=public.resolve_role_owner(NEW.organization_id,NEW.property_id,'hospitality',dept,CASE WHEN NEW.priority IN ('high','critical') THEN 1 ELSE score END);
  END IF;
 END IF;
 RETURN NEW;
END $$;
-- Run after workspace stamping and before the existing hotel relationship guard.
DROP TRIGGER IF EXISTS b_role_route ON public.feedback;
CREATE TRIGGER b_role_route BEFORE INSERT OR UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();
DROP TRIGGER IF EXISTS zy_role_route ON public.service_jobs;
CREATE TRIGGER zy_role_route BEFORE INSERT ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();
CREATE OR REPLACE FUNCTION public.case_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changes jsonb; raw_token text; follow_id uuid; endpoint record; auto_follow boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  changes:=jsonb_build_object('status',NEW.status,'priority',NEW.priority,'assigned_to',NEW.assigned_to,'assigned_user_id',NEW.assigned_user_id);
  IF NEW.invitation_id IS NOT NULL THEN UPDATE public.guest_invitations SET feedback_id=NEW.id WHERE id=NEW.invitation_id; END IF;
 ELSE
  changes:=(SELECT COALESCE(jsonb_object_agg(n.key,jsonb_build_object('from',o.value,'to',n.value)),'{}')
   FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o ON o.key=n.key
   WHERE n.value IS DISTINCT FROM o.value AND n.key IN ('status','assigned_to','assigned_user_id','priority','sla_deadline','resolution_notes','category'));
 END IF;
 IF changes<>'{}' THEN
  INSERT INTO public.feedback_activity(organization_id,feedback_id,actor_id,action,changes)
   VALUES(NEW.organization_id,NEW.id,auth.uid(),CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,changes);
  FOR endpoint IN SELECT * FROM public.webhook_endpoints WHERE organization_id=NEW.organization_id AND is_active LOOP
   INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(NEW.organization_id,'webhook',
    'webhook:'||endpoint.id||':'||NEW.id||':'||NEW.updated_at,
    jsonb_build_object('endpointId',endpoint.id,'event','feedback.'||CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,'feedbackId',NEW.id,'changes',changes)) ON CONFLICT(dedup_key) DO NOTHING;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
-- 27. COMPLAINT INTAKE AND JUNIOR -> SENIOR -> GM ESCALATION
-- Existing database: apply section 26 / 20261027_role_mapping.sql FIRST, then this file.
-- Run POST /api/jobs every minute with Authorization: Bearer WORKSPACE_CRON_SECRET.
-- Email/channel delivery also needs the configured delivery provider.
-- Full schema.sql already includes both upgrades; do not run old development seeds on live data.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.role_mappings') IS NULL THEN RAISE EXCEPTION 'Install schema sections 12-25 and 20261027_role_mapping.sql (section 26) before this complaint upgrade'; END IF;
END $$;
ALTER TABLE public.role_mappings DROP CONSTRAINT IF EXISTS role_mappings_department_check;
ALTER TABLE public.role_mappings ADD CONSTRAINT role_mappings_department_check CHECK(length(trim(department)) BETWEEN 1 AND 80);
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS senior_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS gm_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS response_minutes integer NOT NULL DEFAULT 15 CHECK(response_minutes BETWEEN 1 AND 1440);
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS senior_response_minutes integer NOT NULL DEFAULT 20 CHECK(senior_response_minutes BETWEEN 1 AND 1440);
ALTER TABLE public.role_mappings ADD COLUMN IF NOT EXISTS escalate_until text NOT NULL DEFAULT 'acknowledged' CHECK(escalate_until IN ('acknowledged','resolved'));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['feedback','service_jobs'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS routing_rule_id uuid REFERENCES public.role_mappings(id) ON DELETE SET NULL',t);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS routing_cycle uuid NOT NULL DEFAULT gen_random_uuid()',t);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0 CHECK(escalation_level BETWEEN 0 AND 2)',t);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS escalation_due_at timestamptz',t);
 END LOOP;
END $$;
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT '*';
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS issue_type text;
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS intake_channel text NOT NULL DEFAULT 'staff' CHECK(intake_channel IN ('staff','front_desk','phone','guest_request'));
ALTER TABLE public.service_jobs ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
CREATE INDEX IF NOT EXISTS service_jobs_escalation_due ON public.service_jobs(escalation_due_at) WHERE status IN ('open','in_progress');
CREATE INDEX IF NOT EXISTS feedback_escalation_due ON public.feedback(escalation_due_at) WHERE status<>'resolved';

CREATE OR REPLACE FUNCTION public.complaint_schema_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.complaint_schema_ready() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complaint_schema_ready() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.role_member_eligible(p_user uuid,p_org uuid,p_property uuid,p_module text,p_department text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id
 JOIN public.properties h ON h.id=p_property AND h.organization_id=p_org AND h.is_active
 WHERE m.user_id=p_user AND m.organization_id=p_org AND m.is_active AND p.organization_id=p_org
 AND (m.role IN ('owner','admin') OR (
  (p.property_id=p_property OR p_property=ANY(p.property_ids))
  AND (('module:'||p_module)=ANY(p.rights) OR (p_module='feedback' AND NOT ('module_access:configured'=ANY(p.rights)) AND 'manage_complaints'=ANY(p.rights)))
  AND (CASE WHEN p_module='feedback' THEN 'manage_complaints' ELSE 'manage_service_jobs' END)=ANY(p.rights)
  AND (NOT EXISTS(SELECT 1 FROM unnest(p.rights) x WHERE x LIKE 'dept_scope:%') OR p.rights && ARRAY['dept_scope:*','dept_scope:All Departments','dept_scope:'||p_department])
 )))
$$;
REVOKE ALL ON FUNCTION public.role_member_eligible(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.role_member_eligible(uuid,uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.resolve_role_chain(p_org uuid,p_property uuid,p_module text,p_department text,p_rating integer) RETURNS SETOF public.role_mappings LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.* FROM public.role_mappings r JOIN public.properties h ON h.id=p_property AND h.organization_id=p_org AND h.is_active
 WHERE r.organization_id=p_org AND r.is_active AND r.module=p_module AND p_rating<=r.max_rating
 AND (r.property_id=p_property OR (r.property_id IS NULL AND (r.country='' OR lower(r.country)=lower(h.country))))
 AND r.department IN ('*',p_department) AND public.role_member_eligible(r.assignee_id,p_org,p_property,p_module,p_department)
 ORDER BY CASE WHEN r.property_id IS NOT NULL THEN 0 WHEN r.country<>'' THEN 1 ELSE 2 END,CASE WHEN r.department='*' THEN 1 ELSE 0 END,r.id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.resolve_role_chain(uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.resolve_role_owner(p_org uuid,p_property uuid,p_module text,p_department text,p_rating integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT assignee_id FROM public.resolve_role_chain(p_org,p_property,p_module,p_department,p_rating)
$$;
CREATE OR REPLACE FUNCTION public.guard_role_mapping() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE candidate uuid;
BEGIN
 IF auth.uid() IS NOT NULL AND (NOT public.workspace_admin() OR NEW.organization_id IS DISTINCT FROM public.workspace_org()) THEN RAISE EXCEPTION 'Company administrator access required' USING ERRCODE='42501'; END IF;
 NEW.country:=trim(NEW.country);NEW.department:=trim(NEW.department);NEW.role_name:=trim(NEW.role_name);
 IF NEW.property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=NEW.property_id AND organization_id=NEW.organization_id AND is_active) THEN RAISE EXCEPTION 'Choose an active property in this company'; END IF;
 IF NEW.country<>'' AND NOT EXISTS(SELECT 1 FROM public.properties WHERE organization_id=NEW.organization_id AND lower(country)=lower(NEW.country) AND is_active) THEN RAISE EXCEPTION 'Choose a country with active properties in this company'; END IF;
 FOREACH candidate IN ARRAY ARRAY[NEW.assignee_id,NEW.senior_assignee_id,NEW.gm_assignee_id] LOOP
  IF candidate IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id WHERE m.organization_id=NEW.organization_id AND p.organization_id=NEW.organization_id AND m.user_id=candidate AND m.is_active) THEN RAISE EXCEPTION 'Every escalation owner must be an active company member'; END IF;
 END LOOP;
 IF NEW.assignee_id=NEW.senior_assignee_id OR NEW.assignee_id=NEW.gm_assignee_id OR NEW.senior_assignee_id=NEW.gm_assignee_id THEN RAISE EXCEPTION 'Choose different members for each escalation level'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.route_attention_work() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rule public.role_mappings; dept text:='*'; score integer:=3; should_route boolean:=false;
BEGIN
 IF TG_TABLE_NAME='feedback' THEN
  IF TG_OP='INSERT' AND NEW.rating<=3 THEN NEW.status:='needs_attention';NEW.resolved_at:=NULL;END IF;
  should_route:=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN
   should_route:=OLD.status='resolved' AND NEW.status<>'resolved';
   IF should_route THEN NEW.routing_cycle:=gen_random_uuid();NEW.escalation_level:=0;NEW.first_response_at:=NULL;NEW.routing_rule_id:=NULL;NEW.escalation_due_at:=NULL;END IF;
   IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND auth.uid() IS NOT NULL THEN NEW.routing_rule_id:=NULL;NEW.escalation_due_at:=NULL;END IF;
  END IF;
  IF should_route AND NEW.rating<=3 AND NEW.status<>'resolved' AND NEW.assigned_to IS NULL AND NEW.assigned_user_id IS NULL THEN
   SELECT * INTO rule FROM public.resolve_role_chain(NEW.organization_id,NEW.property_id,'feedback',NEW.department::text,NEW.rating);
   IF FOUND THEN NEW.assigned_user_id:=rule.assignee_id;SELECT full_name INTO NEW.assigned_to FROM public.profiles WHERE id=rule.assignee_id;NEW.routing_rule_id:=rule.id;NEW.sla_deadline:=now()+make_interval(mins=>rule.response_minutes);NEW.escalation_due_at:=CASE WHEN rule.senior_assignee_id IS NOT NULL OR rule.gm_assignee_id IS NOT NULL THEN NEW.sla_deadline ELSE NULL END;END IF;
  END IF;
  IF NEW.status='resolved' OR (NEW.first_response_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.role_mappings WHERE id=NEW.routing_rule_id AND escalate_until='acknowledged')) THEN NEW.escalation_due_at:=NULL;END IF;
 ELSE
  IF TG_OP='INSERT' THEN
   IF NEW.feedback_id IS NOT NULL THEN SELECT department::text,rating INTO dept,score FROM public.feedback WHERE id=NEW.feedback_id AND organization_id=NEW.organization_id AND property_id=NEW.property_id;IF NEW.department='*' THEN NEW.department:=COALESCE(dept,'*');END IF;END IF;
   IF NEW.assigned_to IS NULL AND (NEW.issue_type IS NOT NULL OR NEW.priority IN ('high','critical') OR (NEW.feedback_id IS NOT NULL AND score<=3)) THEN
    SELECT * INTO rule FROM public.resolve_role_chain(NEW.organization_id,NEW.property_id,'hospitality',NEW.department,CASE WHEN NEW.priority IN ('high','critical') OR NEW.issue_type IS NOT NULL THEN 1 ELSE score END);
    IF FOUND THEN NEW.assigned_to:=rule.assignee_id;NEW.routing_rule_id:=rule.id;NEW.due_at:=now()+make_interval(mins=>rule.response_minutes);NEW.escalation_due_at:=CASE WHEN rule.senior_assignee_id IS NOT NULL OR rule.gm_assignee_id IS NOT NULL THEN NEW.due_at ELSE NULL END;END IF;
   END IF;
  ELSE
   IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND auth.uid() IS NOT NULL THEN NEW.routing_rule_id:=NULL;NEW.escalation_due_at:=NULL;END IF;
   IF NEW.status IN ('in_progress','completed') AND OLD.status='open' OR NEW.acknowledged_at IS NOT NULL AND OLD.acknowledged_at IS NULL THEN NEW.acknowledged_at:=COALESCE(OLD.acknowledged_at,now());END IF;
  END IF;
  IF NEW.status IN ('completed','cancelled') OR (NEW.acknowledged_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.role_mappings WHERE id=NEW.routing_rule_id AND escalate_until='acknowledged')) THEN NEW.escalation_due_at:=NULL;END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS b_role_route ON public.feedback;
DROP TRIGGER IF EXISTS zz_role_route ON public.feedback;
DROP TRIGGER IF EXISTS b_role_insert ON public.feedback;
CREATE TRIGGER b_role_insert BEFORE INSERT ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();
DROP TRIGGER IF EXISTS zz_role_update ON public.feedback;
CREATE TRIGGER zz_role_update BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();
DROP TRIGGER IF EXISTS zy_role_route ON public.service_jobs;
CREATE TRIGGER zy_role_route BEFORE INSERT OR UPDATE ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.route_attention_work();

CREATE OR REPLACE FUNCTION public.guard_staff_job_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.workspace_admin() THEN
  IF OLD.assigned_to IS DISTINCT FROM auth.uid() OR NOT public.workspace_right('manage_service_jobs') OR NOT public.workspace_module('hospitality') OR NOT public.workspace_property(OLD.property_id) OR NOT public.workspace_department(OLD.department) OR NOT public.hotel_enabled('operations') THEN RAISE EXCEPTION 'Only the assigned authorized member can attend this job' USING ERRCODE='42501';END IF;
  IF (to_jsonb(NEW)-'status'-'acknowledged_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'acknowledged_at') OR NEW.status NOT IN ('open','in_progress','completed') OR OLD.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Assigned staff may acknowledge, start or complete work only' USING ERRCODE='42501';END IF;
  IF OLD.acknowledged_at IS NOT NULL AND NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at THEN RAISE EXCEPTION 'Acknowledgement is immutable' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS a_staff_job_update ON public.service_jobs;
CREATE TRIGGER a_staff_job_update BEFORE UPDATE ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.guard_staff_job_update();
DROP POLICY IF EXISTS hotel_module_read ON public.service_jobs;
CREATE POLICY hotel_module_read ON public.service_jobs FOR SELECT TO authenticated USING(organization_id=public.workspace_org() AND public.workspace_module('hospitality') AND public.workspace_property(property_id) AND (public.workspace_department(department) OR created_by=auth.uid()));
DROP POLICY IF EXISTS assigned_job_update ON public.service_jobs;
CREATE POLICY assigned_job_update ON public.service_jobs FOR UPDATE TO authenticated USING(organization_id=public.workspace_org() AND assigned_to=auth.uid() AND public.workspace_module('hospitality') AND public.workspace_property(property_id) AND public.workspace_department(department) AND public.workspace_right('manage_service_jobs')) WITH CHECK(organization_id=public.workspace_org() AND assigned_to=auth.uid());

-- Managed feedback follows the current escalation owner; manual legacy cases keep existing permissions.
DROP POLICY IF EXISTS feedback_update ON public.feedback;
CREATE POLICY feedback_update ON public.feedback FOR UPDATE TO authenticated USING(public.workspace_property(property_id) AND public.workspace_department(department::text) AND public.workspace_right('manage_complaints') AND (routing_rule_id IS NULL OR public.workspace_admin() OR assigned_user_id=auth.uid())) WITH CHECK(organization_id=public.workspace_org() AND public.workspace_property(property_id) AND public.workspace_department(department::text));
CREATE OR REPLACE FUNCTION public.guard_managed_feedback_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.workspace_admin() AND OLD.routing_rule_id IS NOT NULL THEN
  IF OLD.assigned_user_id IS DISTINCT FROM auth.uid() OR (to_jsonb(NEW)-'status'-'first_response_at'-'resolution_notes'-'priority'-'category') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'first_response_at'-'resolution_notes'-'priority'-'category') THEN RAISE EXCEPTION 'Only the current owner may attend routed feedback; only administrators may reassign it' USING ERRCODE='42501';END IF;
  IF OLD.first_response_at IS NOT NULL AND NEW.first_response_at IS DISTINCT FROM OLD.first_response_at THEN RAISE EXCEPTION 'First response is immutable' USING ERRCODE='42501';END IF;
  IF NEW.first_response_at IS NOT NULL AND OLD.first_response_at IS NULL THEN NEW.first_response_at:=now();END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS a_managed_feedback ON public.feedback;
CREATE TRIGGER a_managed_feedback BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.guard_managed_feedback_update();

CREATE OR REPLACE FUNCTION public.submit_service_complaint(p_complaint jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.workspace_org(); pid uuid:=(p_complaint->>'property_id')::uuid; issue text:=p_complaint->>'issue_type'; dept text; result uuid;
BEGIN
 IF NOT public.workspace_module('hospitality') OR NOT public.workspace_property(pid) OR NOT (public.workspace_admin() OR public.workspace_right('manage_service_jobs')) OR NOT public.hotel_enabled('operations') THEN RAISE EXCEPTION 'Complaint access requires an authorized property and hotel operations permission' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.properties WHERE id=pid AND organization_id=org AND is_active) THEN RAISE EXCEPTION 'Choose an active property';END IF;
 dept:=CASE issue WHEN 'wifi' THEN 'IT' WHEN 'television' THEN 'IT' WHEN 'lighting' THEN 'Engineering' WHEN 'air_conditioning' THEN 'Engineering' WHEN 'plumbing' THEN 'Engineering' WHEN 'cleanliness' THEN 'Housekeeping' WHEN 'noise' THEN 'Front Desk' WHEN 'food_service' THEN 'Food & Beverage' WHEN 'other' THEN p_complaint->>'department' ELSE NULL END;
 IF dept IS NULL OR dept NOT IN ('IT','Engineering','Housekeeping','Front Desk','Food & Beverage','Concierge','Spa & Wellness','Valet & Transfers') THEN RAISE EXCEPTION 'Choose a valid issue and department';END IF;
 IF COALESCE(length(trim(p_complaint->>'title')),0) NOT BETWEEN 1 AND 160 OR COALESCE(length(p_complaint->>'description'),0)>2000 OR COALESCE(length(trim(p_complaint->>'location')),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Complaint requires a title and room/location within the allowed length';END IF;
 IF COALESCE(p_complaint->>'priority','normal') NOT IN ('low','normal','high','critical') OR COALESCE(p_complaint->>'intake_channel','staff') NOT IN ('staff','front_desk','phone','guest_request') THEN RAISE EXCEPTION 'Invalid priority or intake channel';END IF;
 INSERT INTO public.service_jobs(organization_id,property_id,created_by,kind,title,description,priority,due_at,department,issue_type,location,intake_channel)
 VALUES(org,pid,auth.uid(),'guest_request',trim(p_complaint->>'title'),COALESCE(p_complaint->>'description',''),COALESCE(p_complaint->>'priority','normal'),now()+interval '15 minutes',dept,issue,trim(p_complaint->>'location'),COALESCE(p_complaint->>'intake_channel','staff')) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.submit_service_complaint(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_service_complaint(jsonb) TO authenticated;

ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check CHECK(kind IN ('sla','followup','invitation','team_invitation','report','webhook','asset_cleanup','operations_alert','role_assignment'));
CREATE OR REPLACE FUNCTION public.queue_role_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id uuid; changed boolean; module text;
BEGIN
 module:=CASE WHEN TG_TABLE_NAME='feedback' THEN 'feedback' ELSE 'hospitality' END;
 owner_id:=CASE WHEN TG_TABLE_NAME='feedback' THEN (to_jsonb(NEW)->>'assigned_user_id')::uuid ELSE (to_jsonb(NEW)->>'assigned_to')::uuid END;
 changed:=TG_OP='INSERT';
 IF TG_OP='UPDATE' THEN changed:=NEW.escalation_level IS DISTINCT FROM OLD.escalation_level OR NEW.routing_cycle IS DISTINCT FROM OLD.routing_cycle OR (to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='feedback' THEN 'assigned_user_id' ELSE 'assigned_to' END) IS DISTINCT FROM (to_jsonb(OLD)->>CASE WHEN TG_TABLE_NAME='feedback' THEN 'assigned_user_id' ELSE 'assigned_to' END);END IF;
 IF changed AND NEW.routing_rule_id IS NOT NULL AND owner_id IS NOT NULL THEN
  INSERT INTO public.notification_outbox(organization_id,kind,dedup_key,payload) VALUES(NEW.organization_id,'role_assignment','role:'||module||':'||NEW.id||':'||NEW.routing_cycle||':'||NEW.escalation_level,
   jsonb_build_object('module',module,'recordId',NEW.id,'assignedUserId',owner_id,'level',NEW.escalation_level,'cycle',NEW.routing_cycle)) ON CONFLICT(dedup_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS role_assignment_notice ON public.feedback;
CREATE TRIGGER role_assignment_notice AFTER INSERT OR UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.queue_role_assignment();
DROP TRIGGER IF EXISTS role_assignment_notice ON public.service_jobs;
CREATE TRIGGER role_assignment_notice AFTER INSERT OR UPDATE ON public.service_jobs FOR EACH ROW EXECUTE FUNCTION public.queue_role_assignment();

CREATE OR REPLACE FUNCTION public.advance_role_escalations(p_org uuid DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item record;rule public.role_mappings;candidate uuid;level_next integer;level_found integer;dept text;mod text;changed integer:=0;t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['feedback','service_jobs'] LOOP
  FOR item IN EXECUTE format('SELECT *,department::text AS routing_department FROM public.%I WHERE escalation_due_at<=now() AND routing_rule_id IS NOT NULL AND status::text NOT IN (''resolved'',''completed'',''cancelled'') AND ($1 IS NULL OR organization_id=$1) ORDER BY escalation_due_at LIMIT 50 FOR UPDATE SKIP LOCKED',t) USING p_org LOOP
   SELECT * INTO rule FROM public.role_mappings WHERE id=item.routing_rule_id AND is_active AND organization_id=item.organization_id;
   IF NOT FOUND THEN EXECUTE format('UPDATE public.%I SET escalation_due_at=NULL WHERE id=$1',t) USING item.id;CONTINUE;END IF;
   IF rule.escalate_until='acknowledged' AND (CASE WHEN t='feedback' THEN to_jsonb(item)->>'first_response_at' ELSE to_jsonb(item)->>'acknowledged_at' END) IS NOT NULL THEN EXECUTE format('UPDATE public.%I SET escalation_due_at=NULL WHERE id=$1',t) USING item.id;CONTINUE;END IF;
   mod:=CASE WHEN t='feedback' THEN 'feedback' ELSE 'hospitality' END;dept:=item.routing_department;level_found:=NULL;
   FOR level_next IN item.escalation_level+1..2 LOOP
    candidate:=CASE WHEN level_next=1 THEN rule.senior_assignee_id ELSE rule.gm_assignee_id END;
    IF candidate IS NOT NULL AND public.role_member_eligible(candidate,item.organization_id,item.property_id,mod,dept) THEN level_found:=level_next;EXIT;END IF;
   END LOOP;
   IF level_found IS NULL THEN EXECUTE format('UPDATE public.%I SET escalation_due_at=$2 WHERE id=$1',t) USING item.id,CASE WHEN item.escalation_level=2 OR rule.gm_assignee_id IS NULL AND (item.escalation_level>=1 OR rule.senior_assignee_id IS NULL) THEN NULL ELSE now()+interval '5 minutes' END;CONTINUE;END IF;
   IF t='feedback' THEN
    UPDATE public.feedback SET assigned_user_id=candidate,assigned_to=(SELECT full_name FROM public.profiles WHERE id=candidate),escalation_level=level_found,status='escalated',escalation_due_at=CASE WHEN level_found=2 OR rule.gm_assignee_id IS NULL THEN NULL ELSE now()+make_interval(mins=>rule.senior_response_minutes) END WHERE id=item.id;
   ELSE
    UPDATE public.service_jobs SET assigned_to=candidate,escalation_level=level_found,escalated_at=now(),escalation_due_at=CASE WHEN level_found=2 OR rule.gm_assignee_id IS NULL THEN NULL ELSE now()+make_interval(mins=>rule.senior_response_minutes) END WHERE id=item.id;
   END IF;
   changed:=changed+1;
  END LOOP;
 END LOOP;
 RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.advance_role_escalations(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_role_escalations(uuid) TO service_role;
COMMIT;
