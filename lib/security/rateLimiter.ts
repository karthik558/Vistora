/**
 * In-memory sliding-window Rate Limiter for Next.js API and Edge Middleware.
 * Provides granular rate limits by IP and route tier to defend against brute force,
 * credential stuffing, denial of service, and automated scraping.
 */

interface RateLimitRecord {
  timestamps: number[];
}

interface TierConfig {
  maxRequests: number;
  windowMs: number;
}

const TIER_CONFIGS: Record<string, TierConfig> = {
  // Strictest: Authentication & credentials (5 attempts per minute)
  auth: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
  // Public submissions: Feedback & question responses (15 per minute)
  submission: {
    maxRequests: 15,
    windowMs: 60 * 1000,
  },
  // General operational APIs: 60 per minute
  api: {
    maxRequests: 60,
    windowMs: 60 * 1000,
  },
  // Default fallback: 100 per minute
  default: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
};

// Map of [key: `${tier}:${ip}`] -> timestamps
const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic garbage collection every 5 minutes
const GC_INTERVAL_MS = 5 * 60 * 1000;
let lastGcTime = Date.now();

function performGarbageCollection(now: number) {
  if (now - lastGcTime < GC_INTERVAL_MS) return;
  lastGcTime = now;

  const maxRetentionWindow = 60 * 1000 * 10; // 10 minutes
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < maxRetentionWindow);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  ip: string,
  tier: "auth" | "submission" | "api" | "default" = "api"
): RateLimitResult {
  const now = Date.now();
  performGarbageCollection(now);

  const config = TIER_CONFIGS[tier] || TIER_CONFIGS.default;
  const storeKey = `${tier}:${ip || "unknown"}`;

  let record = rateLimitStore.get(storeKey);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(storeKey, record);
  }

  // Filter out timestamps outside the active sliding window
  const windowStart = now - config.windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const resetTime = oldestTimestamp + config.windowMs;
    const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));

    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: Math.ceil(resetTime / 1000),
      retryAfterSeconds: retryAfter,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - record.timestamps.length,
    reset: Math.ceil((now + config.windowMs) / 1000),
  };
}

/**
 * Helper to extract client IP address accurately from standard reverse-proxy headers.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  return "127.0.0.1";
}
