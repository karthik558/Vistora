"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DepartmentType } from "../types/database";
import { GuestStayDetails } from "../types/experience";

const departments: DepartmentType[] = [
  "Front Desk",
  "Housekeeping",
  "Food & Beverage",
  "Concierge",
  "Facilities & Room",
  "Spa & Wellness",
  "Valet & Transfers",
];

export default function FeedbackForm({ publicToken = "verified" }: { publicToken?: string }) {
  const [stay, setStay] = useState<GuestStayDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [rating, setRating] = useState<number | null>(null);
  const [department, setDepartment] = useState<DepartmentType>("Front Desk");
  const [comment, setComment] = useState("");
  const [wantsContact, setWantsContact] = useState(false);
  const [contactPreference, setContactPreference] = useState<"email" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [guestName, setGuestName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");

  // Dynamic Questionnaire from Supabase
  const [questions, setQuestions] = useState<Array<{
    id: string;
    question_text: string;
    question_type: "choice" | "rating" | "yes_no" | "text";
    options?: string[];
    is_required?: boolean;
  }>>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    fetch(`/api/stays/${encodeURIComponent(publicToken)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success && json.data) {
          setStay(json.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error fetching stay details", err);
        if (mounted) setLoading(false);
      });

    // Fetch active questionnaire questions
    fetch("/api/questions", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success && json.questions) {
          setQuestions(json.questions);
        }
      })
      .catch(() => { });

    return () => {
      mounted = false;
    };
  }, [publicToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) return;

    setSubmitting(true);
    try {
      const answersPayload = questions
        .map((q) => ({
          questionId: q.id,
          questionText: q.question_text,
          answerValue: answers[q.id] || "",
        }))
        .filter((a) => a.answerValue && a.answerValue.trim().length > 0);

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          propertyId: stay?.propertyId,
          guestName: guestName.trim() || undefined,
          roomNumber: roomNumber.trim() || undefined,
          department,
          rating,
          comment: comment.trim() || undefined,
          answers: answersPayload,
          wantsContact,
          contactPreference: wantsContact ? contactPreference : undefined,
          guestEmail: wantsContact && contactPreference === "email" ? contactValue : undefined,
          guestPhone: wantsContact && contactPreference === "phone" ? contactValue : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Failed to submit feedback", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="guest-shell">
        <div className="guest-card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <p className="eyebrow">Guest feedback</p>
          <p className="guest-intro" style={{ margin: "auto" }}>Preparing feedback form…</p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="guest-shell">
        <div className="guest-card success-card">
          <div className="success-mark">✓</div>
          <p className="eyebrow">Thank you</p>
          <h1>Your feedback is<br /><em>with our team.</em></h1>
          <p>
            We appreciate you taking a moment to tell us about your experience{roomNumber ? ` in ${roomNumber}` : ""}.
            {rating !== null && rating <= 2
              ? " A duty manager has been notified and our service recovery team will follow up promptly."
              : " Your comments help our team refine the thoughtful details our guests remember."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
            <Link className="button button-dark" href="/dashboard">
              View in Operations Dashboard <span>↗</span>
            </Link>
            <Link className="text-link" href="/" style={{ textAlign: "center" }}>
              Return to Vistora Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="guest-shell">
      <div className="guest-card">
        <div className="guest-top">
          <Link href="/" title="Vistora Home" style={{ display: "inline-flex", alignItems: "center" }}>
            <Image
              src="/logo1.webp"
              alt="Vistora"
              width={120}
              height={32}
              priority
              style={{ height: "26px", width: "auto", objectFit: "contain" }}
            />
          </Link>
        </div>
        <div className="guest-progress"><span /><span /><span /></div>

        <h1>How did we make<br /><em>you feel?</em></h1>
        <p className="guest-intro">
          Your perspective helps our hospitality team tailor every arrival.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Rating */}
          <fieldset>
            <legend>How would you rate your experience overall?</legend>
            <div className="rating-grid">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`rating-button ${rating === value ? "selected" : ""}`}
                  onClick={() => setRating(value)}
                  aria-label={`${value} out of 5`}
                >
                  {value}
                  <small>
                    {value === 1 ? "Needs work" : value === 2 ? "Fair" : value === 3 ? "Good" : value === 4 ? "Very good" : "Exceptional"}
                  </small>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Department / Experience Area */}
          <div style={{ marginBottom: "20px" }}>
            <label className="field-label" htmlFor="department-select">
              Which area is this feedback about?
            </label>
            <select
              id="department-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value as DepartmentType)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "4px",
                border: "1px solid #e1e7e1",
                background: "#fff",
                color: "var(--ink)",
                fontSize: "12px",
                outline: "none",
              }}
            >
              {departments.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>

          {/* Guest Name & Room confirmation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
            <div>
              <label className="field-label" htmlFor="guest-name">
                Your name
              </label>
              <input
                id="guest-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your name (optional)"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "4px",
                  border: "1px solid #e1e7e1",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="guest-room">
                Room or location
              </label>
              <input
                id="guest-room"
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 304 or Poolside"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "4px",
                  border: "1px solid #e1e7e1",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Dynamic Questionnaire Questions */}
          {questions.length > 0 && (
            <div
              style={{
                marginBottom: "24px",
                padding: "16px",
                background: "#f9faf9",
                borderRadius: "6px",
                border: "1px solid #e5ebe5",
              }}
            >
              <p className="eyebrow" style={{ marginBottom: "14px", color: "var(--muted)", letterSpacing: "0.06em" }}>
                Experience Questionnaire
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {questions.map((q) => (
                  <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {q.question_text}
                      {q.is_required && <span style={{ color: "#a84232", fontSize: "11px" }}>*</span>}
                    </label>

                    {q.question_type === "choice" && q.options && q.options.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {q.options.map((opt) => {
                          const isSelected = answers[q.id] === opt;
                          return (
                            <button
                              type="button"
                              key={opt}
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: isSelected ? "" : opt }))}
                              style={{
                                padding: "6px 14px",
                                borderRadius: "20px",
                                border: isSelected ? "1px solid #0b100f" : "1px solid #d4ded4",
                                background: isSelected ? "#0b100f" : "#ffffff",
                                color: isSelected ? "#ffffff" : "var(--ink)",
                                fontSize: "11px",
                                fontWeight: 500,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.question_type === "yes_no" && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        {(q.options && q.options.length > 0 ? q.options : ["Yes", "No"]).map((opt) => {
                          const isSelected = answers[q.id] === opt;
                          return (
                            <button
                              type="button"
                              key={opt}
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: isSelected ? "" : opt }))}
                              style={{
                                padding: "6px 16px",
                                borderRadius: "4px",
                                border: isSelected ? "1px solid #0b100f" : "1px solid #d4ded4",
                                background: isSelected ? "#0b100f" : "#ffffff",
                                color: isSelected ? "#ffffff" : "var(--ink)",
                                fontSize: "11px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.question_type === "rating" && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        {[1, 2, 3, 4, 5].map((val) => {
                          const isSelected = answers[q.id] === `${val}/5`;
                          return (
                            <button
                              type="button"
                              key={val}
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: isSelected ? "" : `${val}/5` }))}
                              style={{
                                width: "38px",
                                height: "36px",
                                borderRadius: "4px",
                                border: isSelected ? "1px solid #0b100f" : "1px solid #d4ded4",
                                background: isSelected ? "#0b100f" : "#ffffff",
                                color: isSelected ? "#ffffff" : "var(--ink)",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {val}★
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.question_type === "text" && (
                      <input
                        type="text"
                        value={answers[q.id] || ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Your thoughts…"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "4px",
                          border: "1px solid #d8dfd8",
                          fontSize: "12px",
                          outline: "none",
                          background: "#fff",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <label className="field-label" htmlFor="comment">
            What stood out during your stay? <span>Optional</span>
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share a moment, a colleague who assisted you, or something we could improve…"
            rows={4}
          />

          {/* Contact Checkbox & Details */}
          <label className="check-row">
            <input
              type="checkbox"
              checked={wantsContact}
              onChange={(e) => setWantsContact(e.target.checked)}
            />
            <span>I’d like a manager to follow up with me regarding this feedback.</span>
          </label>

          {wantsContact && (
            <div style={{ padding: "14px", background: "#f8faf8", border: "1px solid #e3e8e3", borderRadius: "4px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "16px", marginBottom: "10px", fontSize: "11px", color: "var(--ink)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="pref"
                    checked={contactPreference === "email"}
                    onChange={() => setContactPreference("email")}
                  />
                  Follow up via Email
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="pref"
                    checked={contactPreference === "phone"}
                    onChange={() => setContactPreference("phone")}
                  />
                  Follow up via Phone
                </label>
              </div>
              <input
                type={contactPreference === "email" ? "email" : "tel"}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={contactPreference === "email" ? "your.email@example.com" : "+65 9123 4567"}
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "4px",
                  border: "1px solid #d8dfd8",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>
          )}

          <button className="button button-dark submit-button" disabled={!rating || submitting}>
            {submitting ? "Submitting..." : "Send feedback"} <span>→</span>
          </button>
        </form>

        <p className="privacy-note">
          Your feedback is handled securely and connected to your verified stay record.{" "}
          <a href="#privacy">Privacy notice</a>
        </p>
      </div>
    </main>
  );
}