"use client";
import { contrastRatio } from "../lib/hospitality/config";
import {multiChoices,toggleMultiChoice} from "../lib/feedbackAnswers";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import {Star} from "lucide-react";
import Link from "next/link";
import { DepartmentType } from "../types/database";
import { GuestStayDetails } from "../types/experience";
import CustomSelect from "./CustomSelect";

const departments: { value: DepartmentType; label: string; detail: string }[] = [
  { value: "Front Desk", label: "Front Desk & Reception", detail: "Arrival, departure, keycards & billing" },
  { value: "Housekeeping", label: "Housekeeping & Cleanliness", detail: "Room servicing, turn-down, fresh linen & amenities" },
  { value: "Food & Beverage", label: "Food & Beverage", detail: "Restaurants, in-room dining, bar & breakfast" },
  { value: "Facilities & Room", label: "Facilities & Maintenance", detail: "In-room AC, fixtures, plumbing, lighting & hardware" },
  { value: "Spa & Wellness", label: "Spa & Wellness Facilities", detail: "Spa treatments, fitness center, sauna & pools" },
  { value: "Concierge", label: "Concierge & Guest Relations", detail: "Tours, local transport, bookings & luggage" },
  { value: "Valet & Transfers", label: "Valet & Transfers", detail: "Airport transit, drop-off & parking" },
];

