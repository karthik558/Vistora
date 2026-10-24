"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Check, X, HelpCircle, Star, ToggleLeft, ToggleRight, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "./CustomSelect";

export interface QuestionData {
  id: string;
  property_id?: string | null;
  question_text: string;
  question_type: "choice" | "rating" | "yes_no" | "text";
  options?: string[];
  is_required: boolean;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export default function QuestionnaireBuilder() {
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncedWithDb, setSyncedWithDb] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal / Add Question states
  const [showAddModal, setShowAddModal] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<"choice" | "rating" | "yes_no" | "text">("choice");
  const [optionsStr, setOptionsStr] = useState("Seamless, Standard, Delayed");
  const [isRequired, setIsRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  async function loadQuestions() {
    setLoading(true);
    try {
      const res = await fetch("/api/questions?all=true", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.questions) {
        setQuestions(data.questions);
        setSyncedWithDb(Boolean(data.syncedWithSupabase));
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

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!questionText.trim()) return;

    setError(null);
    setSuccess(null);
    setSubmitting(true);

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
      }

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: questionText.trim(),
          questionType,
          options,
          isRequired,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add question.");
      }

      setSuccess(`Question added successfully.`);
      setShowAddModal(false);
      setQuestionText("");
      setOptionsStr("Seamless, Standard, Delayed");
      setIsRequired(false);
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

  const sqlMigrationCode = `-- Run this in your Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.feedback_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'choice',
    options JSONB DEFAULT '[]'::jsonb,
    department department_type,
    is_required BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feedback_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.feedback_questions(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    answer_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public questions are viewable by everyone" ON public.feedback_questions FOR SELECT USING (true);
CREATE POLICY "Service role full access to questions" ON public.feedback_questions FOR ALL USING (true);
CREATE POLICY "Public can submit feedback answers" ON public.feedback_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role full access to answers" ON public.feedback_answers FOR ALL USING (true);`;

  function copySql() {
    navigator.clipboard.writeText(sqlMigrationCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  }

  return (
    <div style={{ marginTop: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <h2 style={{ fontSize: "18px", margin: 0 }}>Feedback Questionnaire & Questions</h2>
            <span
              style={{
                fontSize: "10px",
                fontFamily: "var(--font-dm-mono)",
                padding: "2px 8px",
                borderRadius: "12px",
                background: syncedWithDb ? "#edf4ed" : "#fef6e7",
                color: syncedWithDb ? "#254230" : "#8f5e08",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              {syncedWithDb ? "SUPABASE LIVE" : "ACTIVE (SQL PENDING)"}
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
            Configure questions shown to guests on the public feedback form. All responses sync to your operational dashboard.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {!syncedWithDb && (
            <button
              type="button"
              onClick={copySql}
              className="button button-outline compact"
              style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              title="Copy SQL for Supabase"
            >
              <Copy size={12} />
              {copiedSql ? "SQL Copied!" : "Copy Supabase SQL"}
            </button>
          )}
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
            Add question
          </button>
        </div>
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

      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th>Question</th>
                <th>Question Type</th>
                <th>Options / Scale</th>
                <th>Required</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                    Loading questionnaire questions…
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                    No questionnaire questions created yet. Click &ldquo;Add question&rdquo; above.
                  </td>
                </tr>
              ) : (
                questions.map((q, idx) => {
                  const typeLabel =
                    q.question_type === "choice"
                      ? "Multiple Choice"
                      : q.question_type === "rating"
                      ? "1–5 Star Rating"
                      : q.question_type === "yes_no"
                      ? "Yes / No Toggle"
                      : "Open Text";

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
                            padding: "2px 7px",
                            background: "var(--line)",
                            borderRadius: "3px",
                            color: "var(--ink-light)",
                          }}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td>
                        {q.question_type === "choice" || q.question_type === "yes_no" ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {q.options && q.options.length > 0 ? (
                              q.options.map((opt) => (
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
                            <Star size={11} /> 1 to 5 Stars
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: "11px" }}>Short written answer</span>
                        )}
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

      {/* MODAL: ADD QUESTION */}
      <AnimatePresence>
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(11, 16, 15, 0.45)",
              backdropFilter: "blur(4px)",
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
                background: "#ffffff",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                width: "100%",
                maxWidth: "480px",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <p className="eyebrow">Questionnaire Configuration</p>
                  <h2 style={{ fontSize: "18px", margin: 0 }}>Add questionnaire question</h2>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddQuestion}>
                <div style={{ marginBottom: "14px" }}>
                  <label className="field-label" htmlFor="q-text">
                    Question Text *
                  </label>
                  <input
                    id="q-text"
                    type="text"
                    required
                    placeholder="e.g. How clean was your room upon arrival?"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "12px", outline: "none" }}
                  />
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label className="field-label" htmlFor="q-type" style={{ display: "block", marginBottom: "6px" }}>
                    Question Format
                  </label>
                  <CustomSelect
                    id="q-type"
                    value={questionType}
                    onChange={(val) => {
                      const t = val as any;
                      setQuestionType(t);
                      if (t === "yes_no") {
                        setOptionsStr("Yes, No");
                      } else if (t === "choice") {
                        setOptionsStr("Seamless, Standard, Delayed");
                      }
                    }}
                    header="Question Format"
                    options={[
                      { value: "choice", label: "Multiple Choice", detail: "Interactive pill options" },
                      { value: "rating", label: "1–5 Star Rating", detail: "Numerical rating score" },
                      { value: "yes_no", label: "Yes / No Selector", detail: "Binary quick response" },
                      { value: "text", label: "Open-ended Text", detail: "Freeform guest comments" },
                    ]}
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
                      style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: "4px", fontSize: "12px", outline: "none" }}
                    />
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0 0" }}>
                      Separate multiple choices with commas. Guests can select one of these options.
                    </p>
                  </div>
                )}

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px" }}>
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                    />
                    <span>Make this question mandatory for guests</span>
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setShowAddModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button button-dark" disabled={submitting}>
                    {submitting ? "Adding…" : "Save question"}
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
