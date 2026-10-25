import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "../../../lib/auth/serverAuth";
import { sanitizeString } from "../../../lib/security/sanitize";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export interface FeedbackQuestion {
  id: string;
  property_id?: string | null;
  question_text: string;
  question_type: "choice" | "rating" | "yes_no" | "text" | "nps" | "csat" | "long_text" | string;
  options?: string[];
  department?: string | null;
  translations?: Record<string, { questionText?: string; options?: string[] }>;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

// In-memory fallback questions store in case the table is being created/migrated
let fallbackQuestionsStore: FeedbackQuestion[] = [
  {
    id: "b0000001-0000-0000-0000-000000000001",
    property_id: null,
    question_text: "How smooth was your check-in and arrival experience?",
    question_type: "choice",
    options: ["Seamless & prompt", "Standard / acceptable", "Delayed or congested"],
    is_required: true,
    display_order: 1,
    is_active: true,
  },
  {
    id: "b0000002-0000-0000-0000-000000000002",
    property_id: null,
    question_text: "How satisfied were you with room cleanliness and ambiance?",
    question_type: "rating",
    options: [],
    is_required: true,
    display_order: 2,
    is_active: true,
  },
  {
    id: "b0000003-0000-0000-0000-000000000003",
    property_id: null,
    question_text: "Would you recommend Vistora to friends or colleagues?",
    question_type: "choice",
    options: ["Definitely", "Likely", "Unlikely"],
    is_required: false,
    display_order: 3,
    is_active: true,
  },
  {
    id: "b0000004-0000-0000-0000-000000000004",
    property_id: null,
    question_text: "Did our team promptly assist you with all requests?",
    question_type: "yes_no",
    options: ["Yes, absolutely", "Could be faster", "No, unattended"],
    is_required: false,
    display_order: 4,
    is_active: true,
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("all") === "true";
    const propertyId = searchParams.get("propertyId");

    const supabase = getAdminClient();
    let query = supabase.from("feedback_questions").select("*").order("display_order", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    if (propertyId) {
      query = query.or(`property_id.is.null,property_id.eq.${propertyId}`);
    }

    const { data, error } = await query;

    if (error) {
      // Table doesn't exist yet in Supabase schema cache
      if (error.code === "PGRST205") {
        let list = [...fallbackQuestionsStore];
        if (!includeInactive) {
          list = list.filter((q) => q.is_active);
        }
        return NextResponse.json({
          success: true,
          questions: list,
          notice: "Using active questionnaire items.",
        });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      questions: data || [],
      synced: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || (user.role !== "admin" && !user.rights?.includes("manage_questionnaire"))) {
      return NextResponse.json(
        { success: false, error: "Access denied. Questionnaire management privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { questionText, questionType = "choice", options = [], propertyId, isRequired = false, department, translations } = body;

    if (!questionText || !questionText.trim()) {
      return NextResponse.json({ success: false, error: "Question text is required." }, { status: 400 });
    }

    const cleanText = sanitizeString(questionText, 300);
    const cleanOptions = Array.isArray(options) ? options.map((o) => sanitizeString(o, 100)).filter(Boolean) : [];

    const newQuestion: FeedbackQuestion = {
      id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      property_id: propertyId || null,
      question_text: cleanText,
      question_type: questionType,
      options: cleanOptions,
      department: department || null,
      translations: translations || {},
      is_required: Boolean(isRequired),
      display_order: fallbackQuestionsStore.length + 1,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Attempt to persist to Supabase
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from("feedback_questions")
        .insert({
          question_text: cleanText,
          question_type: questionType,
          options: cleanOptions,
          property_id: propertyId || null,
          is_required: Boolean(isRequired),
          department: department || null,
          display_order: fallbackQuestionsStore.length + 1,
          is_active: true,
        })
        .select()
        .single();

      if (!error && data) {
        newQuestion.id = data.id;
        fallbackQuestionsStore.push(data);
        return NextResponse.json({ success: true, question: data, synced: true }, { status: 201 });
      }
    } catch {}

    // Fallback store
    fallbackQuestionsStore.push(newQuestion);
    return NextResponse.json({ success: true, question: newQuestion, synced: false }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create question" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || (user.role !== "admin" && !user.rights?.includes("manage_questionnaire"))) {
      return NextResponse.json(
        { success: false, error: "Access denied. Questionnaire management privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, isActive, questionText, isRequired } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Question ID is required." }, { status: 400 });
    }

    // Try Supabase first
    try {
      const supabase = getAdminClient();
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (isActive !== undefined) updates.is_active = Boolean(isActive);
      if (questionText !== undefined) updates.question_text = sanitizeString(questionText, 300);
      if (isRequired !== undefined) updates.is_required = Boolean(isRequired);

      const { data, error } = await supabase
        .from("feedback_questions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (!error && data) {
        return NextResponse.json({ success: true, question: data, synced: true });
      }
    } catch {}

    // Update in fallback store
    const item = fallbackQuestionsStore.find((q) => q.id === id);
    if (item) {
      if (isActive !== undefined) item.is_active = Boolean(isActive);
      if (questionText !== undefined) item.question_text = sanitizeString(questionText, 300);
      if (isRequired !== undefined) item.is_required = Boolean(isRequired);
      return NextResponse.json({ success: true, question: item, synced: false });
    }

    return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update question" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || (user.role !== "admin" && !user.rights?.includes("manage_questionnaire"))) {
      return NextResponse.json(
        { success: false, error: "Access denied. Questionnaire management privileges required." },
        { status: 403 }
      );
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "Question ID is required." }, { status: 400 });
    }

    try {
      const supabase = getAdminClient();
      await supabase.from("feedback_questions").delete().eq("id", id);
    } catch {}

    fallbackQuestionsStore = fallbackQuestionsStore.filter((q) => q.id !== id);
    return NextResponse.json({ success: true, message: "Question removed." });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete question" },
      { status: 500 }
    );
  }
}