export default function FeedbackForm({ publicToken = "" }: { publicToken?: string }) {
  const [stay, setStay] = useState<GuestStayDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkError, setLinkError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [rating, setRating] = useState<number | null>(null);
  const [recommendationScore,setRecommendationScore]=useState<number|null>(null);
  const [department, setDepartment] = useState<DepartmentType>("Front Desk");
  const [comment, setComment] = useState("");
  const [wantsContact, setWantsContact] = useState(false);
  const [contactPreference, setContactPreference] = useState<"email" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [guestName, setGuestName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  // The server resolves one property from the authorized guest link.
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Dynamic Questionnaire
  const [questions, setQuestions] = useState<Array<{
    id: string;
    question_text: string;
    question_type: string;
    options?: string[];
    is_required?: boolean;
    department?:string|null;
  }>>([]);
  const [questionsProperty,setQuestionsProperty]=useState("");
  const [questionsError,setQuestionsError]=useState("");
  const [questionsRetry,setQuestionsRetry]=useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLinkError(""); setStay(null); setSelectedPropertyId("");
    if (!publicToken) { setLinkError("Ask reception for a property feedback link."); setLoading(false); return; }
    fetch(`/api/stays/${encodeURIComponent(publicToken)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json.success || !json.data) throw new Error(json.error || "This feedback link is unavailable.");
        if (controller.signal.aborted) return;
        const details = json.data as GuestStayDetails;
        setStay(details); setSelectedPropertyId(details.propertyId);
        setGuestName(details.guestName || ""); setRoomNumber(details.roomNumber || "");
        setIsDemoMode(details.demo === true);
        if (departments.some(item => item.value === details.department)) setDepartment(details.department as DepartmentType);
      })
      .catch(error => { if (!controller.signal.aborted) setLinkError(error.message || "Could not load the feedback form."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [publicToken]);

  useEffect(()=>{
    setQuestions([]);setAnswers({});setQuestionsProperty("");setQuestionsError("");
    if(!selectedPropertyId)return;
    const controller=new AbortController();
    fetch("/api/questions?public=true&token="+encodeURIComponent(publicToken),{signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok||!body.success||!Array.isArray(body.questions))throw new Error("Could not load the feedback questions. Please retry.");return body;})
      .then(body=>{if(!controller.signal.aborted){setQuestions(body.questions);setQuestionsProperty(selectedPropertyId);}})
      .catch(error=>{if(!controller.signal.aborted)setQuestionsError(error.message||"Could not load feedback questions.");});
    return ()=>controller.abort();
  },[selectedPropertyId,publicToken,questionsRetry]);

  const activeQuestions = questions.filter(q => !q.department || q.department === department);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPropertyError(null);

    if (!selectedPropertyId) {
      setPropertyError("Open a valid property feedback link to continue.");
      return;
    }
    if (!rating) {
      setPropertyError("Please select an overall rating (1-5).");
      return;
    }
    if (!guestName.trim()) {
      setPropertyError("Please enter your name (Required).");
      const nameInput = document.getElementById("guest-name");
      nameInput?.focus();
      return;
    }
    if (!roomNumber.trim()) {
      setPropertyError("Please enter your room number, or 'NR' for non-resident (Required).");
      const roomInput = document.getElementById("guest-room");
      roomInput?.focus();
      return;
    }
    if(questionsProperty!==selectedPropertyId){setPropertyError(questionsError||"Please wait for the feedback questions to load.");return;}
    if(activeQuestions.some(q=>q.is_required&&!answers[q.id]?.trim())){setPropertyError("Please answer the required questions.");return;}
    if(isDemoMode){setSubmitted(true);return;}

    setSubmitting(true);
    try {
      const answersPayload = activeQuestions
        .map((q) => ({
          questionId: q.id,
          questionText: q.question_text,
          answerValue: answers[q.id] || "",
        }))
        .filter((a) => a.answerValue && a.answerValue.trim().length > 0);

      const finalEmail = (wantsContact && contactPreference === "email" ? contactValue : guestEmail).trim() || undefined;
      const finalPhone = (wantsContact && contactPreference === "phone" ? contactValue : guestPhone).trim() || undefined;

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          propertyId: selectedPropertyId,
          guestName: guestName.trim() || undefined,
          roomNumber: roomNumber.trim() || undefined,
          department,
          rating,
          recommendationScore:activeQuestions.some(q=>q.question_type==="nps")?null:recommendationScore,
          comment: comment.trim() || undefined,
          answers: answersPayload,
          wantsContact,
          contactPreference: wantsContact ? contactPreference : undefined,
          guestEmail: finalEmail,
          guestPhone: finalPhone,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else setPropertyError(json.error||"Could not submit feedback. Please try again.");
    } catch (err) {
      console.error("Failed to submit feedback", err);
      setPropertyError("Could not submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const progressStep = !selectedPropertyId ? 1 : !rating ? 2 : 3;
  const ratingWord = rating === 1 ? "Needs work" : rating === 2 ? "Fair" : rating === 3 ? "Good" : rating === 4 ? "Very good" : rating === 5 ? "Exceptional" : "";
  const selectedProperty = stay ? { id: stay.propertyId, name: stay.propertyName, code: stay.propertyCode } : null;
  const managerFollowUp = rating !== null && (rating <= 3 || wantsContact);

  if (!loading && linkError) return <main className="guest-shell"><section className="guest-card" role="alert"><h1>Feedback form unavailable</h1><p>{linkError}</p><p>Ask the front desk for a current feedback link.</p><button className="button button-outline" onClick={()=>window.location.reload()}>Try again</button></section></main>;

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
          <h1>{isDemoMode?"Demo complete":<>Your feedback is<br /><em>with our team.</em></>}</h1>
          <p>
            {isDemoMode?"This was a preview. No feedback was saved.":`We received this note${roomNumber.trim() ? " for "+roomNumber.trim() : ""}${selectedProperty ? " at "+selectedProperty.name.trim() : ""}.`}
          </p>
          <dl className="guest-receipt">
            {selectedProperty && <div><dt>Property</dt><dd>{selectedProperty.name}</dd></div>}
            <div><dt>Rating</dt><dd>{rating} · {ratingWord}</dd></div>
            <div><dt>Area</dt><dd>{department}</dd></div>
            {roomNumber.trim() && <div><dt>Room</dt><dd>{roomNumber.trim()}</dd></div>}
            {guestName.trim() && <div><dt>Name</dt><dd>{guestName.trim()}</dd></div>}
            {guestEmail.trim() && <div><dt>Email</dt><dd>{guestEmail.trim()}</dd></div>}
            {guestPhone.trim() && <div><dt>Mobile</dt><dd>{guestPhone.trim()}</dd></div>}
            {comment.trim() && <div><dt>Note</dt><dd>{comment.trim()}</dd></div>}
          </dl>
          {managerFollowUp && !isDemoMode && (
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
    <main className="guest-shell" style={stay?.accentColor ? { "--guest-accent": stay.accentColor, "--guest-accent-ink": contrastRatio(stay.accentColor,"#ffffff") >= 4.5 ? "#ffffff" : "#111827" } as React.CSSProperties : undefined}>
      <div className="guest-card">
        <div className="guest-top">
          <Link href="/" title="Vistora Home" style={{ display: "inline-flex", alignItems: "center" }}>
            <Image
              src="/vistora_wordmark_green.webp"
              alt="Vistora"
              width={120}
              height={29}
              className="brand-logo-light"
              priority
              style={{ height: "26px", width: "auto", objectFit: "contain" }}
            />
            <Image
              src="/vistora_wordmark_white.webp"
              alt="Vistora"
              width={120}
              height={29}
              className="brand-logo-dark"
              priority
              style={{ height: "26px", width: "auto", objectFit: "contain" }}
            />
          </Link>
        </div>
        {selectedProperty && <p className="guest-intro"><strong>{selectedProperty.name}</strong>{selectedProperty.code ? ` · ${selectedProperty.code}` : ""}</p>}
        <div className="guest-progress" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={progressStep} aria-label={`Step ${progressStep} of 3`}>
          <span className={progressStep > 1 ? "done" : "current"} />
          <span className={progressStep > 2 ? "done" : progressStep === 2 ? "current" : ""} />
          <span className={progressStep === 3 ? "current" : ""} />
        </div>
        <ol className="guest-progress-labels">
          <li className={progressStep > 1 ? "done" : "current"}>Your link</li>
          <li className={progressStep > 2 ? "done" : progressStep === 2 ? "current" : ""}>Rating</li>
          <li className={progressStep === 3 ? "current" : ""}>Note</li>
        </ol>

        {stay?.isStayLink && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              background: "rgba(197, 160, 89, 0.08)",
              border: "1px solid rgba(197, 160, 89, 0.22)",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "12px",
              color: "var(--ink)",
            }}
          >
            <span style={{ color: "var(--gold)", fontWeight: 700 }}>★</span>
            <span>
              Verified guest link for <strong>{stay.guestName || "Guest"}</strong>
              {stay.roomNumber ? ` · Room ${stay.roomNumber}` : ""}
              {stay.propertyName ? ` · ${stay.propertyName}` : ""}
            </span>
          </div>
        )}

        <h1>{stay?.questionnaireTitle || <>How did we make<br /><em>you feel?</em></>}</h1>
        <p className="guest-intro">
          {stay?.introduction ?? "Your perspective helps our hospitality team tailor every arrival."}
        </p>

        <form onSubmit={handleSubmit}>
          {propertyError && <p className="guest-error" role="alert">{propertyError}</p>}

          {!activeQuestions.some(q=>q.question_type==="nps")&&<fieldset className="guest-recommendation"><legend>Would you recommend your stay? <span>Optional</span></legend><div className="nps-input" role="group" aria-label="Recommendation score, 0 to 10">{Array.from({length:11},(_,n)=><button type="button" key={n} aria-pressed={recommendationScore===n} onClick={()=>setRecommendationScore(recommendationScore===n?null:n)} aria-label={`${n} out of 10`}>{n}</button>)}</div><div className="guest-score-ends"><span>Not likely</span><span>Extremely likely</span></div></fieldset>}
          {/* Rating */}
          <fieldset>
            <legend>
              {department === "Housekeeping"
                ? "How would you rate housekeeping & room cleanliness?"
                : department === "Spa & Wellness"
                ? "How would you rate your spa & wellness experience?"
                : department === "Facilities & Room"
                ? "How would you rate our hotel facilities & amenities?"
                : "How would you rate your experience overall?"}
              <strong className="guest-required" style={{ marginLeft: "4px" }}>*</strong>
            </legend>
            <div className="guest-star-rating" role="group" aria-label="Overall star rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`guest-star-button ${rating!==null&&value<=rating?"filled":""}`}
                  aria-pressed={rating===value}
                  onClick={() => {
                    setRating(value);
                    if (propertyError) setPropertyError(null);
                  }}
                  aria-label={`${value} out of 5`}
                >
                  <Star size={32} strokeWidth={1.5} aria-hidden="true"/>
                </button>
              ))}
            </div><p className="guest-star-caption" aria-live="polite">{rating?`${rating} of 5 · ${ratingWord}`:"Tap a star to rate your stay"}</p>
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
                value: dep.value,
                label: dep.label,
                detail: dep.detail,
              }))}
            />
          </div>

          {/* Guest Identity Details (Name, Room, Email, Mobile) */}
          <div className="guest-identity-group" style={{ marginBottom: "20px" }}>
            <div className="guest-split" style={{ marginBottom: "12px" }}>
              <div>
                <label className="field-label" htmlFor="guest-name">
                  <span>Your name <strong className="guest-required">*</strong></span>
                </label>
                <input
                  id="guest-name"
                  type="text"
                  value={guestName}
                  readOnly={!!stay?.guestName}
                  onChange={(e) => {
                    setGuestName(e.target.value);
                    if (propertyError) setPropertyError(null);
                  }}
                  placeholder="Your full name"
                  className={`guest-field${propertyError && !guestName.trim() ? " has-error" : ""}`}
                  autoComplete="name"
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="guest-room">
                  <span>Room or location <strong className="guest-required">*</strong></span>
                </label>
                <input
                  id="guest-room"
                  type="text"
                  value={roomNumber}
                  readOnly={!!stay?.roomNumber}
                  onChange={(e) => {
                    setRoomNumber(e.target.value);
                    if (propertyError) setPropertyError(null);
                  }}
                  placeholder="e.g. 304 or NR if non-resident"
                  className={`guest-field${propertyError && !roomNumber.trim() ? " has-error" : ""}`}
                  required
                />
                <small style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "var(--muted)" }}>
                  {stay?.isStayLink ? "Guest and room details are linked to this feedback invitation." : <>Enter room number, or &quot;NR&quot; if you are a non-resident / day guest.</>}
                </small>
              </div>
            </div>

            <div className="guest-split" style={{ marginBottom: "0" }}>
              <div>
                <label className="field-label" htmlFor="guest-email">
                  Email address <span>Optional</span>
                </label>
                <input
                  id="guest-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGuestEmail(val);
                    if (wantsContact && contactPreference === "email") {
                      setContactValue(val);
                    }
                  }}
                  placeholder="e.g. guest@example.com"
                  className="guest-field"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="guest-phone">
                  Mobile number <span>Optional</span>
                </label>
                <input
                  id="guest-phone"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGuestPhone(val);
                    if (wantsContact && contactPreference === "phone") {
                      setContactValue(val);
                    }
                  }}
                  placeholder="e.g. +1 555 0192"
                  className="guest-field"
                  autoComplete="tel"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Questionnaire Questions */}
          {activeQuestions.length > 0 && (
            <div className="guest-question-block">
              {activeQuestions.map((q) => (
                <div key={q.id} className="guest-question">
                  <label className="guest-question-label">
                    {q.question_text}
                    {q.is_required && <span className="guest-required">*</span>}
                  </label>

                  {["choice","multi_choice","dropdown","emoji","touchpoint"].includes(q.question_type) && q.options && q.options.length > 0 && (
                    <div className="guest-choice-row">
                      {q.options.map((opt) => {
                        const isSelected = q.question_type==="multi_choice"?multiChoices(answers[q.id]||"").includes(opt):answers[q.id] === opt;
                        return (
                          <button
                            type="button"
                            key={opt}
                            className={`guest-choice${isSelected ? " selected" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: q.question_type==="multi_choice"?toggleMultiChoice(prev[q.id]||"",opt):isSelected ? "" : opt }))}
                          >
                            {isSelected && <span style={{ marginRight: "6px", fontWeight: 700 }}>✓</span>}
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
                            {isSelected && <span style={{ marginRight: "6px", fontWeight: 700 }}>✓</span>}
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

                  {["nps","csat"].includes(q.question_type)&&<div className="nps-input">{Array.from({length:q.question_type==="nps"?11:10},(_,i)=>q.question_type==="nps"?i:i+1).map(n=><button type="button" key={n} aria-pressed={answers[q.id]===String(n)} onClick={()=>setAnswers(prev=>({...prev,[q.id]:String(n)}))}>{n}</button>)}</div>}
                  {["text","long_text"].includes(q.question_type) && (
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
            placeholder={
              department === "Housekeeping"
                ? "Share notes on room cleanliness, turn-down service, linen, or housekeeping staff…"
                : department === "Spa & Wellness"
                ? "Share your experience with spa treatments, relaxation facilities, or wellness therapists…"
                : department === "Facilities & Room"
                ? "Share notes on room fixtures, air conditioning, plumbing, or facility maintenance…"
                : "Share a moment, a colleague who assisted you, or something we could improve…"
            }
            rows={4}
          />

          {/* Contact Checkbox & Details */}
          <label className="check-row">
            <input
              type="checkbox"
              checked={wantsContact}
              onChange={(e) => {
                const checked = e.target.checked;
                setWantsContact(checked);
                if (checked) {
                  if (contactPreference === "email" && guestEmail.trim()) {
                    setContactValue(guestEmail.trim());
                  } else if (contactPreference === "phone" && guestPhone.trim()) {
                    setContactValue(guestPhone.trim());
                  }
                }
              }}
            />
            <span>I’d like a manager to follow up with me regarding this feedback.</span>
          </label>

          {wantsContact && (
            <div className="guest-followup">
              <label className="field-label" style={{ marginBottom: "8px", fontWeight: 600 }}>
                Preferred follow-up channel
              </label>
              <div className="guest-choice-row" style={{ marginBottom: "14px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                <label className="guest-radio" style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="radio"
                    name="pref"
                    checked={contactPreference === "email"}
                    onChange={() => {
                      setContactPreference("email");
                      if (guestEmail.trim()) {
                        setContactValue(guestEmail.trim());
                      }
                    }}
                  />
                  <span>Follow-up via Email</span>
                </label>
                <label className="guest-radio" style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="radio"
                    name="pref"
                    checked={contactPreference === "phone"}
                    onChange={() => {
                      setContactPreference("phone");
                      if (guestPhone.trim()) {
                        setContactValue(guestPhone.trim());
                      }
                    }}
                  />
                  <span>Follow-up via Mobile number</span>
                </label>
              </div>

              <div>
                <label className="field-label" htmlFor="followup-contact-input" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span>{contactPreference === "email" ? "Follow-up email address" : "Follow-up mobile number"}</span>
                  {((contactPreference === "email" && guestEmail.trim() && contactValue === guestEmail.trim()) ||
                    (contactPreference === "phone" && guestPhone.trim() && contactValue === guestPhone.trim())) && (
                    <span style={{ color: "var(--sage-deep)", fontSize: "11px", fontWeight: 500 }}>
                      ✓ Auto-filled from above
                    </span>
                  )}
                </label>
                <input
                  id="followup-contact-input"
                  className="guest-field"
                  type={contactPreference === "email" ? "email" : "tel"}
                  value={contactValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContactValue(val);
                    if (contactPreference === "email" && !guestEmail.trim()) {
                      setGuestEmail(val);
                    } else if (contactPreference === "phone" && !guestPhone.trim()) {
                      setGuestPhone(val);
                    }
                  }}
                  placeholder={contactPreference === "email" ? "your.email@example.com" : "+1 555 0192"}
                  required={wantsContact}
                />
              </div>
            </div>
          )}

          {questionsError&&<p role="alert">{questionsError} <button type="button" className="button button-ghost" onClick={()=>setQuestionsRetry(n=>n+1)}>Retry questions</button></p>}
          {selectedPropertyId&&questionsProperty!==selectedPropertyId&&!questionsError&&<p role="status">Loading feedback questions…</p>}
          <button
            className="button button-dark submit-button"
            disabled={!rating || !selectedPropertyId || !guestName.trim() || !roomNumber.trim() || submitting || questionsProperty!==selectedPropertyId}
          >
            {submitting ? "Submitting..." : "Send feedback"} <span>→</span>
          </button>
          {(!selectedPropertyId || !rating || !guestName.trim() || !roomNumber.trim()) && (
            <p className="guest-hint">
              {!selectedPropertyId
                ? "Open a valid property feedback link to continue."
                : !rating
                ? "Please select an overall rating (1-5) above."
                : !guestName.trim()
                ? "Please enter your name above (Required)."
                : !roomNumber.trim()
                ? "Please enter your room number or NR above (Required)."
                : ""}
            </p>
          )}
        </form>

        <p className="privacy-note">
          Your feedback is sent to the team at the property shown above.{" "}
          <a href="#privacy">Privacy notice</a>
        </p>
      </div>
    </main>
  );
}
