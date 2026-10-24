import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "./lib/security/rateLimiter";

// Paths exempt from authentication checks
const PUBLIC_PATHS = [
  "/login",
  "/feedback",
  "/favicon.ico",
  "/logo1.webp",
  "/_next",
  "/api/auth/login",
  "/api/feedback",
  "/api/questions",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request.headers);

  // 1. RATE LIMITING FOR APIS
  if (pathname.startsWith("/api/")) {
    let tier: "auth" | "submission" | "api" = "api";

    if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/users/password")) {
      tier = "auth";
    } else if (pathname.startsWith("/api/feedback") || (pathname.startsWith("/api/questions") && request.method === "POST")) {
      tier = "submission";
    }

    const rateLimit = checkRateLimit(ip, tier);

    if (!rateLimit.success) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Rate limit exceeded. Too many requests, please slow down.",
          retryAfter: rateLimit.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfterSeconds || 60),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimit.reset),
          },
        }
      );
    }
  }

  // 2. DASHBOARD AUTHENTICATION & ROLE-BASED ACCESS CONTROL
  if (pathname.startsWith("/dashboard")) {
    const userCookie = request.cookies.get("vistora-user")?.value;
    const sbToken = request.cookies.get("sb-access-token")?.value;

    // Check if user has an active session
    if (!userCookie && !sbToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based protection: /dashboard/users and /dashboard/properties are strictly admin-only
    if (pathname.startsWith("/dashboard/users") || pathname.startsWith("/dashboard/properties")) {
      let isAdmin = false;
      if (userCookie) {
        try {
          const parsed = JSON.parse(userCookie);
          if (parsed?.role === "admin") {
            isAdmin = true;
          }
        } catch {}
      }
      if (!isAdmin) {
        // Redirect non-admins safely to main dashboard
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  // 3. APPLY SECURITY HEADERS TO ALL RESPONSES
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
