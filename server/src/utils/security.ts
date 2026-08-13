import { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Optional REST bearer-token auth.
// When API_AUTH_TOKEN is set, every /api request must present it via
// `Authorization: Bearer <token>`. When unset, auth is disabled so local dev
// and the demo flow keep working untouched.
// ---------------------------------------------------------------------------
const AUTH_TOKEN = process.env.API_AUTH_TOKEN || "";

function isAuthEnabled(): boolean {
  return AUTH_TOKEN.length > 0;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isAuthEnabled()) return next();

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token !== AUTH_TOKEN) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter (per IP). Purely defensive; sufficient
// for a single-node deployment. Swap for redis/express-rate-limit when scaling
// horizontally.
// ---------------------------------------------------------------------------
const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 300;
const buckets = new Map<string, number[]>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (hits.length >= MAX_REQUESTS) {
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return;
  }

  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup to avoid unbounded growth of the map.
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.length === 0) buckets.delete(k);
    }
  }

  next();
}

// ---------------------------------------------------------------------------
// WebSocket auth via `?token=...` on the upgrade URL. Must be checked before
// accepting a session because WS upgrades are not subject to CORS.
// ---------------------------------------------------------------------------
export function isWsAuthorized(url: string | undefined): boolean {
  if (!isAuthEnabled()) return true;
  if (!url) return false;
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("token") === AUTH_TOKEN;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CORS origins. Defaults to local dev origins; restrict via ALLOWED_ORIGINS
// (comma-separated) for deployments.
// ---------------------------------------------------------------------------
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000"
];

export function resolveAllowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (!env) return DEFAULT_ALLOWED_ORIGINS;
  return env
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}