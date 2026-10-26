"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Check,
  X,
  Star,
  ToggleLeft,
  ToggleRight,
  Globe,
  QrCode,
  Gauge,
  MessageSquare,
  Sliders,
  CheckCircle2,
  Smile,
  ListCheck,
  Layers,
  ChevronDown,
  HelpCircle,
  FileSpreadsheet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "./CustomSelect";
import { ConfirmDrawer } from "./ConfirmDrawer";
import { TableLoadingRows } from "./TableLoadingRows";

export interface QuestionData {
  id: string;
  property_id?: string | null;
  question_text: string;
  question_type:
    | "choice"
    | "multi_choice"
    | "rating"
    | "yes_no"
    | "text"
    | "nps"
    | "csat"
    | "emoji"
    | "touchpoint"
    | "dropdown"
    | "long_text"
    | string;
  options?: string[];
  translations?: Record<string, { questionText?: string; options?: string[] }>;
  is_required: boolean;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export const FORM_LANGUAGES = [
  { code: "en", name: "English", tag: "EN", native: "English" },
  { code: "th", name: "Thai", tag: "TH", native: "ภาษาไทย" },
  { code: "ja", name: "Japanese", tag: "JA", native: "日本語" },
  { code: "fr", name: "French", tag: "FR", native: "Français" },
  { code: "es", name: "Spanish", tag: "ES", native: "Español" },
  { code: "de", name: "German", tag: "DE", native: "Deutsch" },
  { code: "ar", name: "Arabic", tag: "AR", native: "العربية" },
  { code: "zh", name: "Mandarin", tag: "ZH", native: "中文" },
];

export const COMPONENT_TYPES = [
  { value: "choice", label: "Multiple Choice Pills", detail: "Single-select guest selection pills" },
  { value: "multi_choice", label: "Multi-Select Checkboxes / Pills", detail: "Allow guests to pick multiple options" },
  { value: "rating", label: "1–5 Star Luxury Rating", detail: "Weighted numerical star rating score" },
  { value: "nps", label: "NPS Scale (0–10)", detail: "Industry-standard Net Promoter Score metric" },
  { value: "csat", label: "CSAT Score (1–10)", detail: "Comprehensive satisfaction spectrum metric" },
  { value: "emoji", label: "5-Point Sentiment (Emoji)", detail: "Visual guest emotion spectrum (Terrible to Superb)" },
  { value: "yes_no", label: "Yes / No Binary Toggle", detail: "Quick two-state confirmation" },
  { value: "dropdown", label: "Dropdown Option Menu", detail: "Compact single-select dropdown menu" },
  { value: "touchpoint", label: "Service Touchpoint Checklist", detail: "Select visited touchpoints (Valet, Dining, Spa)" },
  { value: "text", label: "Single-line Comment", detail: "Short written feedback box" },
  { value: "long_text", label: "Detailed Story & Testimonial", detail: "Multi-line freeform storytelling textarea" },
];

// Curated Hospitalty Questionnaire Templates for 1-Click Provisioning
export const QUESTIONNAIRE_TEMPLATES = [
  {
    id: "post_stay",
    title: "Comprehensive Post-Stay Review",
    description: "Holistic departure questionnaire measuring NPS, room comfort, hospitality attentiveness, and guest stories.",
    badge: "Recommended",
    questions: [
      {
        questionText: "How likely are you to recommend our resort to friends or colleagues?",
        questionType: "nps",
        options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        isRequired: true,
      },
      {
        questionText: "How satisfied were you with your overall room cleanliness, comfort, and ambiance?",
        questionType: "rating",
        options: [],
        isRequired: true,
      },
      {
        questionText: "How was your arrival and check-in experience?",
        questionType: "choice",
        options: ["Seamless & prompt", "Standard / acceptable", "Delayed or congested"],
        isRequired: true,
      },
      {
        questionText: "Which hotel amenities and services did you experience during your stay?",
        questionType: "touchpoint",
        options: ["Front Desk", "In-Room Dining", "Spa & Wellness", "Infinity Pool", "Concierge Desk", "Valet"],
        isRequired: false,
      },
      {
        questionText: "Did our team promptly assist you with all requests throughout your visit?",
        questionType: "yes_no",
        options: ["Yes", "No"],
        isRequired: false,
      },
      {
        questionText: "Please share any memorable moments, suggestions, or staff members who made a difference:",
        questionType: "long_text",
        options: [],
        isRequired: false,
      },
    ],
  },
  {
    id: "fnb_dining",
    title: "Food & Beverage Dining Experience",
    description: "Designed for tableside QR codes in dining rooms, lounges, and terrace restaurants.",
    badge: "F&B Operations",
    questions: [
      {
        questionText: "How would you rate the culinary quality and presentation of your meal?",
        questionType: "rating",
        options: [],
        isRequired: true,
      },
      {
        questionText: "How satisfied were you with table service speed and staff attentiveness?",
        questionType: "emoji",
        options: ["Terrible", "Poor", "Average", "Good", "Superb"],
        isRequired: true,
      },
      {
        questionText: "Which dining venue or service did you enjoy today?",
        questionType: "dropdown",
        options: ["Riverside Terrace", "Skyline Lounge", "Botanical Garden Bistro", "In-Room Dining", "Poolside Bar"],
        isRequired: false,
      },
      {
        questionText: "Would you recommend our culinary venues to friends?",
        questionType: "yes_no",
        options: ["Yes", "No"],
        isRequired: false,
      },
      {
        questionText: "Any dietary feedback or compliments for the culinary team:",
        questionType: "text",
        options: [],
        isRequired: false,
      },
    ],
  },
  {
    id: "spa_wellness",
    title: "Spa & Wellness Recovery Survey",
    description: "Post-treatment feedback measuring therapist skill, atmosphere, and rebooking intent.",
    badge: "Spa & Wellness",
    questions: [
      {
        questionText: "How satisfied were you with your treatment technique and therapist care?",
        questionType: "rating",
        options: [],
        isRequired: true,
      },
      {
        questionText: "How would you rate the serene atmosphere, aroma, and treatment room comfort?",
        questionType: "csat",
        options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        isRequired: true,
      },
      {
        questionText: "Would you book another treatment with our wellness team in the future?",
        questionType: "yes_no",
        options: ["Yes", "No"],
        isRequired: false,
      },
      {
        questionText: "Additional suggestions or notes for our spa director:",
        questionType: "text",
        options: [],
        isRequired: false,
      },
    ],
  },
  {
    id: "arrival_valet",
    title: "Arrival & Check-In Experience",
    description: "Measures first impression metrics, luggage handling promptness, and room readiness.",
    badge: "First Impression",
    questions: [
      {
        questionText: "How prompt was your valet greeting and luggage assistance upon arrival?",
        questionType: "choice",
        options: ["Immediate & courteous", "Adequate", "Waited over 10 minutes"],
        isRequired: true,
      },
      {
        questionText: "Was your room ready upon your arrival?",
        questionType: "yes_no",
        options: ["Yes, immediately", "Brief wait required", "No, delayed"],
        isRequired: true,
      },
      {
        questionText: "Front desk staff warmth and check-in clarity:",
        questionType: "rating",
        options: [],
        isRequired: true,
      },
      {
        questionText: "Any comments regarding your arrival journey:",
        questionType: "text",
        options: [],
        isRequired: false,
      },
    ],
  },
];

export default function QuestionnaireBuilder() {
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; text: string } | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  // Modal / Add Question states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [modalTab, setModalTab] = useState<"basics" | "translations">("basics");
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<string>("choice");
  const [optionsStr, setOptionsStr] = useState("Seamless & prompt, Standard / acceptable, Delayed");
  const [isRequired, setIsRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Translations draft state
  const [activeTranslationLang, setActiveTranslationLang] = useState<string>("th");
  const [translationText, setTranslationText] = useState("");
  const [translationOptionsStr, setTranslationOptionsStr] = useState("");
  const [translationsMap, setTranslationsMap] = useState<
    Record<string, { questionText?: string; options?: string[] }>
  >({});

  async function loadQuestions() {
    setLoading(true);
    try {
      const res = await fetch("/api/questions?all=true", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.questions) {
        setQuestions(data.questions);
      }
    } catch {
      setError("Failed to load questionnaire questions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, []);

  function handleSaveCurrentTranslationDraft() {
    if (!translationText.trim() && !translationOptionsStr.trim()) return;

    const optArr = translationOptionsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setTranslationsMap((prev) => ({
      ...prev,
      [activeTranslationLang]: {
        questionText: translationText.trim() || undefined,
        options: optArr.length > 0 ? optArr : undefined,
      },
    }));
  }

  function handleSwitchTranslationLang(langCode: string) {
    handleSaveCurrentTranslationDraft();
    setActiveTranslationLang(langCode);
    const existing = translationsMap[langCode];
    if (existing) {
      setTranslationText(existing.questionText || "");
      setTranslationOptionsStr((existing.options || []).join(", "));
    } else {
      setTranslationText("");
      setTranslationOptionsStr("");
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!questionText.trim()) return;

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    // Save active draft
    const finalTranslations = { ...translationsMap };
    if (translationText.trim() || translationOptionsStr.trim()) {
      const optArr = translationOptionsStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      finalTranslations[activeTranslationLang] = {
        questionText: translationText.trim() || undefined,
        options: optArr.length > 0 ? optArr : undefined,
      };
    }

    try {
      let options: string[] = [];
      if (
        questionType === "choice" ||
        questionType === "multi_choice" ||
        questionType === "dropdown" ||
        questionType === "touchpoint"
      ) {
        options = optionsStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (options.length === 0) {
          options = ["Option 1", "Option 2", "Option 3"];
        }
      } else if (questionType === "yes_no") {
        options = optionsStr.trim()
          ? optionsStr.split(",").map((s) => s.trim()).filter(Boolean)
          : ["Yes", "No"];
      } else if (questionType === "nps") {
        options = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
      } else if (questionType === "csat") {
        options = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
      } else if (questionType === "emoji") {
        options = ["Terrible", "Poor", "Average", "Good", "Superb"];
      } else if (questionType === "rating") {
        options = ["1", "2", "3", "4", "5"];
      }

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: questionText.trim(),
          questionType,
          options,
          translations: finalTranslations,
          isRequired,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add question.");
      }

      setSuccess(`Question "${questionText.trim()}" added successfully.`);
      setShowAddModal(false);
      setQuestionText("");
      setOptionsStr("Seamless & prompt, Standard / acceptable, Delayed");
      setIsRequired(false);
      setTranslationsMap({});
      setTranslationText("");
      setTranslationOptionsStr("");
      setModalTab("basics");
      await loadQuestions();
    } catch (err: any) {
      setError(err.message || "Failed to add question.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyTemplate(template: (typeof QUESTIONNAIRE_TEMPLATES)[0]) {
    setApplyingTemplate(true);
    setError(null);
    setSuccess(null);

    try {
      let addedCount = 0;
      for (const q of template.questions) {
        const res = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options,
            isRequired: q.isRequired,
          }),
        });
        const data = await res.json();
        if (data.success) {
          addedCount++;
        }
      }

      setSuccess(`Template "${template.title}" applied! ${addedCount} questions added to your live questionnaire.`);
      setShowTemplatesModal(false);
      await loadQuestions();
    } catch (err: any) {
      setError(err.message || "Failed to apply questionnaire template.");
    } finally {
      setApplyingTemplate(false);
    }
  }

  async function handleToggleActive(question: QuestionData) {
    try {
      const newActive = !question.is_active;
      const res = await fetch("/api/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: question.id,
          isActive: newActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === question.id ? { ...q, is_active: newActive } : q))
        );
      }
    } catch {
      setError("Failed to toggle question status.");
    }
  }

  async function handleDeleteQuestion() {
    if (!pendingDelete) return;
    setDeletingQuestion(true);
    try {
      const res = await fetch("/api/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingDelete.id }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Question removed.");
        setPendingDelete(null);
        await loadQuestions();
      } else {
        setError("Failed to delete question.");
      }
    } catch {
      setError("Failed to delete question.");
    } finally {
      setDeletingQuestion(false);
    }
  }

  return (
    <div>
      {/* SYNC & QR BANNER */}
      <div
        className="panel"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          background: "var(--canvas-alt)",
          border: "1px solid var(--line-strong)",
          borderRadius: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: "var(--sage-soft)",
              color: "var(--sage-deep)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <QrCode size={18} strokeWidth={2} />
          </div>
          <div>
            <strong style={{ fontSize: "13px", color: "var(--ink)", display: "block" }}>
              Live Synchronization with Public Guest Forms & QR Studio
            </strong>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted)", lineHeight: "1.4" }}>
              All questionnaire items (NPS, 5-Star, Choice pills, Emojis, Stories) configured here immediately appear when guests scan their in-room or dining QR codes.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <a
            href="/dashboard/operations"
            className="button button-outline compact"
            style={{ fontSize: "11px", whiteSpace: "nowrap" }}
          >
            Open QR Studio →
          </a>
        </div>
      </div>

      {/* TOP ACTION BAR: ADD COMPONENT & QUESTIONNAIRE TEMPLATES */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--font-dm-mono)" }}>
            Active questions: <strong>{questions.filter((q) => q.is_active).length}</strong> of {questions.length}
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="button button-outline compact"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setShowTemplatesModal(true);
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <FileSpreadsheet size={13} strokeWidth={1.8} />
            Questionnaire Templates
          </button>

          <button
            type="button"
            className="button button-dark compact"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setShowAddModal(true);
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={14} strokeWidth={2} />
            Add custom component
          </button>
        </div>
      </div>

      {error && (
        <div
          className="panel"
          style={{
            padding: "12px 18px",
            marginBottom: "16px",
            background: "var(--red-soft)",
            color: "var(--red)",
            border: "1px solid var(--red)",
            fontSize: "12px",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="panel"
          style={{
            padding: "12px 18px",
            marginBottom: "16px",
            background: "var(--sage-soft)",
            color: "var(--sage)",
            border: "1px solid var(--sage)",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Check size={14} strokeWidth={2} />
          {success}
        </div>
      )}

      {/* QUESTIONS TABLE */}
      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th>Question Prompt</th>
                <th>Component Format</th>
                <th>Options & Scale</th>
                <th>Translations</th>
                <th>Required</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingRows columns={8} />
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                    <p style={{ margin: "0 0 10px" }}>No questionnaire questions created yet.</p>
                    <button
                      type="button"
                      className="button button-dark compact"
                      onClick={() => setShowTemplatesModal(true)}
                    >
                      Apply a questionnaire template
                    </button>
                  </td>
                </tr>
              ) : (
                questions.map((q, idx) => {
                  const typeMeta = COMPONENT_TYPES.find((c) => c.value === q.question_type) || {
                    label: q.question_type,
                    detail: "Custom component",
                  };

                  const translationCount = q.translations ? Object.keys(q.translations).length : 0;

                  return (
                    <tr key={q.id}>
                      <td style={{ color: "var(--muted)", fontSize: "11px", fontFamily: "var(--font-dm-mono)" }}>
                        {idx + 1}
                      </td>
                      <td>
                        <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{q.question_text}</strong>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: "var(--font-dm-mono)",
                            fontSize: "10px",
                            padding: "3px 8px",
                            background:
                              q.question_type === "nps" || q.question_type === "csat"
                                ? "rgba(56, 189, 248, 0.16)"
                                : q.question_type === "rating"
                                ? "rgba(245, 158, 11, 0.16)"
                                : q.question_type === "emoji"
                                ? "rgba(16, 185, 129, 0.16)"
                                : "var(--line)",
                            color:
                              q.question_type === "nps" || q.question_type === "csat"
                                ? "var(--blue)"
                                : q.question_type === "rating"
                                ? "var(--warm)"
                                : q.question_type === "emoji"
                                ? "var(--sage)"
                                : "var(--ink)",
                            borderRadius: "4px",
                            fontWeight: 500,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {q.question_type === "rating" && <Star size={10} />}
                          {q.question_type === "nps" && <Gauge size={10} />}
                          {q.question_type === "emoji" && <Smile size={10} />}
                          {q.question_type === "touchpoint" && <ListCheck size={10} />}
                          {q.question_type === "long_text" && <MessageSquare size={10} />}
                          {typeMeta.label}
                        </span>
                      </td>
                      <td>
                        {q.question_type === "choice" ||
                        q.question_type === "multi_choice" ||
                        q.question_type === "yes_no" ||
                        q.question_type === "dropdown" ||
                        q.question_type === "touchpoint" ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {q.options && q.options.length > 0 ? (
                              q.options.map((opt) => (
                                <span
                                  key={opt}
                                  style={{
                                    fontSize: "10px",
                                    padding: "2px 8px",
                                    borderRadius: "6px",
                                    background: "var(--canvas-alt)",
                                    color: "var(--ink)",
                                    border: "1px solid var(--line-strong)",
                                  }}
                                >
                                  {opt}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: "11px" }}>Standard choices</span>
                            )}
                          </div>
                        ) : q.question_type === "rating" ? (
                          <span
                            style={{
                              color: "var(--warm)",
                              fontSize: "11px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Star size={11} fill="currentColor" stroke="currentColor" /> 1 to 5 Stars
                          </span>
                        ) : q.question_type === "nps" ? (
                          <span style={{ color: "var(--blue)", fontSize: "11px", fontWeight: 500 }}>
                            0 to 10 Scale (Detractors 0-6 / Passives 7-8 / Promoters 9-10)
                          </span>
                        ) : q.question_type === "csat" ? (
                          <span style={{ color: "var(--blue)", fontSize: "11px", fontWeight: 500 }}>
                            1 to 10 Satisfaction Spectrum
                          </span>
                        ) : q.question_type === "emoji" ? (
                          <span style={{ color: "var(--sage)", fontSize: "11px", fontWeight: 500 }}>
                            5-Point Emotion (Terrible to Superb)
                          </span>
                        ) : q.question_type === "long_text" ? (
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>Multi-line guest textarea</span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>Single-line text comment</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "9px",
                              padding: "2px 5px",
                              borderRadius: "3px",
                              background: "var(--canvas-alt)",
                              color: "var(--ink)",
                              border: "1px solid var(--line-strong)",
                              fontWeight: 600,
                            }}
                            title="English (Default)"
                          >
                            EN
                          </span>
                          {q.translations &&
                            Object.keys(q.translations).map((lang) => {
                              const meta = FORM_LANGUAGES.find((l) => l.code === lang);
                              return (
                                <span
                                  key={lang}
                                  style={{
                                    fontSize: "9px",
                                    fontFamily: "var(--font-dm-mono)",
                                    padding: "2px 5px",
                                    borderRadius: "3px",
                                    background: "var(--sage-soft)",
                                    color: "var(--sage)",
                                    fontWeight: 600,
                                  }}
                                  title={`${meta?.name || lang} Translation Active`}
                                >
                                  {meta?.tag || lang.toUpperCase()}
                                </span>
                              );
                            })}
                          {translationCount === 0 && (
                            <span style={{ fontSize: "10px", color: "var(--muted)" }}>EN only</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "11px",
                            color: q.is_required ? "var(--red)" : "var(--muted)",
                            fontWeight: q.is_required ? 600 : 400,
                          }}
                        >
                          {q.is_required ? "Yes (Mandatory)" : "Optional"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(q)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "11px",
                            color: q.is_active ? "var(--sage)" : "var(--muted)",
                          }}
                          title={q.is_active ? "Click to deactivate" : "Click to activate"}
                        >
                          {q.is_active ? (
                            <>
                              <ToggleRight size={18} strokeWidth={2} style={{ color: "var(--sage)" }} />
                              Active
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={18} strokeWidth={1.5} style={{ color: "var(--muted)" }} />
                              Disabled
                            </>
                          )}
                        </button>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ id: q.id, text: q.question_text })}
                          className="button compact"
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            background: "transparent",
                            color: "var(--muted)",
                            border: "1px solid var(--line)",
                          }}
                          title="Delete question"
                        >
                          <Trash2 size={12} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD CUSTOM COMPONENT */}
      <AnimatePresence>
        {showAddModal && (
          <div className="modal-backdrop-luxury">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="modal-dialog-luxury"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line-strong)",
                boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
                color: "var(--ink)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <p className="eyebrow" style={{ color: "var(--sage)" }}>Form Builder & Touchpoint Studio</p>
                  <h2 style={{ fontSize: "18px", margin: "2px 0 0", color: "var(--ink)" }}>Add custom component</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* TABS: BASICS / TRANSLATIONS */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--line)",
                  marginBottom: "18px",
                  gap: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalTab("basics")}
                  style={{
                    border: "none",
                    background: "none",
                    padding: "8px 4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: modalTab === "basics" ? 600 : 400,
                    color: modalTab === "basics" ? "var(--sage)" : "var(--muted)",
                    borderBottom: modalTab === "basics" ? "2px solid var(--sage)" : "2px solid transparent",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Sliders size={13} />
                  Question & Component Format
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("translations")}
                  style={{
                    border: "none",
                    background: "none",
                    padding: "8px 4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: modalTab === "translations" ? 600 : 400,
                    color: modalTab === "translations" ? "var(--sage)" : "var(--muted)",
                    borderBottom: modalTab === "translations" ? "2px solid var(--sage)" : "2px solid transparent",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Globe size={13} />
                  Multilingual Translations
                  {Object.keys(translationsMap).length > 0 && (
                    <span
                      style={{
                        background: "var(--sage-soft)",
                        color: "var(--sage-deep)",
                        borderRadius: "6px",
                        fontSize: "9px",
                        padding: "1px 6px",
                      }}
                    >
                      {Object.keys(translationsMap).length}
                    </span>
                  )}
                </button>
              </div>

              <form onSubmit={handleAddQuestion}>
                {modalTab === "basics" ? (
                  <>
                    <div style={{ marginBottom: "14px" }}>
                      <label className="field-label" htmlFor="q-text" style={{ color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Primary Question Text *
                      </label>
                      <input
                        id="q-text"
                        type="text"
                        required
                        placeholder="e.g. How likely are you to recommend our resort to friends?"
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid var(--line-strong)",
                          borderRadius: "6px",
                          fontSize: "13px",
                          outline: "none",
                          background: "var(--canvas-alt)",
                          color: "var(--ink)",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                      <label className="field-label" htmlFor="q-type" style={{ display: "block", marginBottom: "6px", color: "var(--ink)" }}>
                        Component Type & Response Format
                      </label>
                      <CustomSelect
                        id="q-type"
                        value={questionType}
                        onChange={(val) => {
                          const t = val as string;
                          setQuestionType(t);
                          if (t === "yes_no") {
                            setOptionsStr("Yes, No");
                          } else if (t === "choice" || t === "dropdown") {
                            setOptionsStr("Seamless & prompt, Standard / acceptable, Delayed");
                          } else if (t === "multi_choice") {
                            setOptionsStr("Infinity Pool, Signature Dining, Spa, Fitness Center");
                          } else if (t === "touchpoint") {
                            setOptionsStr("Valet, Front Desk, Housekeeping, Dining, Spa, Concierge");
                          }
                        }}
                        header="Select Component Format"
                        options={COMPONENT_TYPES}
                      />
                    </div>

                    {(questionType === "choice" ||
                      questionType === "multi_choice" ||
                      questionType === "yes_no" ||
                      questionType === "dropdown" ||
                      questionType === "touchpoint") && (
                      <div style={{ marginBottom: "14px" }}>
                        <label className="field-label" htmlFor="q-options" style={{ color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                          Answer Options (comma-separated)
                        </label>
                        <input
                          id="q-options"
                          type="text"
                          placeholder="e.g. Option 1, Option 2, Option 3"
                          value={optionsStr}
                          onChange={(e) => setOptionsStr(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid var(--line-strong)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            outline: "none",
                            background: "var(--canvas-alt)",
                            color: "var(--ink)",
                          }}
                        />
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0 0" }}>
                          Separate multiple choices with commas. Guests tap or select these options on mobile.
                        </p>
                      </div>
                    )}

                    {questionType === "nps" && (
                      <div
                        style={{
                          padding: "12px 14px",
                          background: "var(--blue-soft)",
                          border: "1px solid var(--blue)",
                          borderRadius: "6px",
                          marginBottom: "14px",
                          fontSize: "11px",
                          color: "var(--ink)",
                        }}
                      >
                        <strong style={{ color: "var(--blue)" }}>NPS Scale 0–10:</strong> Automatically renders 11 interactive rating buttons from 0 (Not likely at all) to 10 (Extremely likely), tagged with Net Promoter Score weighting.
                      </div>
                    )}

                    {questionType === "csat" && (
                      <div
                        style={{
                          padding: "12px 14px",
                          background: "var(--blue-soft)",
                          border: "1px solid var(--blue)",
                          borderRadius: "6px",
                          marginBottom: "14px",
                          fontSize: "11px",
                          color: "var(--ink)",
                        }}
                      >
                        <strong style={{ color: "var(--blue)" }}>CSAT Scale 1–10:</strong> Automatically renders a 10-point satisfaction spectrum metric for in-depth departmental reviews.
                      </div>
                    )}

                    {questionType === "emoji" && (
                      <div
                        style={{
                          padding: "12px 14px",
                          background: "var(--sage-soft)",
                          border: "1px solid var(--sage)",
                          borderRadius: "6px",
                          marginBottom: "14px",
                          fontSize: "11px",
                          color: "var(--ink)",
                        }}
                      >
                        <strong style={{ color: "var(--sage)" }}>5-Point Sentiment:</strong> Displays an intuitive visual spectrum: 😠 Terrible · 🙁 Poor · 😐 Average · 🙂 Good · 🤩 Superb.
                      </div>
                    )}

                    {questionType === "rating" && (
                      <div
                        style={{
                          padding: "12px 14px",
                          background: "var(--warm-soft)",
                          border: "1px solid var(--warm)",
                          borderRadius: "6px",
                          marginBottom: "14px",
                          fontSize: "11px",
                          color: "var(--ink)",
                        }}
                      >
                        <strong style={{ color: "var(--warm)" }}>1–5 Star Rating:</strong> Luxury weighted star rating component with interactive hover states and average calculation.
                      </div>
                    )}

                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--ink)" }}>
                        <input
                          type="checkbox"
                          checked={isRequired}
                          onChange={(e) => setIsRequired(e.target.checked)}
                        />
                        <span>Make this question mandatory for guests to proceed</span>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                      Provide translated versions of this question prompt and options. Guests whose browser or QR link specifies this language will see your native translation.
                    </p>

                    {/* Language selector chips */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                      {FORM_LANGUAGES.filter((l) => l.code !== "en").map((lang) => {
                        const isCurrent = activeTranslationLang === lang.code;
                        const hasContent = Boolean(translationsMap[lang.code]?.questionText);
                        return (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => handleSwitchTranslationLang(lang.code)}
                            style={{
                              border: "1px solid",
                              borderColor: isCurrent ? "var(--sage)" : "var(--line-strong)",
                              background: isCurrent ? "var(--sage-soft)" : "var(--canvas-alt)",
                              color: isCurrent ? "var(--sage-deep)" : "var(--ink)",
                              padding: "4px 9px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "9px", fontWeight: 700 }}>{lang.tag}</span>
                            <span>{lang.name}</span>
                            {hasContent && <CheckCircle2 size={10} style={{ color: isCurrent ? "var(--sage-deep)" : "var(--sage)" }} />}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                      <label className="field-label" style={{ color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                        Translated Prompt ({FORM_LANGUAGES.find((l) => l.code === activeTranslationLang)?.name})
                      </label>
                      <input
                        type="text"
                        placeholder={`Enter ${FORM_LANGUAGES.find((l) => l.code === activeTranslationLang)?.name} translation...`}
                        value={translationText}
                        onChange={(e) => setTranslationText(e.target.value)}
                        onBlur={handleSaveCurrentTranslationDraft}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid var(--line-strong)",
                          borderRadius: "6px",
                          fontSize: "12px",
                          outline: "none",
                          background: "var(--canvas-alt)",
                          color: "var(--ink)",
                        }}
                      />
                    </div>

                    {(questionType === "choice" ||
                      questionType === "multi_choice" ||
                      questionType === "yes_no" ||
                      questionType === "dropdown" ||
                      questionType === "touchpoint") && (
                      <div style={{ marginBottom: "14px" }}>
                        <label className="field-label" style={{ color: "var(--ink)", display: "block", marginBottom: "6px" }}>
                          Translated Options (comma-separated)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. ตัวเลือก 1, ตัวเลือก 2"
                          value={translationOptionsStr}
                          onChange={(e) => setTranslationOptionsStr(e.target.value)}
                          onBlur={handleSaveCurrentTranslationDraft}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1px solid var(--line-strong)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            outline: "none",
                            background: "var(--canvas-alt)",
                            color: "var(--ink)",
                          }}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveCurrentTranslationDraft}
                      className="button button-outline compact"
                      style={{ fontSize: "11px", marginBottom: "16px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Check size={12} />
                      Save translation draft
                    </button>
                  </>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "8px",
                    borderTop: "1px solid var(--line)",
                    paddingTop: "16px",
                  }}
                >
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setShowAddModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button button-dark" disabled={submitting}>
                    {submitting ? "Saving…" : "Save component & sync"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: QUESTIONNAIRE TEMPLATES */}
      <AnimatePresence>
        {showTemplatesModal && (
          <div className="modal-backdrop-luxury">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="modal-dialog-luxury"
              style={{
                maxWidth: "680px",
                background: "var(--panel)",
                border: "1px solid var(--line-strong)",
                boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
                color: "var(--ink)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <p className="eyebrow" style={{ color: "var(--sage)" }}>Hospitality Templates</p>
                  <h2 style={{ fontSize: "18px", margin: "2px 0 0", color: "var(--ink)" }}>
                    Apply Questionnaire Template
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplatesModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: "4px" }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px 0", lineHeight: "1.5" }}>
                Select a pre-designed luxury survey structure to instantly populate your questionnaire with industry-standard NPS, CSAT, touchpoints, and ratings:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                {QUESTIONNAIRE_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      background: "var(--canvas-alt)",
                      border: "1px solid var(--line-strong)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "14px", color: "var(--ink)" }}>{tmpl.title}</strong>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: "var(--sage-soft)",
                            color: "var(--sage)",
                            fontWeight: 600,
                          }}
                        >
                          {tmpl.badge}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px", fontSize: "12px", color: "var(--muted)", lineHeight: "1.4" }}>
                        {tmpl.description}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {tmpl.questions.map((q, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: "10px",
                              fontFamily: "var(--font-dm-mono)",
                              background: "var(--panel)",
                              color: "var(--ink)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              border: "1px solid var(--line)",
                            }}
                          >
                            {q.questionType.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="button button-dark compact"
                      disabled={applyingTemplate}
                      onClick={() => handleApplyTemplate(tmpl)}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {applyingTemplate ? "Adding…" : "Apply Template →"}
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowTemplatesModal(false)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmDrawer
        open={pendingDelete !== null}
        title="Delete question"
        recordName={pendingDelete?.text || ""}
        consequence="Guests will no longer see this question. This cannot be undone."
        pending={deletingQuestion}
        onCancel={() => { if (!deletingQuestion) setPendingDelete(null); }}
        onConfirm={handleDeleteQuestion}
      />
    </div>
  );
}
