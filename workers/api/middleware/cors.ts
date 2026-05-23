import { cors } from "hono/cors";

// First in the chain so OPTIONS preflight short-circuits before JWT verify —
// otherwise browsers would see 401 on preflight and never send the real request.
// Allow-list is intentionally broad: every broker tenant is a different
// subdomain of virecrm.com (and legacy majix.ai). Tighten if a CSRF-via-CORS
// surface ever lands.
const ALLOWED_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?virecrm\.com$/,
  /^https:\/\/([a-z0-9-]+\.)?majix\.ai$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return origin;
    return ALLOWED_PATTERNS.some((re) => re.test(origin)) ? origin : null;
  },
  allowHeaders: ["Authorization", "Content-Type", "apikey", "x-request-id"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposeHeaders: ["x-request-id"],
  credentials: true,
  maxAge: 600,
});
