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
  Languages,
  QrCode,
  Gauge,
  MessageSquare,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "./CustomSelect";

export interface QuestionData {
  id: string;
  property_id?: string | null;
  question_text: string;
  question_type: "choice" | "rating" | "yes_no" | "text" | "nps" | "csat" | "long_text" | string;
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
  { value: "choice", label: "Multiple Choice Pills", detail: "Interactive guest selection pills" },
  { value: "rating", label: "1–5 Star Luxury Rating", detail: "Weighted numerical star rating score" },
  { value: "nps", label: "NPS Scale (0–10)", detail: "Industry-standard Net Promoter Score metric" },
  { value: "csat", label: "CSAT Score (1–10)", detail: "Comprehensive satisfaction spectrum metric" },
  { value: "yes_no", label: "Yes / No Binary Toggle", detail: "Quick two-state confirmation" },
  { value: "text", label: "Single-line Comment", detail: "Short written feedback box" },
  { value: "long_text", label: "Detailed Story & Testimonial", detail: "Multi-line freeform storytelling textarea" },
];

export default function QuestionnaireBuilder() {
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Active language preview
  const [previewLang, setPreviewLang] = useState<string>("en");

  // Modal / Add Question states
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<"basics" | "translations">("basics");
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<string>("choice");
  const [optionsStr, setOptionsStr] = useState("Seamless & prompt, Standard / acceptable, Delayed");
  const [isRequired, setIsRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      if (questionType === "choice" || questionType === "yes_no") {
        options = optionsStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (options.length === 0) {
          options = questionType === "yes_no" ? ["Yes", "No"] : ["Option 1", "Option 2"];
        }
      } else if (questionType === "nps") {
        options = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
      } else if (questionType === "csat") {
        options = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
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

      setSuccess(`Question "${questionText.trim()}" added with ${Object.keys(finalTranslations).length} language translation(s).`);
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

  async function handleDeleteQuestion(id: string, text: string) {
    if (!window.confirm(`Delete question: "${text}"?`)) return;

    try {
      const res = await fetch("/api/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Question removed.");
        await loadQuestions();
      }
    } catch {
      setError("Failed to delete question.");
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
          background: "linear-gradient(135deg, rgba(37,66,48,0.06) 0%, rgba(11,16,15,0.02) 100%)",
          border: "1px solid rgba(37,66,48,0.2)",
          borderRadius: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "#254230",
              color: "#fff",
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
              Live Synchronization with QR Studio & Public Touchpoints
            </strong>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted)", lineHeight: "1.4" }}>
              All custom form components (NPS 0–10, 5-Star, Choice pills, Stories) and translations configured here automatically adapt to the guest&rsquo;s device language when scanning in-room or dining QR codes.
            </p>
          </div>
        </div>
        <a
          href="/dashboard/operations"
          className="button button-outline compact"
          style={{ fontSize: "11px", whiteSpace: "nowrap" }}
        >
          Open QR Studio →
        </a>
      </div>

      {/* TOP CONTROLS: PREVIEW LANGUAGE SWITCHER & ADD BUTTON */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Languages size={13} />
            Preview Language:
          </span>
          <div style={{ display: "inline-flex", background: "var(--line)", padding: "2px", borderRadius: "6px", gap: "2px" }}>
            {FORM_LANGUAGES.map((lang) => {
              const isSelected = previewLang === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setPreviewLang(lang.code)}
                  style={{
                    border: "none",
                    background: isSelected ? "var(--surface)" : "transparent",
                    color: isSelected ? "var(--ink)" : "var(--muted)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: isSelected ? 600 : 400,
                    boxShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-dm-mono)", fontSize: "10px", fontWeight: isSelected ? 700 : 500 }}>
                    {lang.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="button button-dark compact"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setShowAddModal(true);
          }}
        >
          <Plus size={14} strokeWidth={2} style={{ marginRight: "6px" }} />
          Add custom component
        </button>
      </div>

      {error && (
        <div className="panel" style={{ padding: "12px 18px", marginBottom: "16px", background: "#fbf1ef", color: "#8b261a", border: "1px solid #ebd3cf", fontSize: "12px" }}>
          {error}
        </div>
      )}

      {success && (
        <div className="panel" style={{ padding: "12px 18px", marginBottom: "16px", background: "#edf4ed", color: "#254230", border: "1px solid #d4e2d6", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Check size={14} strokeWidth={2} />
          {success}
        </div>
      )}

      {/* QUESTIONS TABLE */}
      <div className="panel table-panel" style={{ overflow: "hidden", borderRadius: "8px" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th>Prompt ({previewLang.toUpperCase()})</th>
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
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                    Loading questionnaire questions…
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                    No questionnaire questions created yet. Click &ldquo;Add custom component&rdquo; above.
                  </td>
                </tr>
              ) : (
                questions.map((q, idx) => {
                  const typeMeta = COMPONENT_TYPES.find((c) => c.value === q.question_type) || {
                    label: q.question_type,
                    detail: "Custom component",
                  };

                  // Language translation resolution
                  const translation = previewLang !== "en" ? q.translations?.[previewLang] : null;
                  const displayPrompt = translation?.questionText || q.question_text;
                  const displayOptions = translation?.options && translation.options.length > 0 ? translation.options : q.options;

                  const translationCount = q.translations ? Object.keys(q.translations).length : 0;

                  return (
                    <tr key={q.id}>
                      <td style={{ color: "var(--muted)", fontSize: "11px", fontFamily: "var(--font-dm-mono)" }}>
                        {idx + 1}
                      </td>
                      <td>
                        <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{displayPrompt}</strong>
                        {previewLang !== "en" && !translation?.questionText && (
                          <span style={{ display: "block", fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>
                            (Falling back to English)
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: "var(--font-dm-mono)",
                            fontSize: "10px",
                            padding: "3px 8px",
                            background:
                              q.question_type === "nps" || q.question_type === "csat"
                                ? "#eef2ff"
                                : q.question_type === "rating"
                                ? "#fef3c7"
                                : "var(--line)",
                            color:
                              q.question_type === "nps" || q.question_type === "csat"
                                ? "#4338ca"
                                : q.question_type === "rating"
                                ? "#92400e"
                                : "var(--ink-light)",
                            borderRadius: "4px",
                            fontWeight: 500,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {q.question_type === "rating" && <Star size={10} />}
                          {q.question_type === "nps" && <Gauge size={10} />}
                          {q.question_type === "long_text" && <MessageSquare size={10} />}
                          {typeMeta.label}
                        </span>
                      </td>
                      <td>
                        {q.question_type === "choice" || q.question_type === "yes_no" ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {displayOptions && displayOptions.length > 0 ? (
                              displayOptions.map((opt) => (
                                <span
                                  key={opt}
                                  style={{
                                    fontSize: "10px",
                                    padding: "2px 8px",
                                    borderRadius: "10px",
                                    background: "#f0f4f0",
                                    color: "#254230",
                                    border: "1px solid #d8e5d8",
                                  }}
                                >
                                  {opt}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: "11px" }}>Standard options</span>
                            )}
                          </div>
                        ) : q.question_type === "rating" ? (
                          <span style={{ color: "var(--muted)", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <Star size={11} fill="#f59e0b" stroke="#f59e0b" /> 1 to 5 Stars
                          </span>
                        ) : q.question_type === "nps" ? (
                          <span style={{ color: "#4338ca", fontSize: "11px", fontWeight: 500 }}>
                            0 to 10 Scale (Detractor / Passive / Promoter)
                          </span>
                        ) : q.question_type === "csat" ? (
                          <span style={{ color: "#4338ca", fontSize: "11px", fontWeight: 500 }}>
                            1 to 10 Satisfaction Spectrum
                          </span>
                        ) : q.question_type === "long_text" ? (
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>Multi-line textarea</span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>Single-line text</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: "9px",
                              padding: "2px 5px",
                              borderRadius: "3px",
                              background: "#e2e8f0",
                              color: "#334155",
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
                                    background: "#dcfce7",
                                    color: "#166534",
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
                        <span style={{ fontSize: "11px", color: q.is_required ? "#8b261a" : "var(--muted)", fontWeight: q.is_required ? 600 : 400 }}>
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
                            color: q.is_active ? "#254230" : "var(--muted)",
                          }}
                          title={q.is_active ? "Click to deactivate" : "Click to activate"}
                        >
                          {q.is_active ? (
                            <>
                              <ToggleRight size={18} strokeWidth={2} style={{ color: "#254230" }} />
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
                          onClick={() => handleDeleteQuestion(q.id, q.question_text)}
                          className="button compact"
                          style={{ padding: "4px 8px", fontSize: "11px", background: "transparent", color: "var(--muted)", border: "1px solid var(--line)" }}
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

      {/* MODAL: ADD CUSTOM COMPONENT & TRANSLATIONS */}
      <AnimatePresence>
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(11, 16, 15, 0.55)",
              backdropFilter: "blur(5px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "16px",
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                width: "100%",
                maxWidth: "540px",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: "24px",
                boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <p className="eyebrow">Form Builder & Studio</p>
                  <h2 style={{ fontSize: "18px", margin: 0 }}>Add custom component</h2>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
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
                    color: modalTab === "basics" ? "#254230" : "var(--muted)",
                    borderBottom: modalTab === "basics" ? "2px solid #254230" : "2px solid transparent",
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
                    color: modalTab === "translations" ? "#254230" : "var(--muted)",
                    borderBottom: modalTab === "translations" ? "2px solid #254230" : "2px solid transparent",
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
                        background: "#254230",
                        color: "#fff",
                        borderRadius: "10px",
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
                      <label className="field-label" htmlFor="q-text">
                        Primary Question Text (English) *
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
                          padding: "9px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "4px",
                          fontSize: "12px",
                          outline: "none",
                          background: "var(--surface)",
                          color: "var(--ink)",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                      <label className="field-label" htmlFor="q-type" style={{ display: "block", marginBottom: "6px" }}>
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
                          } else if (t === "choice") {
                            setOptionsStr("Seamless & prompt, Standard / acceptable, Delayed");
                          }
                        }}
                        header="Select Component Format"
                        options={COMPONENT_TYPES}
                      />
                    </div>

                    {(questionType === "choice" || questionType === "yes_no") && (
                      <div style={{ marginBottom: "14px" }}>
                        <label className="field-label" htmlFor="q-options">
                          Answer Options (comma-separated)
                        </label>
                        <input
                          id="q-options"
                          type="text"
                          placeholder="e.g. Excellent, Adequate, Needs Attention"
                          value={optionsStr}
                          onChange={(e) => setOptionsStr(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: "1px solid var(--line)",
                            borderRadius: "4px",
                            fontSize: "12px",
                            outline: "none",
                            background: "var(--surface)",
                            color: "var(--ink)",
                          }}
                        />
                        <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0 0" }}>
                          Separate multiple choices with commas. Guests can tap one of these pills.
                        </p>
                      </div>
                    )}

                    {questionType === "nps" && (
                      <div
                        style={{
                          padding: "10px 14px",
                          background: "#eef2ff",
                          border: "1px solid #c7d2fe",
                          borderRadius: "6px",
                          marginBottom: "14px",
                          fontSize: "11px",
                          color: "#3730a3",
                        }}
                      >
                        <strong>NPS Scale 0–10:</strong> Automatically generates 11 interactive rating buttons from 0 (Not likely at all) to 10 (Extremely likely), tagged with Net Promoter Score weighting.
                      </div>
                    )}

                    {questionType === "csat" && (
                      <div
                        style={{
                          padding: "10px 14px",
                          background: "#eef2ff",
                          border: "1px solid #c7d2fe",
                          borderRadius: "6px",
                          marginBottom: "14px",
                          fontSize: "11px",
                          color: "#3730a3",
                        }}
                      >
                        <strong>CSAT Scale 1–10:</strong> Automatically renders a 10-point satisfaction spectrum metric for in-depth departmental reviews.
                      </div>
                    )}

                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px" }}>
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
                              borderColor: isCurrent ? "#254230" : "var(--line)",
                              background: isCurrent ? "#254230" : "var(--surface)",
                              color: isCurrent ? "#fff" : "var(--ink)",
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
                            {hasContent && <CheckCircle2 size={10} style={{ color: isCurrent ? "#86efac" : "#166534" }} />}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                      <label className="field-label">
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
                          padding: "9px 12px",
                          border: "1px solid var(--line)",
                          borderRadius: "4px",
                          fontSize: "12px",
                          outline: "none",
                          background: "var(--surface)",
                          color: "var(--ink)",
                        }}
                      />
                    </div>

                    {(questionType === "choice" || questionType === "yes_no") && (
                      <div style={{ marginBottom: "14px" }}>
                        <label className="field-label">
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
                            padding: "9px 12px",
                            border: "1px solid var(--line)",
                            borderRadius: "4px",
                            fontSize: "12px",
                            outline: "none",
                            background: "var(--surface)",
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
                      Save translation for {FORM_LANGUAGES.find((l) => l.code === activeTranslationLang)?.name}
                    </button>
                  </>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid var(--line)", paddingTop: "16px" }}>
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
    </div>
  );
}
