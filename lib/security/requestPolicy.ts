// Browsers send Origin / Fetch Metadata. Non-browser clients still require the
// endpoint's verified session, API key or scoped public token.
export function isAllowedMutation(request: { method: string; headers: Headers; nextUrl: { origin: string } }) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return origin !== "null" && new URL(origin).origin === request.nextUrl.origin; }
  catch { return false; }
}
