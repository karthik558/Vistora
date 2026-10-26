import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import ThemeToggle from "../components/ThemeToggle";
import { ArrowRight, CheckCircle2, MessageCircleMore, ChartNoAxesCombined, TimerReset, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("vistora-user")?.value;
  let isLoggedIn = false;

  if (userCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(userCookie));
      if (parsed?.email) isLoggedIn = true;
    } catch {
      if (userCookie.includes("@")) isLoggedIn = true;
    }
  }

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link href="/" className="landing-logo" title="Vistora Home">
          <Image src="/vistora_wordmark_green.webp" alt="Vistora" width={140} height={34} className="brand-logo-light" priority />
          <Image src="/vistora_wordmark_white.webp" alt="Vistora" width={140} height={34} className="brand-logo-dark" priority />
        </Link>
        <div className="landing-header-actions">
          <ThemeToggle />
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="button button-outline compact">
            {isLoggedIn ? "Dashboard" : "Sign in"}<ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">Guest experience operations</p>
          <h1>Turn every stay into a <em>lasting impression.</em></h1>
          <p className="landing-copy">
            One workspace for guest feedback, hotel operations and the teams behind every stay.
          </p>
          <div className="landing-actions">
            <Link className="button button-dark landing-primary" href={isLoggedIn ? "/dashboard" : "/login"}>
              {isLoggedIn ? "Open workspace" : "Access workspace"}<ArrowRight size={16} />
            </Link>
            <span className="landing-assurance"><CheckCircle2 size={15} /> Built for hospitality teams</span>
          </div>
        </div>

        <div className="landing-graph-card" aria-label="Guest experience workflow graph">
          <div className="landing-graph-head">
            <div><span>Experience signal</span><strong>From feedback to recommendation</strong></div>
            <span className="live-pill"><i /> Live workflow</span>
          </div>
          <div className="landing-graph-plot">
            <span className="graph-grid-line line-one" />
            <span className="graph-grid-line line-two" />
            <span className="graph-grid-line line-three" />
            <svg viewBox="0 0 500 200" preserveAspectRatio="none" role="img" aria-label="Rising response workflow curve">
              <defs>
                <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              <path className="landing-area" d="M0 160 C50 155 70 148 100 136 C155 116 195 120 240 104 C290 84 325 72 370 56 C415 38 450 24 480 20 L500 18 L500 200 L0 200 Z" />
              <path className="landing-line" d="M0 160 C50 155 70 148 100 136 C155 116 195 120 240 104 C290 84 325 72 370 56 C415 38 450 24 480 20 L500 18" />
            </svg>
            <span className="graph-marker" style={{ left: "20%", top: "68%" }} title="Feedback captured" />
            <span className="graph-marker" style={{ left: "48%", top: "52%" }} title="Triage & Understand" />
            <span className="graph-marker" style={{ left: "74%", top: "28%" }} title="Service Recovery" />
            <span className="graph-marker marker-active" style={{ left: "96%", top: "10%" }} title="Advocate & Recommend" />
          </div>
          <div className="landing-graph-steps">
            <span><MessageCircleMore size={15} /> Feedback</span>
            <span><ChartNoAxesCombined size={15} /> Understand</span>
            <span><TimerReset size={15} /> Recover</span>
            <span><CheckCircle2 size={15} /> Recommend</span>
          </div>
          <div className="landing-insight-row">
            <div><span>01</span><p><strong>Centralized signals</strong><small>Feedback, forms, and invitations</small></p></div>
            <div><span>02</span><p><strong>Clear ownership</strong><small>Teams, SLA, and resolution status</small></p></div>
          </div>
        </div>
      </section>

      <section className="landing-modules" aria-label="Explore Vistora">
        <article><MessageCircleMore size={21} strokeWidth={1.75}/><div><h2>Guest feedback</h2><p>Collect responses, understand ratings and follow up on guest concerns.</p></div></article>
        <article><Building2 size={21} strokeWidth={1.75}/><div><h2>Hotel operations</h2><p>Coordinate guest stays, room readiness, service jobs and inspections.</p></div></article>
      </section>
      <footer className="landing-foot">
        <span>© 2026 Vistora. All rights reserved.</span>
      </footer>
    </main>
  );
}
