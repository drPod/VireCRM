import { describe, expect, it } from "vitest";
import {
  classifySignInError,
  messageForTenantError,
} from "../app/lib/auth-errors";

describe("classifySignInError", () => {
  it("collapses invalid_credentials to generic copy", () => {
    const err = { code: "invalid_credentials", status: 400, message: "Invalid login credentials" };
    const { userMessage, opsError } = classifySignInError(err);
    expect(userMessage).toBe("Invalid email or password.");
    expect(opsError).toBe(err);
  });

  it("collapses email_not_confirmed to same generic copy (deny enumeration)", () => {
    const err = { code: "email_not_confirmed", status: 400, message: "Email not confirmed" };
    expect(classifySignInError(err).userMessage).toBe("Invalid email or password.");
  });

  it("matches by message when code is missing", () => {
    const err = { message: "Invalid login credentials" };
    expect(classifySignInError(err).userMessage).toBe("Invalid email or password.");
  });

  it("matches invalid_grant code variant", () => {
    expect(classifySignInError({ code: "invalid_grant" }).userMessage).toBe(
      "Invalid email or password.",
    );
  });

  it("maps HTTP 429 to rate-limit copy", () => {
    const err = { status: 429, message: "Too many requests" };
    expect(classifySignInError(err).userMessage).toMatch(/too many sign-in attempts/i);
  });

  it("maps over_request_rate_limit code to rate-limit copy", () => {
    expect(
      classifySignInError({ code: "over_request_rate_limit" }).userMessage,
    ).toMatch(/too many sign-in attempts/i);
  });

  it("maps TypeError: failed to fetch to network copy", () => {
    const err = new TypeError("Failed to fetch");
    expect(classifySignInError(err).userMessage).toMatch(/couldn't reach/i);
  });

  it("maps AbortError to network copy", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(classifySignInError(err).userMessage).toMatch(/couldn't reach/i);
  });

  it("falls back to generic copy for unknown errors", () => {
    expect(classifySignInError(new Error("whatever")).userMessage).toBe(
      "Sign-in failed. Please try again.",
    );
  });

  it("falls back to generic copy for non-Error values", () => {
    expect(classifySignInError("string").userMessage).toBe(
      "Sign-in failed. Please try again.",
    );
    expect(classifySignInError(null).userMessage).toBe(
      "Sign-in failed. Please try again.",
    );
    expect(classifySignInError(undefined).userMessage).toBe(
      "Sign-in failed. Please try again.",
    );
  });

  it("never echoes the original error message to userMessage", () => {
    const secret = { code: "invalid_credentials", message: "user@example.com not found in tenant-foo" };
    const { userMessage } = classifySignInError(secret);
    expect(userMessage).not.toContain("user@example.com");
    expect(userMessage).not.toContain("tenant-foo");
  });

  it("preserves original error as opsError for Sentry logging", () => {
    const err = { code: "invalid_credentials", message: "raw" };
    expect(classifySignInError(err).opsError).toBe(err);
  });
});

describe("messageForTenantError", () => {
  it("maps TENANT_MISMATCH to wrong-workspace copy", () => {
    expect(messageForTenantError("TENANT_MISMATCH")).toMatch(/different workspace/i);
  });

  it("maps CUSTOMER_PORTAL_NOT_ALLOWED to customer-portal copy", () => {
    expect(messageForTenantError("CUSTOMER_PORTAL_NOT_ALLOWED")).toMatch(
      /customer account/i,
    );
  });

  it("maps TENANT_CLAIM_MISSING to unassigned-account copy", () => {
    expect(messageForTenantError("TENANT_CLAIM_MISSING")).toMatch(/contact your administrator/i);
  });

  it("maps TENANT_UNKNOWN to unrecognized-workspace copy", () => {
    expect(messageForTenantError("TENANT_UNKNOWN")).toMatch(/isn't recognized/i);
  });

  it("maps TENANT_SCOPE_INVALID to same unrecognized-workspace copy", () => {
    expect(messageForTenantError("TENANT_SCOPE_INVALID")).toMatch(/isn't recognized/i);
  });

  it("returns generic fallback for unknown code", () => {
    expect(messageForTenantError("SOMETHING_ELSE")).toBe(
      "Sign-in failed. Please try again.",
    );
  });

  it("returns generic fallback when code is undefined", () => {
    expect(messageForTenantError(undefined)).toBe("Sign-in failed. Please try again.");
  });

  it("never echoes the input code in the rendered message", () => {
    const out = messageForTenantError("TENANT_MISMATCH");
    expect(out).not.toContain("TENANT_MISMATCH");
  });
});
