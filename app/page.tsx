import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <div className="landing-mark">V</div>
      <p className="eyebrow">Vistora / guest experience operations</p>
      <h1>Turn every stay<br /><em>into a return visit.</em></h1>
      <p className="landing-copy">A focused workspace for hospitality teams to listen, respond, and improve the details guests remember.</p>
      <div className="landing-actions">
        <Link className="button button-dark" href="/dashboard">Open operations dashboard <span>↗</span></Link>
        <Link className="text-link" href="/feedback/demo-stay">Preview guest feedback flow <span>→</span></Link>
      </div>
      <div className="landing-foot"><span>Designed for calm, decisive service recovery.</span><span>Demo environment · Synthetic data</span></div>
    </main>
  );
}