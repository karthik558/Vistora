import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14vh" }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }} title="Vistora Home">
          <Image
            src="/logo.webp"
            alt="Vistora"
            width={150}
            height={40}
            priority
            style={{ height: "36px", width: "auto", objectFit: "contain" }}
          />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/dashboard" className="button button-outline compact">
            Dashboard <span>↗</span>
          </Link>
          <Link href="/login" className="button button-dark compact">
            Sign In <span>→</span>
          </Link>
        </div>
      </div>

      <p className="eyebrow">Vistora / guest experience operations</p>
      <h1>
        Turn every stay<br />
        <em>into a return visit.</em>
      </h1>
      <p className="landing-copy">
        A focused workspace for hospitality teams to listen, respond, and improve the details guests remember.
      </p>

      <div className="landing-actions">
        <Link className="button button-dark" href="/dashboard">
          Open operations dashboard <span>↗</span>
        </Link>
        <Link className="text-link" href="/feedback/demo-stay">
          Preview guest feedback flow <span>→</span>
        </Link>
        <Link className="text-link" href="/login">
          Switch operational role <span>→</span>
        </Link>
      </div>

      <div className="landing-foot">
        <span>Designed for calm, decisive service recovery.</span>
        <span>Luxury Hospitality Operations</span>
      </div>
    </main>
  );
}