import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const cookieStore = cookies();
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
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14vh" }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }} title="Vistora Home">
          <Image
            src="/logo1.webp"
            alt="Vistora"
            width={150}
            height={40}
            priority
            style={{ height: "36px", width: "auto", objectFit: "contain" }}
          />
        </Link>
        {isLoggedIn ? (
          <Link href="/dashboard" className="button button-dark compact">
            Dashboard <span>→</span>
          </Link>
        ) : (
          <Link href="/login" className="button button-dark compact">
            Sign In <span>→</span>
          </Link>
        )}
      </div>

      {/* Hero Content */}
      <p className="eyebrow">Guest experience operations</p>
      <h1>
        Turn every stay<br />
        <em>into a return visit.</em>
      </h1>
      <p className="landing-copy">
        A focused workspace for luxury hospitality teams to listen, resolve, and elevate the moments guests remember.
      </p>

      <div className="landing-actions" style={{ marginTop: "28px" }}>
        {isLoggedIn ? (
          <Link className="button button-dark" href="/dashboard">
            Open Operations Dashboard <span>→</span>
          </Link>
        ) : (
          <Link className="button button-dark" href="/login">
            Access workspace <span>→</span>
          </Link>
        )}
      </div>

      {/* Simple one-line footer text */}
      <div className="landing-foot" style={{ display: "flex", justifyContent: "center", textAlign: "center" }}>
        <span>Copyright © Vistora 2026. All rights reserved.</span>
      </div>
    </main>
  );
}