import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SALT = "vistora_secret_salt";

function hashPassword(password: string): string {
  return "pwd:" + crypto.createHash("sha256").update(password + SALT).digest("hex");
}

export async function GET() {
  try {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const userList: any[] = [];

    // 1. Fetch from profiles table
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (profiles) {
      userList.push(...profiles);
    }

    // 2. Fetch created team members from guests table
    const { data: guestUsers } = await adminClient
      .from("guests")
      .select("id, email, full_name, vip_tier, created_at")
      .order("created_at", { ascending: false });

    if (guestUsers) {
      for (const g of guestUsers) {
        if (!userList.some((u) => u.email?.toLowerCase() === g.email?.toLowerCase())) {
          let role = "visitor";
          if (g.vip_tier?.startsWith("role:")) {
            role = g.vip_tier.replace("role:", "");
          } else if (g.vip_tier === "Ambassador" || g.vip_tier === "VIP Gold") {
            role = "staff";
          }
          userList.push({
            id: g.id,
            email: g.email,
            full_name: g.full_name,
            role,
            created_at: g.created_at,
          });
        }
      }
    }

    return NextResponse.json({ success: true, users: userList });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, fullName, role = "staff", password } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: "Email is required." }, { status: 400 });
    }

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ success: false, error: "Full name is required." }, { status: 400 });
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!["admin", "staff", "visitor"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "Role must be 'admin', 'staff', or 'visitor'." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const passwordHash = hashPassword(password.trim());

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Check if user already exists
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();

    const { data: existingGuest } = await adminClient
      .from("guests")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingProfile || existingGuest) {
      return NextResponse.json(
        { success: false, error: "A user with this email already exists." },
        { status: 400 }
      );
    }

    let createdUser: any = null;

    // First attempt insert into profiles
    const newUserId = crypto.randomUUID();
    const { data: profileInsert, error: profileError } = await adminClient
      .from("profiles")
      .insert({
        id: newUserId,
        email: cleanEmail,
        full_name: cleanName,
        role,
        avatar_url: passwordHash,
      })
      .select("id, email, full_name, role, created_at")
      .maybeSingle();

    if (!profileError && profileInsert) {
      createdUser = profileInsert;
    } else {
      // If foreign key constraint is present on profiles, store member securely in guests table
      const { data: guestInsert, error: guestError } = await adminClient
        .from("guests")
        .insert({
          id: newUserId,
          full_name: cleanName,
          email: cleanEmail,
          phone: passwordHash,
          vip_tier: `role:${role}`,
          total_stays: 1,
        })
        .select("id, email, full_name, vip_tier, created_at")
        .single();

      if (guestError) {
        return NextResponse.json({ success: false, error: guestError.message }, { status: 500 });
      }

      createdUser = {
        id: guestInsert.id,
        email: guestInsert.email,
        full_name: guestInsert.full_name,
        role,
        created_at: guestInsert.created_at,
      };
    }

    return NextResponse.json({ success: true, user: createdUser });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
