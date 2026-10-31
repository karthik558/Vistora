"use client";

import { useEffect, useRef, useState } from "react";
import {
  BedDouble,
  Flower2,
  Bath,
  UtensilsCrossed,
  Luggage,
  Car,
  Wifi,
  Clock,
  Phone,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  Star,
  Info,
  Waves,
  Dumbbell,
  Coffee,
  Bell,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  HeartHandshake,
} from "lucide-react";
import { Status } from "./OperationsUI";

export const SERVICE_ITEMS = [
  {
    value: "towels",
    title: "Fresh Linens & Towels",
    description: "Plush bath sheets, face towels, and fresh luxury bathmat.",
    department: "Housekeeping",
    eta: "~12-15 min",
    icon: BedDouble,
    badge: "Housekeeping",
  },
  {
    value: "toiletries",
    title: "Luxury Toiletries Kit",
    description: "Organic shampoo, conditioner, dental care, and grooming pack.",
    department: "Housekeeping",
    eta: "~12-15 min",
    icon: Bath,
    badge: "Amenities",
  },
  {
    value: "room_service",
    title: "In-Room Dining Assistance",
    description: "Fresh ice bucket, wine glasses, cutlery, or chef order support.",
    department: "Food & Beverage",
    eta: "~15-20 min",
    icon: UtensilsCrossed,
    badge: "F&B Service",
  },
  {
    value: "baggage",
    title: "Bellhop & Luggage Pickup",
    description: "Baggage collection from your room for checkout or transfer.",
    department: "Concierge",
    eta: "~10-15 min",
    icon: Luggage,
    badge: "Concierge",
  },
  {
    value: "valet",
    title: "Valet Vehicle Retrieval",
    description: "Have your vehicle prepared and brought to the main portico.",
    department: "Valet & Transfers",
    eta: "~8-10 min",
    icon: Car,
    badge: "Valet Portico",
  },
];

const ISSUE_TAGS = [
  "Air Conditioning / Climate",
  "Wi-Fi Speed & Connectivity",
  "Noise / Disturbance",
  "Room Cleanliness",
  "Plumbing & Hot Water",
  "Service Delay",
  "Other",
];

