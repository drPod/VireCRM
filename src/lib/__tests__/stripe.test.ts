/**
 * Unit tests for `src/lib/stripe.ts`.
 *
 * Notes on test structure:
 *   - `clientToken` is captured at *module load* (`import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN`),
 *     and `stripePromise` is a module-level singleton. To exercise different env
 *     values per test we `vi.resetModules()` + dynamic `await import(...)` so each
 *     test gets a fresh module evaluation against the currently-stubbed env.
 *   - `@stripe/stripe-js` is mocked module-wide so `getStripe()` never hits the
 *     real Stripe script loader (would try to inject a <script> into jsdom).
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

// Hoisted mock factory — vi.mock is hoisted above imports.
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(),
}));

async function loadModule() {
  return await import("../stripe");
}

async function getMockedLoadStripe(): Promise<Mock> {
  const stripeJs = await import("@stripe/stripe-js");
  return stripeJs.loadStripe as unknown as Mock;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getStripeEnvironment", () => {
  it("returns 'live' only when token starts with pk_live_", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_live_abc123");
    const { getStripeEnvironment } = await loadModule();
    expect(getStripeEnvironment()).toBe("live");
  });

  it("returns 'sandbox' for pk_test_ tokens", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_xyz789");
    const { getStripeEnvironment } = await loadModule();
    expect(getStripeEnvironment()).toBe("sandbox");
  });

  it("returns 'sandbox' when env var missing", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "");
    const { getStripeEnvironment } = await loadModule();
    expect(getStripeEnvironment()).toBe("sandbox");
  });

  it("returns 'sandbox' for malformed/unknown prefix", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "sk_live_should_not_match");
    const { getStripeEnvironment } = await loadModule();
    expect(getStripeEnvironment()).toBe("sandbox");
  });
});

describe("isStripeConfigured", () => {
  it("returns true when token is set", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_xyz");
    const { isStripeConfigured } = await loadModule();
    expect(isStripeConfigured()).toBe(true);
  });

  it("returns false when token is empty string", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "");
    const { isStripeConfigured } = await loadModule();
    expect(isStripeConfigured()).toBe(false);
  });
});

describe("getStripe", () => {
  it("throws when token missing", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "");
    const { getStripe } = await loadModule();
    expect(() => getStripe()).toThrow(
      /VITE_PAYMENTS_CLIENT_TOKEN is not set/,
    );
  });

  it("calls loadStripe with the configured publishable key", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_singleton");
    const loadStripe = await getMockedLoadStripe();
    const fakeStripeInstance = { id: "fake-stripe" };
    loadStripe.mockReturnValue(Promise.resolve(fakeStripeInstance));

    const { getStripe } = await loadModule();
    const result = getStripe();

    expect(loadStripe).toHaveBeenCalledTimes(1);
    expect(loadStripe).toHaveBeenCalledWith("pk_test_singleton");
    await expect(result).resolves.toBe(fakeStripeInstance);
  });

  it("memoizes the loadStripe promise across multiple calls (singleton)", async () => {
    vi.stubEnv("VITE_PAYMENTS_CLIENT_TOKEN", "pk_test_singleton");
    const loadStripe = await getMockedLoadStripe();
    loadStripe.mockReturnValue(Promise.resolve({ id: "fake-stripe" }));

    const { getStripe } = await loadModule();
    const first = getStripe();
    const second = getStripe();
    const third = getStripe();

    // Same promise reference returned on every call.
    expect(second).toBe(first);
    expect(third).toBe(first);
    // loadStripe invoked exactly once despite three getStripe() calls.
    expect(loadStripe).toHaveBeenCalledTimes(1);
  });
});
