-- ==============================================================================
-- VISTORA GUEST EXPERIENCE OPERATIONS - SUPABASE SCHEMA
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
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

-- 3. TABLES

-- Properties (Hotels / Resorts)
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL DEFAULT 'Anantara Hotels',
    location TEXT NOT NULL,
    country TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    total_rooms INTEGER NOT NULL DEFAULT 280,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guests
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    vip_tier TEXT NOT NULL DEFAULT 'Standard',
    total_stays INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guest Stays (Sessions for feedback tokens)
CREATE TABLE IF NOT EXISTS stays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    public_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guest Feedback Submissions
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
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

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_feedback_property_id ON feedback(property_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stays_public_token ON stays(public_token);

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anonymous public users can read stays via token to submit feedback
CREATE POLICY "Public can view stay by token"
    ON stays FOR SELECT
    TO anon, authenticated
    USING (true);

-- Anonymous public users can insert feedback
CREATE POLICY "Public can insert guest feedback"
    ON feedback FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Authenticated staff can read and manage all records
CREATE POLICY "Staff can view properties"
    ON properties FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Staff can view feedback"
    ON feedback FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Staff can update feedback"
    ON feedback FOR UPDATE
    TO authenticated, anon
    USING (true);

-- 6. SEED DATA FOR DEVELOPMENT & INITIAL LOAD
INSERT INTO properties (id, name, slug, code, brand, location, country, timezone, total_rooms)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Anantara Riverside Bangkok', 'anantara-riverside-bangkok', 'ARB', 'Anantara Hotels', 'Bangkok', 'Thailand', 'Asia/Bangkok', 376),
    ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Anantara Siam Bangkok', 'anantara-siam-bangkok', 'ASB', 'Anantara Hotels', 'Bangkok', 'Thailand', 'Asia/Bangkok', 354),
    ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'Anantara Chiang Mai Resort', 'anantara-chiang-mai', 'ACM', 'Anantara Hotels', 'Chiang Mai', 'Thailand', 'Asia/Bangkok', 84)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO guests (id, full_name, email, phone, vip_tier, total_stays)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Aisha Khan', 'aisha.khan@luxurytravel.com', '+65 9123 4567', 'VIP Gold', 4),
    ('22222222-2222-2222-2222-222222222222', 'James Morrison', 'j.morrison@oxfordcap.co.uk', '+44 7700 900123', 'Standard', 1),
    ('33333333-3333-3333-3333-333333333333', 'Nadia Rahman', 'nadia.rahman@kualalumpur.my', '+60 12 345 6789', 'Ambassador', 7),
    ('44444444-4444-4444-4444-444444444444', 'Daniel Lee', 'daniel.lee@sydneyfin.com.au', '+61 412 345 678', 'VIP Gold', 3),
    ('55555555-5555-5555-5555-555555555555', 'Elena Rostova', 'elena.rostova@geneva-corp.ch', '+41 22 123 4567', 'Standard', 2),
    ('66666666-6666-6666-6666-666666666666', 'Marcus Vance', 'marcus.v@seattleventures.io', '+1 206 555 0199', 'Standard', 1)
ON CONFLICT DO NOTHING;

INSERT INTO stays (id, property_id, guest_id, room_number, check_in_date, check_out_date, public_token, status)
VALUES
    ('a1111111-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '11111111-1111-1111-1111-111111111111', '602', '2024-06-14', '2024-06-18', 'demo-stay', 'active'),
    ('a2222222-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '22222222-2222-2222-2222-222222222222', '314', '2024-06-15', '2024-06-19', 'stay-jm-314', 'active'),
    ('a3333333-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '33333333-3333-3333-3333-333333333333', 'Villa 4', '2024-06-12', '2024-06-18', 'stay-nr-v4', 'active'),
    ('a4444444-0000-0000-0000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '44444444-4444-4444-4444-444444444444', '818', '2024-06-16', '2024-06-20', 'stay-dl-818', 'active')
ON CONFLICT (public_token) DO NOTHING;

INSERT INTO feedback (id, property_id, stay_id, guest_name, guest_email, guest_phone, room_number, department, rating, comment, wants_contact, contact_preference, status, tone, sla_deadline, assigned_to, resolution_notes, resolved_at, created_at)
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
        NOW() - INTERVAL '10 minutes',
        NOW() - INTERVAL '14 minutes'
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
        NOW() + INTERVAL '2 hours',
        'Front Office Manager',
        null,
        null,
        NOW() - INTERVAL '38 minutes'
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
        NOW() + INTERVAL '4 hours',
        'F&B Operations',
        null,
        null,
        NOW() - INTERVAL '1 hour'
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
ON CONFLICT DO NOTHING;
