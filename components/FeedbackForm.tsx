"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DepartmentType } from "../types/database";
import { GuestStayDetails } from "../types/experience";
import CustomSelect from "./CustomSelect";

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

  // Mandatory Property Selection
  const [properties, setProperties] = useState<Array<{ id: string; name: string; code: string; location: string; is_active?: boolean }>>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [isUrlPreselected, setIsUrlPreselected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [trackedToken, setTrackedToken] = useState<string>(publicToken || "verified");

  // Dynamic Questionnaire
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

    // Fetch properties and check for URL pre-selection or demo mode link
    fetch("/api/properties", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success && json.properties) {
          // Exclude disabled properties from guest-facing selection
          const activeProperties = json.properties.filter((p: any) => p.is_active !== false);
          setProperties(activeProperties);

          if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const propParam = params.get("property") || params.get("propertyId") || params.get("p");
            const demoParam = params.get("demo") === "true" || params.get("demo") === "1" || params.has("demo");
            const tokenParam = params.get("token") || params.get("t");
            const roomParam = params.get("room") || params.get("roomNumber") || params.get("r");
            const guestParam = params.get("guest") || params.get("guestName") || params.get("name");
            const deptParam = params.get("dept") || params.get("department");

            if (tokenParam) setTrackedToken(tokenParam);
            if (roomParam) setRoomNumber(roomParam);
            if (guestParam) setGuestName(guestParam);
            if (deptParam && departments.includes(deptParam as DepartmentType)) {
              setDepartment(deptParam as DepartmentType);
            }
            if (demoParam) setIsDemoMode(true);

            if (propParam) {
              const cleanParam = propParam.trim().toLowerCase();
              const match = json.properties.find(
                (p: any) =>
                  p.id.toLowerCase() === cleanParam ||
                  p.code.toLowerCase() === cleanParam ||
                  p.name.toLowerCase().includes(cleanParam)
              );
              if (match) {
                setSelectedPropertyId(match.id);
                setIsUrlPreselected(true);
              }
            } else if (demoParam && activeProperties.length > 0) {
              // Demo link automatically selects property
              setSelectedPropertyId(activeProperties[0].id);
              setIsUrlPreselected(true);
            }
          }
        }
      })
      .catch(() => {});

    if (publicToken && publicToken !== "verified") {
      fetch(`/api/stays/${encodeURIComponent(publicToken)}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((json) => {
          if (mounted && json.success && json.data) {
            setStay(json.data);
            if (json.data.propertyId) {
              setSelectedPropertyId(json.data.propertyId);
              setIsUrlPreselected(true);
            }
          }
        })
        .catch((err) => {
          console.error("Error fetching stay details", err);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }

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
    setPropertyError(null);

    if (!selectedPropertyId) {
      setPropertyError("Please select the hotel property location of your stay.");
      return;
    }
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
          publicToken: trackedToken || publicToken,
          propertyId: selectedPropertyId,
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

  const progressStep = !selectedPropertyId ? 1 : !rating ? 2 : 3;
  const ratingWord = rating === 1 ? "Needs work" : rating === 2 ? "Fair" : rating === 3 ? "Good" : rating === 4 ? "Very good" : rating === 5 ? "Exceptional" : "";
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId);
  const managerFollowUp = rating !== null && (rating <= 2 || wantsContact);

  if (loading) {
    return (
      <main className="guest-shell">
        <div className="guest-card guest-card-waiting" aria-busy="true">
          <p className="eyebrow">Guest feedback</p>
          <span className="table-loading-bar" />
          <span className="table-loading-bar short" />
          <span className="sr-only">Preparing feedback form</span>
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
            We received this note{roomNumber.trim() ? ` for ${roomNumber.trim()}` : ""}{selectedProperty ? ` at ${selectedProperty.name.trim()}` : ""}.
          </p>
          <dl className="guest-receipt">
            {selectedProperty && <div><dt>Property</dt><dd>{selectedProperty.name}</dd></div>}
            <div><dt>Rating</dt><dd>{rating} · {ratingWord}</dd></div>
            <div><dt>Area</dt><dd>{department}</dd></div>
            {roomNumber.trim() && <div><dt>Room</dt><dd>{roomNumber.trim()}</dd></div>}
            {guestName.trim() && <div><dt>Name</dt><dd>{guestName.trim()}</dd></div>}
            {comment.trim() && <div><dt>Note</dt><dd>{comment.trim()}</dd></div>}
          </dl>
          {managerFollowUp && (
            <p className="guest-followup-note">
              {`A manager will follow up on this stay${wantsContact && contactValue.trim() ? ` by ${contactPreference === "email" ? "email" : "phone"} at ${contactValue.trim()}` : ""}.`}
            </p>
          )}
          <Link className="text-link guest-home-link" href="/">Return to Vistora Home</Link>
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
        <div className="guest-progress" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={progressStep} aria-label={`Step ${progressStep} of 3`}>
          <span className={progressStep > 1 ? "done" : "current"} />
          <span className={progressStep > 2 ? "done" : progressStep === 2 ? "current" : ""} />
          <span className={progressStep === 3 ? "current" : ""} />
        </div>
        <ol className="guest-progress-labels">
          <li className={progressStep > 1 ? "done" : "current"}>Property</li>
          <li className={progressStep > 2 ? "done" : progressStep === 2 ? "current" : ""}>Rating</li>
          <li className={progressStep === 3 ? "current" : ""}>Note</li>
        </ol>

        <h1>How did we make<br /><em>you feel?</em></h1>
        <p className="guest-intro">
          Your perspective helps our hospitality team tailor every arrival.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Mandatory Property Selection */}
          <div className={`guest-callout${propertyError ? " has-error" : ""}`}>
            <label className="field-label guest-callout-label" htmlFor="property-select">
              <span>Which Vistora property are you reviewing? <strong className="guest-required">*</strong></span>
              {selectedPropertyId && isUrlPreselected && (
                <span className="guest-preselected">
                  ✓ {isDemoMode ? "Demo link · Property pre-selected" : "Property pre-selected"}
                </span>
              )}
            </label>

            <CustomSelect
              id="property-select"
              value={selectedPropertyId}
              onChange={(val) => {
                setSelectedPropertyId(val);
                setPropertyError(null);
              }}
              placeholder="-- Select property location (Required) --"
              header="Vistora Properties"
              options={properties.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.code})`,
                detail: p.location,
              }))}
            />

            {propertyError && (
              <p className="guest-error">{propertyError}</p>
            )}
          </div>

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
          <div className="guest-field-block">
            <label className="field-label" htmlFor="department-select">
              Which area is this feedback about?
            </label>
            <CustomSelect
              id="department-select"
              value={department}
              onChange={(val) => setDepartment(val as DepartmentType)}
              header="Hospitality Department"
              options={departments.map((dep) => ({
                value: dep,
                label: dep,
              }))}
            />
          </div>

          {/* Guest Name & Room confirmation */}
          <div className="guest-split">
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
                className="guest-field"
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
                className="guest-field"
              />
            </div>
          </div>

          {/* Dynamic Questionnaire Questions */}
          {questions.length > 0 && (
            <div className="guest-question-block">
              {questions.map((q) => (
                <div key={q.id} className="guest-question">
                  <label className="guest-question-label">
                    {q.question_text}
                    {q.is_required && <span className="guest-required">*</span>}
                  </label>

                  {q.question_type === "choice" && q.options && q.options.length > 0 && (
                    <div className="guest-choice-row">
                      {q.options.map((opt) => {
                        const isSelected = answers[q.id] === opt;
                        return (
                          <button
                            type="button"
                            key={opt}
                            className={`guest-choice${isSelected ? " selected" : ""}`}
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: isSelected ? "" : opt }))}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.question_type === "yes_no" && (
                    <div className="guest-choice-row">
                      {(q.options && q.options.length > 0 ? q.options : ["Yes", "No"]).map((opt) => {
                        const isSelected = answers[q.id] === opt;
                        return (
                          <button
                            type="button"
                            key={opt}
                            className={`guest-choice${isSelected ? " selected" : ""}`}
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: isSelected ? "" : opt }))}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.question_type === "rating" && (
                    <div className="guest-rating-mini">
                      {[1, 2, 3, 4, 5].map((val) => {
                        const isSelected = answers[q.id] === `${val}/5`;
                        return (
                          <button
                            type="button"
                            key={val}
                            className={`guest-choice${isSelected ? " selected" : ""}`}
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: isSelected ? "" : `${val}/5` }))}
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
                      className="guest-field"
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Your thoughts…"
                    />
                  )}
                </div>
              ))}
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
            <div className="guest-followup">
              <div className="guest-choice-row">
                <label className="guest-radio">
                  <input
                    type="radio"
                    name="pref"
                    checked={contactPreference === "email"}
                    onChange={() => setContactPreference("email")}
                  />
                  Follow up via Email
                </label>
                <label className="guest-radio">
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
                className="guest-field"
                type={contactPreference === "email" ? "email" : "tel"}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={contactPreference === "email" ? "your.email@example.com" : "+65 9123 4567"}
              />
            </div>
          )}

          <button
            className="button button-dark submit-button"
            disabled={!rating || !selectedPropertyId || submitting}
          >
            {submitting ? "Submitting..." : "Send feedback"} <span>→</span>
          </button>
          {(!selectedPropertyId || !rating) && (
            <p className="guest-hint">
              {!selectedPropertyId ? "Please select a hotel property location above to proceed." : "Please select an overall rating (1-5) above."}
            </p>
          )}
        </form>

        <p className="privacy-note">
          Your feedback is handled securely and connected to your verified stay record.{" "}
          <a href="#privacy">Privacy notice</a>
        </p>
      </div>
    </main>
  );
}
