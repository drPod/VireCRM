import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "TENANT_SCOPE_INVALID"
  | "TENANT_UNKNOWN"
  | "TENANT_CLAIM_MISSING"
  | "TENANT_MISMATCH"
  | "CUSTOMER_PORTAL_NOT_ALLOWED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "INTERNAL";

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  INVALID_CREDENTIALS: "Invalid or missing credentials.",
  TENANT_SCOPE_INVALID: "Request host is not a valid tenant scope.",
  TENANT_UNKNOWN: "Tenant not found.",
  TENANT_CLAIM_MISSING: "Token does not carry a tenant claim.",
  TENANT_MISMATCH: "Token tenant does not match request host.",
  CUSTOMER_PORTAL_NOT_ALLOWED: "Customer-portal tokens cannot access broker routes.",
  VALIDATION: "Request validation failed.",
  NOT_FOUND: "Resource not found.",
  INTERNAL: "Internal error.",
};

// Structured error response. Never echoes claim values or expected hosts —
// 403 paths must not leak whether the mismatched side was the host or the token.
export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  details?: unknown,
) {
  return c.json(
    {
      error: { code, message: DEFAULT_MESSAGES[code], ...(details !== undefined && { details }) },
      requestId: c.get("requestId") ?? "",
    },
    status,
  );
}
