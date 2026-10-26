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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request.headers);

  // 1. RATE LIMITING FOR APIS
  if (pathname.startsWith("/api/")) {
    const origin=request.headers.get("origin");
    if(!["GET","HEAD","OPTIONS"].includes(request.method)&&origin&&(origin==="null"||new URL(origin).host!==(request.headers.get("host")||request.nextUrl.host)))return NextResponse.json({success:false,error:"Cross-origin requests are not allowed."},{status:403});
    let tier: "auth" | "submission" | "api" = "api";

    if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/signup") || pathname.startsWith("/api/users/password") || pathname.startsWith("/api/onboarding")) {
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

  // Refresh only authenticated browser sessions. Display cookies never authorize access.
  const headers = new Headers(request.headers);
  headers.set("x-vistora-path",pathname);
  let refreshed: any = null;
  const token=request.cookies.get("sb-access-token")?.value;
  const refresh=request.cookies.get("sb-refresh-token")?.value;
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/api/")) && (token || refresh)) {
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
    if(url&&key) {
      // Expiry is only a refresh hint. The API and server layout verify identity.
      let valid=false;
      try{valid=!!token&&JSON.parse(atob(token.split(".")[1])).exp>Date.now()/1000+60;}catch{}
      if(!valid&&refresh) {
        const res=await fetch(url+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:refresh})}).catch(()=>null);
        if(res?.ok) {
          refreshed=await res.json();
          request.cookies.set("sb-access-token",refreshed.access_token);
          request.cookies.set("sb-refresh-token",refreshed.refresh_token);
          headers.set("cookie",request.cookies.toString());
        }
      }
      if(pathname.startsWith("/dashboard")&&!valid&&!refreshed) return NextResponse.redirect(new URL("/login",request.url));
    }
  } else if(pathname.startsWith("/dashboard")) return NextResponse.redirect(new URL("/login",request.url));
  const response=NextResponse.next({request:{headers}});
  if(refreshed) {
    const options={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};
    response.cookies.set("sb-access-token",refreshed.access_token,{...options,maxAge:refreshed.expires_in});
    response.cookies.set("sb-refresh-token",refreshed.refresh_token,{...options,maxAge:2592000});
  }

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
