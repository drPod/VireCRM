/**
 * Unit tests for the auth error utilities used by every UI caller that
 * invokes a server function. Covers:
 *   - `isAuthError`: status / message / nested cause detection matrix.
 *   - `handleAuthError`: toast + redirect side effects, debounce, idempotency.
 *   - `SessionExpiredError`: shape (instanceof, name, status-like behavior).
 *   - `getServerFnAuthHeaders`: token forwarding + missing-session path.
 *
 * Module-level state (`lastSignInToastAt`) is reset via `vi.resetModules()`
 * between scenarios so debounce timing doesn't bleed across tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";

type AssignMock = Mock<(url: string | URL) => void>;

// --- Shared mocks ---------------------------------------------------------

const toastErrorMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
    },
  },
}));

/**
 * jsdom blocks plain assignment to `window.location` — use defineProperty.
 * Both `window.location` and the bare `location` lookup go through this.
 */
function setLocation(partial: Partial<Location> & { assign: Location["assign"] }) {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { pathname: "/", search: "", href: "", ...partial },
  });
}

beforeEach(() => {
  toastErrorMock.mockReset();
  getSessionMock.mockReset();
  vi.resetModules();
});

// --- isAuthError ----------------------------------------------------------

describe("isAuthError", () => {
  it("returns false for nullish / non-error inputs", async () => {
    const { isAuthError } = await import("../server-fn-auth");
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
    expect(isAuthError(0)).toBe(false);
    expect(isAuthError("")).toBe(false);
  });

  it("returns false for a generic Error with non-auth message", async () => {
    const { isAuthError } = await import("../server-fn-auth");
    expect(isAuthError(new Error("foo"))).toBe(false);
    expect(isAuthError(new Error("ECONNREFUSED 127.0.0.1:54321"))).toBe(false);
    expect(isAuthError(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("detects HTTP 401/403 via top-level `status` field", async () => {
    const { isAuthError } = await import("../server-fn-auth");
    expect(isAuthError({ status: 401 })).toBe(true);
    expect(isAuthError({ status: 403 })).toBe(true);
    expect(isAuthError({ status: 500 })).toBe(false);
    expect(isAuthError({ status: 400 })).toBe(false);
  });

  it("detects HTTP 401/403 via `statusCode` field (alternate)", async () => {
    const { isAuthError } = await import("../server-fn-auth");
    expect(isAuthError({ statusCode: 401 })).toBe(true);
    expect(isAuthError({ statusCode: 403 })).toBe(true);
    expect(isAuthError({ statusCode: 500 })).toBe(false);
  });

  it("detects HTTP 401/403 via nested `cause.status` (TanStack Start HTTPError shape)", async () => {
    const { isAuthError } = await import("../server-fn-auth");
    expect(isAuthError({ cause: { status: 401 } })).toBe(true);
    expect(isAuthError({ cause: { status: 403 } })).toBe(true);
    expect(isAuthError({ cause: { status: 500 } })).toBe(false);
  });

  it("matches the message regex case-insensitively", async () => {
    const { isAuthError } = await import("../server-fn-auth");
    // Each branch of the /session expired|please sign in|not authenticated|unauthor/i regex.
    expect(isAuthError(new Error("Unauthorized"))).toBe(true);
    expect(isAuthError(new Error("UNAUTHORIZED"))).toBe(true);
    expect(isAuthError(new Error("HTTP 401: unauthorised access"))).toBe(true);
    expect(isAuthError(new Error("Your session expired"))).toBe(true);
    expect(isAuthError(new Error("SESSION EXPIRED — token TTL hit"))).toBe(true);
    expect(isAuthError(new Error("Please sign in again"))).toBe(true);
    expect(isAuthError(new Error("Not authenticated"))).toBe(true);
    expect(isAuthError(new Error("not AUTHENTICATED"))).toBe(true);
  });

  it("treats plain-string errors as messages too", async () => {
    const { isAuthError } = await import("../server-fn-auth");
    expect(isAuthError("Unauthorized")).toBe(true);
    expect(isAuthError("session expired")).toBe(true);
    expect(isAuthError("totally unrelated")).toBe(false);
  });

  it("returns true for SessionExpiredError instances", async () => {
    const { isAuthError, SessionExpiredError } = await import("../server-fn-auth");
    expect(isAuthError(new SessionExpiredError())).toBe(true);
    expect(isAuthError(new SessionExpiredError("custom message that does not match regex"))).toBe(
      true,
    );
  });

  it("does not flag a generic 401-ish message lacking the regex hooks", async () => {
    const { isAuthError } = await import("../server-fn-auth");
    // Status field is the source of truth — a message saying "401" alone with no
    // status and no regex word is not auth (we don't pattern-match raw "401").
    expect(isAuthError(new Error("backend returned 401 in body"))).toBe(false);
  });
});

// --- SessionExpiredError --------------------------------------------------

describe("SessionExpiredError", () => {
  it("is an Error subclass with the expected name and default message", async () => {
    const { SessionExpiredError } = await import("../server-fn-auth");
    const err = new SessionExpiredError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SessionExpiredError);
    expect(err.name).toBe("SessionExpiredError");
    expect(err.message.toLowerCase()).toContain("session expired");
  });

  it("accepts a custom message", async () => {
    const { SessionExpiredError } = await import("../server-fn-auth");
    const err = new SessionExpiredError("custom");
    expect(err.message).toBe("custom");
    expect(err.name).toBe("SessionExpiredError");
  });
});

// --- handleAuthError ------------------------------------------------------

describe("handleAuthError", () => {
  let assignMock: AssignMock;

  beforeEach(() => {
    vi.useFakeTimers();
    assignMock = vi.fn<(url: string | URL) => void>();
    setLocation({ pathname: "/dashboard", search: "?foo=bar", assign: assignMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false and does nothing for non-auth errors", async () => {
    const { handleAuthError } = await import("../server-fn-auth");
    expect(handleAuthError(new Error("totally unrelated"))).toBe(false);
    expect(toastErrorMock).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("returns true and triggers toast + redirect for an auth error", async () => {
    const { handleAuthError } = await import("../server-fn-auth");
    const result = handleAuthError({ status: 401 });
    expect(result).toBe(true);

    // Toast fires immediately with auth-flavored copy.
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    const [message, opts] = toastErrorMock.mock.calls[0];
    expect(String(message).toLowerCase()).toMatch(/sign in/);
    expect(opts).toMatchObject({
      id: "session-expired",
      description: expect.stringMatching(/session expired/i),
    });

    // Redirect is debounced by 600ms; nothing yet.
    expect(assignMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(assignMock).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/dashboard?foo=bar")}`,
    );
  });

  it("debounces the toast when called twice in quick succession", async () => {
    const { handleAuthError } = await import("../server-fn-auth");
    handleAuthError({ status: 401 });
    handleAuthError({ status: 403 });
    handleAuthError(new Error("Unauthorized"));

    // Both return true (still an auth error), but only ONE toast fires within
    // the 3-second debounce window.
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it("does not redirect when already on /login", async () => {
    setLocation({ pathname: "/login", assign: assignMock });

    const { handleAuthError } = await import("../server-fn-auth");
    handleAuthError({ status: 401 });
    vi.advanceTimersByTime(2000);
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("URL-encodes a complex `next` path including query parameters", async () => {
    setLocation({
      pathname: "/leads/123/edit",
      search: "?tab=notes&q=hello world",
      assign: assignMock,
    });

    const { handleAuthError } = await import("../server-fn-auth");
    handleAuthError({ status: 401 });
    vi.advanceTimersByTime(600);
    expect(assignMock).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/leads/123/edit?tab=notes&q=hello world")}`,
    );
  });
});

// --- getServerFnAuthHeaders ----------------------------------------------

describe("getServerFnAuthHeaders", () => {
  let assignMock: AssignMock;

  beforeEach(() => {
    vi.useFakeTimers();
    assignMock = vi.fn<(url: string | URL) => void>();
    setLocation({ pathname: "/dashboard", assign: assignMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a Bearer Authorization header when a session is present", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "tok_abc123" } },
      error: null,
    });

    const { getServerFnAuthHeaders } = await import("../server-fn-auth");
    const headers = await getServerFnAuthHeaders();
    expect(headers).toEqual({ Authorization: "Bearer tok_abc123" });
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("throws SessionExpiredError and triggers the sign-in flow when no session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    const { getServerFnAuthHeaders, SessionExpiredError } = await import("../server-fn-auth");
    await expect(getServerFnAuthHeaders()).rejects.toBeInstanceOf(SessionExpiredError);

    // The sign-in toast fired (side effect of the missing-session branch).
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    // Redirect is queued; advance the 600ms setTimeout.
    vi.advanceTimersByTime(600);
    expect(assignMock).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/dashboard")}`,
    );
  });

  it("throws SessionExpiredError when session exists but has no access_token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: {} }, error: null });

    const { getServerFnAuthHeaders, SessionExpiredError } = await import("../server-fn-auth");
    await expect(getServerFnAuthHeaders()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
