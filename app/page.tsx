import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, CheckCircle2, MessageCircleMore, ChartNoAxesCombined, TimerReset } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

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
          <Image src="/logo1.webp" alt="Vistora" width={150} height={40} priority />
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
            Give hospitality teams one calm, intelligent workspace to listen, resolve, and elevate every guest moment.
          </p>
          <div className="landing-actions">
            <Link className="button button-dark landing-primary" href={isLoggedIn ? "/dashboard" : "/login"}>
              {isLoggedIn ? "Open workspace" : "Access workspace"}<ArrowRight size={16} />
            </Link>
            <span className="landing-assurance"><CheckCircle2 size={15} /> Built for service recovery</span>
          </div>
        </div>

        <div className="landing-graph-card" aria-label="Guest experience workflow graph">
          <div className="landing-graph-head">
            <div><span>Experience signal</span><strong>From feedback to recovery</strong></div>
            <span className="live-pill"><i /> Live workflow</span>
          </div>
          <div className="landing-graph-plot">
            <span className="graph-grid-line line-one" />
            <span className="graph-grid-line line-two" />
            <span className="graph-grid-line line-three" />
            <svg viewBox="0 0 560 220" preserveAspectRatio="none" role="img" aria-label="Rising response workflow curve">
              <defs>
                <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="landing-area" d="M0 184 C70 170 92 178 145 139 C205 94 235 147 292 106 C352 61 388 100 438 58 C482 22 520 49 560 18 L560 220 L0 220 Z" />
              <path className="landing-line" d="M0 184 C70 170 92 178 145 139 C205 94 235 147 292 106 C352 61 388 100 438 58 C482 22 520 49 560 18" />
              <circle cx="145" cy="139" r="6" /><circle cx="292" cy="106" r="6" /><circle cx="438" cy="58" r="6" /><circle cx="560" cy="18" r="6" />
            </svg>
          </div>
          <div className="landing-graph-steps">
            <span><MessageCircleMore size={15} /> Capture</span>
            <span><ChartNoAxesCombined size={15} /> Understand</span>
            <span><TimerReset size={15} /> Recover</span>
            <span><CheckCircle2 size={15} /> Retain</span>
          </div>
          <div className="landing-insight-row">
            <div><span>01</span><p><strong>Centralized signals</strong><small>Feedback, forms, and invitations</small></p></div>
            <div><span>02</span><p><strong>Clear ownership</strong><small>Teams, SLA, and resolution status</small></p></div>
          </div>
        </div>
      </section>

      <footer className="landing-foot">
        <span>© Vistora 2026</span>
        <span>Guest experience, handled beautifully.</span>
      </footer>
    </main>
  );
}
