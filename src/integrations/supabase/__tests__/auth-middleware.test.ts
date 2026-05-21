/**
 * Unit tests for `requireSupabaseAuth` middleware.
 *
 * The middleware is built with TanStack Start's `createMiddleware({ type:
 * "function" }).server(handler)`. The returned descriptor exposes the inner
 * handler at `options.server` (see
 * node_modules/@tanstack/start-client-core/src/createMiddleware.ts). Tests
 * pull the handler off the descriptor and invoke it directly with a stub
 * `next()` so we don't have to spin up TanStack's full middleware runner.
 *
 * Mocks:
 *   - `@tanstack/react-start/server` — `getRequest` + `setResponseStatus`.
 *   - `@supabase/supabase-js` — `createClient()` returns a client whose
 *     `auth.getClaims()` returns a per-test-controlled result.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ------------------------------------------------------------------

const getRequestMock = vi.fn();
const setResponseStatusMock = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => getRequestMock(),
  setResponseStatus: (status: number) => setResponseStatusMock(status),
}));

const getClaimsMock = vi.fn();
const createClientMock = vi.fn(() => ({
  auth: {
    getClaims: getClaimsMock,
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...(args as [])),
}));

// --- Helpers ----------------------------------------------------------------

interface MiddlewareDescriptor {
  options: {
    server: (ctx: { next: (arg?: unknown) => unknown }) => Promise<unknown>;
  };
}

/**
 * Build a minimal Request-like stub whose `.headers.get()` returns the
 * supplied authorization header verbatim. We deliberately do NOT use the
 * platform `Headers` class — it normalizes header values (strips trailing
 * whitespace), which would mask the `Bearer <empty>` code path.
 */
function makeRequest(authorization?: string | null): { headers: Headers } | null {
  if (authorization === null) {
    return null;
  }
  const stub = {
    get: (name: string) =>
      name.toLowerCase() === "authorization" && typeof authorization === "string"
        ? authorization
        : null,
  } as unknown as Headers;
  return { headers: stub };
}

/**
 * Pull the inner server handler off the middleware descriptor. The cast is
 * intentional — the public TanStack types deliberately hide the handler.
 */
async function loadHandler() {
  const mod = await import("../auth-middleware");
  const descriptor = mod.requireSupabaseAuth as unknown as MiddlewareDescriptor;
  return descriptor.options.server;
}

// --- Suite ------------------------------------------------------------------

describe("requireSupabaseAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    getRequestMock.mockReset();
    setResponseStatusMock.mockReset();
    getClaimsMock.mockReset();
    createClientMock.mockClear();

    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
  });

  it("Bearer token + valid claims: populates context and calls next()", async () => {
    const handler = await loadHandler();

    getRequestMock.mockReturnValue(makeRequest("Bearer good-token"));
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-uuid-123", email: "a@b.com" } },
      error: null,
    });

    const next = vi.fn((arg: unknown) => ({ ok: true, arg }));
    const result = (await handler({ next })) as { ok: boolean; arg: unknown };

    expect(next).toHaveBeenCalledTimes(1);
    expect(setResponseStatusMock).not.toHaveBeenCalled();

    const nextArg = next.mock.calls[0][0] as {
      context: { userId: string; claims: { sub: string }; supabase: unknown };
    };
    expect(nextArg.context.userId).toBe("user-uuid-123");
    expect(nextArg.context.claims).toEqual({ sub: "user-uuid-123", email: "a@b.com" });
    expect(nextArg.context.supabase).toBeDefined();

    // The middleware passes the token through to createClient under the
    // Authorization global header — sanity-check that wiring.
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-publishable-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer good-token" } },
      }),
    );

    expect(getClaimsMock).toHaveBeenCalledWith("good-token");
    expect(result.ok).toBe(true);
  });

  /**
   * Reject path assertion bundle: handler must throw with a matching message,
   * `setResponseStatus(401)` must be called, and `next` must NOT fire. Every
   * unauthorized-test uses this same shape — extracting it keeps each `it`
   * focused on its single distinguishing input.
   */
  async function expect401(
    handler: (ctx: { next: (arg?: unknown) => unknown }) => Promise<unknown>,
    errPattern: RegExp,
  ) {
    const next = vi.fn();
    await expect(handler({ next })).rejects.toThrow(errPattern);
    expect(setResponseStatusMock).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  }

  it("Missing Authorization header: throws and sets 401", async () => {
    const handler = await loadHandler();
    getRequestMock.mockReturnValue(makeRequest(undefined));

    await expect401(handler, /no authorization header/i);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
  });

  it("Malformed header (not Bearer): throws and sets 401", async () => {
    const handler = await loadHandler();
    getRequestMock.mockReturnValue(makeRequest("Basic dXNlcjpwYXNz"));

    await expect401(handler, /only bearer tokens/i);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
  });

  it("Empty token (Bearer with no value): throws and sets 401", async () => {
    const handler = await loadHandler();
    getRequestMock.mockReturnValue(makeRequest("Bearer "));

    await expect401(handler, /no token provided/i);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
  });

  it("getClaims returns error: throws and sets 401", async () => {
    const handler = await loadHandler();
    getRequestMock.mockReturnValue(makeRequest("Bearer expired-token"));
    getClaimsMock.mockResolvedValue({
      data: null,
      error: { message: "JWT expired", name: "AuthError" },
    });

    await expect401(handler, /invalid or expired token/i);
  });

  it("getClaims returns data without claims: throws and sets 401", async () => {
    const handler = await loadHandler();
    getRequestMock.mockReturnValue(makeRequest("Bearer empty-claims"));
    getClaimsMock.mockResolvedValue({ data: { claims: null }, error: null });

    await expect401(handler, /invalid or expired token/i);
  });

  it("Missing sub in claims: throws and sets 401", async () => {
    const handler = await loadHandler();
    getRequestMock.mockReturnValue(makeRequest("Bearer no-sub-token"));
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: undefined, email: "a@b.com" } },
      error: null,
    });

    await expect401(handler, /no user id found/i);
  });

  it("Missing Supabase env vars: throws without setting 401", async () => {
    // Env-misconfig is server-internal — must not be downgraded to 401.
    delete process.env.SUPABASE_URL;
    const handler = await loadHandler();
    getRequestMock.mockReturnValue(makeRequest("Bearer whatever"));
    const next = vi.fn();

    await expect(handler({ next })).rejects.toThrow(/missing supabase environment variables/i);
    expect(setResponseStatusMock).not.toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
