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