export default function GuestServicePortal({ token }: { token: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"services" | "pulse" | "guide">("services");
  
  // Wi-Fi copy state
  const [wifiCopied, setWifiCopied] = useState(false);

  // In-Stay Pulse Feedback state
  const [inStayRating, setInStayRating] = useState<number>(5);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [pulseComment, setPulseComment] = useState("");
  const [pulseBusy, setPulseBusy] = useState(false);
  const [pulseFeedbackSubmitted, setPulseFeedbackSubmitted] = useState(false);
  const [pulseMessage, setPulseMessage] = useState("");

  // Offline detection
  const [isOffline, setIsOffline] = useState(false);

  const lock = useRef(false);
  const pending = useRef<{ service: string; id: string } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (!navigator.onLine) setIsOffline(true);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function load() {
    const response = await fetch(
      "/api/guest-services/" + encodeURIComponent(token),
      { cache: "no-store" }
    );
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error || "Guest services are unavailable.");
    setData(body);
  }

  useEffect(() => {
    let active = true;
    load().catch((e) => {
      if (active) setError(e.message);
    });
    const timer = setInterval(() => {
      if (!document.hidden) load().catch(() => {});
    }, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token]);

  async function request(service: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(service);
    setError("");
    setMessage("");
    if (pending.current?.service !== service)
      pending.current = { service, id: crypto.randomUUID() };
    try {
      if (!navigator.onLine) throw new Error("Reconnect to send your request.");
      const response = await fetch(
        "/api/guest-services/" + encodeURIComponent(token),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service, requestId: pending.current.id }),
        }
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "The request was not sent.");
      pending.current = null;
      const item = SERVICE_ITEMS.find((s) => s.value === service);
      setMessage(
        `Your request for ${item?.title || service} has been sent to the ${item?.department || "hotel"} team.`
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy("");
    }
  }

  async function handlePulseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pulseBusy) return;
    setPulseBusy(true);
    setError("");
    setPulseMessage("");
    try {
      if (!navigator.onLine) throw new Error("Reconnect to send your feedback.");
      const response = await fetch(
        "/api/guest-services/" + encodeURIComponent(token),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pulse",
            rating: inStayRating,
            issues: selectedIssues,
            comment: pulseComment,
          }),
        }
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Feedback could not be submitted.");
      setPulseFeedbackSubmitted(true);
      setPulseMessage(body.message || "Thank you for sharing your feedback with the team.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPulseBusy(false);
    }
  }

  function copyWifi() {
    const pass = data?.wifi?.password || "vistora-luxury-stay";
    navigator.clipboard.writeText(pass);
    setWifiCopied(true);
    setTimeout(() => setWifiCopied(false), 2500);
  }

  function toggleIssue(tag: string) {
    setSelectedIssues((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <main className="ops-guest-portal platform-page">
      {/* Brand Header */}
      <header className="ops-portal-header">
        <div className="ops-portal-brand">
          <img src="/vistora_logo_blue.webp" alt="Vistora" width={140} />
          <span className="ops-luxury-pill">
            <ShieldCheck size={13} />
            In-Room Digital Concierge
          </span>
        </div>

        <div className="ops-portal-property-card">
          <div className="ops-property-meta">
            <p className="eyebrow">WELCOME TO</p>
            <h1>{data?.property || "Luxury Hotel & Residences"}</h1>
            {data && (
              <p className="ops-welcome-sub">
                {data.guestName ? `Welcome, ${data.guestName}` : "Welcome to your room"}
              </p>
            )}
          </div>
          {data && (
            <div className="ops-room-badge">
              <span className="ops-room-num">Room {data.room}</span>
              <span className="ops-status-dot" title="Active In-House Guest">
                <span className="ops-pulse-ring"></span>
                In-House Stay
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Network offline notice */}
      {isOffline && (
        <div className="platform-notice" role="alert" style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}>
          <AlertCircle size={16} />
          <strong>You are currently offline.</strong> Please reconnect to send requests.
        </div>
      )}

      {/* Error and Success banners */}
      {error && (
        <p className="platform-notice" role="alert">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      {message && (
        <p className="hotel-success" role="status">
          <CheckCircle2 size={16} />
          {message}
        </p>
      )}

      {!data && !error && (
        <div className="ops-loading-container" role="status">
          <RefreshCw className="ops-spin" size={24} />
          <p>Connecting to hotel services…</p>
        </div>
      )}

      {data && (
        <>
          {/* Top Segmented Navigation Tabs */}
          <nav className="ops-portal-nav" aria-label="Portal sections">
            <button
              type="button"
              className={`ops-nav-tab ${activeTab === "services" ? "active" : ""}`}
              onClick={() => setActiveTab("services")}
            >
              <Bell size={16} />
              <span>1-Touch Services</span>
            </button>
            <button
              type="button"
              className={`ops-nav-tab ${activeTab === "pulse" ? "active" : ""}`}
              onClick={() => setActiveTab("pulse")}
            >
              <Star size={16} />
              <span>In-Stay Pulse</span>
            </button>
            <button
              type="button"
              className={`ops-nav-tab ${activeTab === "guide" ? "active" : ""}`}
              onClick={() => setActiveTab("guide")}
            >
              <Wifi size={16} />
              <span>Hotel Info & Wi-Fi</span>
            </button>
          </nav>

          {/* TAB 1: 1-TOUCH SERVICES & AMENITIES */}
          {activeTab === "services" && (
            <section className="ops-tab-content">
              <div className="ops-section-intro">
                <h2>Room Amenities & Express Requests</h2>
                <p>Tap any item below to dispatch a service job directly to staff.</p>
              </div>

              <div className="ops-service-cards-grid">
                {SERVICE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isBusy = busy === item.value;
                  return (
                    <div key={item.value} className="ops-service-card">
                      <div className="ops-service-header">
                        <div className="ops-service-icon-box">
                          <Icon size={22} />
                        </div>
                        <div className="ops-service-badges">
                          <span className="ops-dept-tag">{item.badge}</span>
                          <span className="ops-eta-tag">
                            <Clock size={12} />
                            {item.eta}
                          </span>
                        </div>
                      </div>

                      <div className="ops-service-body">
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                      </div>

                      <button
                        type="button"
                        className="button button-dark ops-service-button"
                        disabled={!!busy || isOffline}
                        onClick={() => request(item.value)}
                      >
                        {isBusy ? (
                          <>
                            <RefreshCw className="ops-spin" size={15} />
                            Dispatching…
                          </>
                        ) : (
                          <>
                            Request {item.department.split(" ")[0]}
                            <ChevronRight size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Live Request Tracker */}
              <section className="platform-card ops-tracker-card">
                <div className="ops-tracker-header">
                  <div>
                    <h3>Your In-Room Requests</h3>
                    <p>Track live delivery status as our team attends to Room {data.room}.</p>
                  </div>
                  <button
                    type="button"
                    className="button button-ghost ops-mini-refresh"
                    onClick={() => load().catch(() => {})}
                    title="Refresh status"
                  >
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>

                {!data.requests?.length ? (
                  <div className="ops-empty-requests">
                    <CheckCircle2 size={24} />
                    <p>No active requests. Everything is all set for your room.</p>
                  </div>
                ) : (
                  <div className="ops-tracker-list">
                    {data.requests.map((r: any) => {
                      const item = SERVICE_ITEMS.find((s) => s.value === r.service);
                      const statusVal = r.service_jobs?.status || "open";
                      const dateStr = new Date(r.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <div key={r.id} className="ops-tracker-item">
                          <div className="ops-tracker-left">
                            <span className="ops-tracker-icon">
                              {item ? <item.icon size={18} /> : <Bell size={18} />}
                            </span>
                            <div>
                              <strong>{item?.title || r.service}</strong>
                              <small>
                                {item?.department} · Placed at {dateStr}
                              </small>
                            </div>
                          </div>
                          <div className="ops-tracker-status">
                            <Status value={statusVal} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </section>
          )}

          {/* TAB 2: IN-STAY PULSE FEEDBACK (Direct Recovery & Attention) */}
          {activeTab === "pulse" && (
            <section className="ops-tab-content">
              <div className="platform-card ops-pulse-card">
                <div className="ops-pulse-header">
                  <span className="ops-pulse-icon">
                    <HeartHandshake size={28} />
                  </span>
                  <div>
                    <h2>In-Stay Experience Check</h2>
                    <p>
                      How is your stay going in Room {data.room}? Let our Duty Manager know
                      immediately so we can make it flawless.
                    </p>
                  </div>
                </div>

                {pulseFeedbackSubmitted ? (
                  <div className="ops-pulse-thankyou">
                    <CheckCircle2 size={42} style={{ color: "var(--sage)" }} />
                    <h3>Thank you for letting us know</h3>
                    <p>{pulseMessage}</p>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => {
                        setPulseFeedbackSubmitted(false);
                        setPulseComment("");
                        setSelectedIssues([]);
                      }}
                      style={{ marginTop: "16px" }}
                    >
                      Submit another note
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handlePulseSubmit} className="ops-pulse-form">
                    <div className="ops-star-rating-box">
                      <label>Overall Experience Today</label>
                      <div className="ops-stars-row">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            className={`ops-star-btn ${inStayRating >= star ? "filled" : ""}`}
                            onClick={() => setInStayRating(star)}
                            aria-label={`${star} star`}
                          >
                            <Star size={30} />
                          </button>
                        ))}
                      </div>
                      <span className="ops-rating-hint">
                        {inStayRating === 5 && "⭐ Exceptional • Everything is wonderful"}
                        {inStayRating === 4 && "⭐ Very Good • Enjoying our time"}
                        {inStayRating === 3 && "⭐ Average • A few areas could improve"}
                        {inStayRating === 2 && "⭐ Disappointed • Need staff attention"}
                        {inStayRating === 1 && "⭐ Urgent Issue • Please attend to Room " + data.room}
                      </span>
                    </div>

                    {inStayRating <= 4 && (
                      <div className="ops-issue-tag-container">
                        <label>What can we attend to? (Optional)</label>
                        <div className="ops-issue-chips">
                          {ISSUE_TAGS.map((tag) => (
                            <button
                              type="button"
                              key={tag}
                              className={`ops-chip ${selectedIssues.includes(tag) ? "selected" : ""}`}
                              onClick={() => toggleIssue(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="ops-pulse-input-group">
                      <label htmlFor="pulse-comment">
                        Notes for the Duty Manager (Optional)
                      </label>
                      <textarea
                        id="pulse-comment"
                        rows={3}
                        maxLength={1000}
                        placeholder={
                          inStayRating <= 3
                            ? "Tell us what happened so we can resolve it right now…"
                            : "Share any special preferences or compliments for the team…"
                        }
                        value={pulseComment}
                        onChange={(e) => setPulseComment(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={pulseBusy || isOffline}
                      className="button button-dark ops-submit-pulse"
                    >
                      {pulseBusy ? (
                        <>
                          <RefreshCw className="ops-spin" size={16} />
                          Routing to Duty Manager…
                        </>
                      ) : (
                        <>
                          Send to Duty Manager
                          <ChevronRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </section>
          )}

          {/* TAB 3: HOTEL COMPENDIUM & WI-FI */}
          {activeTab === "guide" && (
            <section className="ops-tab-content">
              {/* Wi-Fi Card */}
              <div className="platform-card ops-wifi-card">
                <div className="ops-wifi-header">
                  <div className="ops-wifi-icon-badge">
                    <Wifi size={24} />
                  </div>
                  <div>
                    <h3>High-Speed Guest Wi-Fi</h3>
                    <p>Complimentary ultra-fast connection for all your devices.</p>
                  </div>
                </div>

                <div className="ops-wifi-details">
                  <div className="ops-wifi-field">
                    <span>Network (SSID)</span>
                    <strong>{data?.wifi?.ssid || "Vistora-Guest-HighSpeed"}</strong>
                  </div>
                  <div className="ops-wifi-field">
                    <span>Password</span>
                    <code>{data?.wifi?.password || "vistora-luxury-stay"}</code>
                  </div>
                  <button
                    type="button"
                    className="button button-dark ops-copy-btn"
                    onClick={copyWifi}
                  >
                    {wifiCopied ? (
                      <>
                        <Check size={16} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Copy Password
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Hotel Amenities & Timings */}
              <div className="platform-card ops-compendium-card">
                <h3>Hotel Hours & Facilities</h3>
                <div className="ops-amenities-list">
                  <div className="ops-amenity-row">
                    <Coffee size={20} className="ops-amenity-icon" />
                    <div>
                      <strong>Breakfast Buffet</strong>
                      <p>Terrace Bistro (Level 1) · 07:00 AM – 10:30 AM</p>
                    </div>
                  </div>
                  <div className="ops-amenity-row">
                    <Waves size={20} className="ops-amenity-icon" />
                    <div>
                      <strong>Rooftop Infinity Pool</strong>
                      <p>Level 5 · 06:00 AM – 10:00 PM (Towels provided at pool desk)</p>
                    </div>
                  </div>
                  <div className="ops-amenity-row">
                    <Dumbbell size={20} className="ops-amenity-icon" />
                    <div>
                      <strong>24/7 Fitness Center</strong>
                      <p>Level 2 · 24 Hours (Tap room keycard for access)</p>
                    </div>
                  </div>
                  <div className="ops-amenity-row">
                    <Flower2 size={20} className="ops-amenity-icon" />
                    <div>
                      <strong>Vistora Spa & Wellness</strong>
                      <p>Mezzanine Floor · 09:00 AM – 08:00 PM (Appointments via Concierge)</p>
                    </div>
                  </div>
                  <div className="ops-amenity-row">
                    <Clock size={20} className="ops-amenity-icon" />
                    <div>
                      <strong>Check-out Time</strong>
                      <p>Standard Check-out is 11:00 AM. Late check-out by request.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Reception Assistance */}
              <div className="platform-card ops-help-card">
                <div className="ops-help-content">
                  <Phone size={24} />
                  <div>
                    <h4>Need Direct Staff Assistance?</h4>
                    <p>
                      Dial <strong>0</strong> from your in-room landline for Reception or{" "}
                      <strong>4</strong> for In-Room Dining.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Footer note */}
          <footer className="ops-portal-footer">
            <p>
              <Info size={14} />
              For medical or immediate safety emergencies, dial <strong>9</strong> or contact the front desk directly.
            </p>
          </footer>
        </>
      )}
    </main>
  );
}
