/**
 * Unit tests for the public contact-form intake handler at
 * `src/routes/api/public/contact.ts`. The handler is mounted via
 * `createFileRoute(...)({ server: { handlers: { POST } } })`; we pull the
 * POST handler off `Route.options.server.handlers.POST` and invoke it with
 * a stock `Request`.
 *
 * Mock surface (keep narrow):
 *   - `@supabase/supabase-js` — chainable query builder fake.
 *   - `@/lib/email/send-transactional` — owner + visitor sends, no Resend
 *     enqueue.
 *   - `@/lib/contact/classify-submission` — classification trigger.
 *   - `@/lib/cloudflare/context` — `keepAlive` awaits inline in tests.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/send-transactional", () => ({
  sendTransactionalEmail: vi.fn(async () => ({ success: true, messageId: "msg_test" })),
}));

vi.mock("@/lib/contact/classify-submission", () => ({
  classifyAndStore: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/cloudflare/context", () => ({
  keepAlive: vi.fn(async (p: Promise<unknown>) => {
    await p.catch(() => undefined);
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import { classifyAndStore } from "@/lib/contact/classify-submission";

import { Route } from "../contact";

type PostHandler = (args: { request: Request }) => Promise<Response>;

const POST = (Route.options as any).server.handlers.POST as PostHandler;

/**
 * Build a chainable Supabase admin-client fake.
 *
 * `tables` keyed by table name → list of canned responses, applied in call
 * order. Each response describes the terminal resolver the handler will hit:
 *   - `count`: result of `.select(_, { count: 'exact', head: true }).eq().gte()…`
 *     — the chain awaits to `{ count, error }`.
 *   - `maybeSingle`: result of any `.maybeSingle()` terminal.
 *
 * Every chainable method returns the same builder so call order doesn't
 * matter. Methods listed are the only ones the contact handler invokes — add
 * more if a future test needs them.
 */
type Canned =
  | { kind: "count"; count: number | null; error?: { message: string } | null }
  | { kind: "maybeSingle"; data: any; error?: { message: string } | null };

const CHAIN_METHODS = ["select", "insert", "eq", "gte", "limit"] as const;

function buildSupabaseMock(tables: Record<string, Canned[]>) {
  const calls: Array<{ table: string; method: string; args: any[] }> = [];
  const queue: Record<string, Canned[]> = {};
  for (const [k, v] of Object.entries(tables)) queue[k] = [...v];

  function takeNext(table: string): Canned {
    const list = queue[table] ?? [];
    if (list.length === 0) {
      throw new Error(`supabase mock: no canned response for table "${table}"`);
    }
    return list.shift()!;
  }

  function makeBuilder(table: string) {
    let pending: Canned | null = null;

    const builder: any = {};
    for (const m of CHAIN_METHODS) {
      builder[m] = vi.fn((...args: any[]) => {
        calls.push({ table, method: m, args });
        // `.select(_, { count: 'exact', head: true })` is a thenable — pre-load
        // the next canned response so awaiting the chain resolves it.
        if (m === "select" && args[1]?.head === true) {
          pending = takeNext(table);
        }
        return builder;
      });
    }
    builder.maybeSingle = vi.fn(async () => {
      const next = pending ?? takeNext(table);
      pending = null;
      if (next.kind !== "maybeSingle") {
        throw new Error(
          `supabase mock: expected maybeSingle response for "${table}", got ${next.kind}`,
        );
      }
      return { data: next.data, error: next.error ?? null };
    });

    // Awaiting the builder (no `.maybeSingle()` terminal) resolves a count.
    builder.then = (resolve: any, reject: any) => {
      try {
        const next = pending ?? takeNext(table);
        pending = null;
        if (next.kind !== "count") {
          throw new Error(
            `supabase mock: expected count response for "${table}", got ${next.kind}`,
          );
        }
        return Promise.resolve({ count: next.count, error: next.error ?? null }).then(
          resolve,
          reject,
        );
      } catch (err) {
        return Promise.reject(err).then(resolve, reject);
      }
    };

    return builder;
  }

  const client = {
    from: vi.fn((table: string) => makeBuilder(table)),
  };

  return { client, calls };
}

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://acme.virecrm.com/api/public/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "acme.virecrm.com",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  name: "Jane Doe",
  email: "jane@example.com",
  company: "Acme",
  phone: "+1 555 0100",
  budget: "$10,000",
  projectType: "custom-crm" as const,
  message: "We'd like a custom CRM for our brokerage.",
  website: "",
  captcha: { a: 2, b: 3, answer: 5 },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  // `VITE_SUPABASE_URL` is wired in vitest.config.ts so `import.meta.env`
  // resolves at module load. Tests just need the service-role key restored.
});

describe("POST /api/public/contact — happy path", () => {
  it("inserts submission, fires classification, sends both emails, returns 200 success", async () => {
    const { client, calls } = buildSupabaseMock({
      contact_submissions: [
        { kind: "count", count: 0 }, // 10-min rate window
        { kind: "count", count: 0 }, // 24-hr rate window
        { kind: "maybeSingle", data: null }, // dedup lookup
        { kind: "maybeSingle", data: { id: "sub-123" } }, // insert.select.maybeSingle
      ],
    });
    (createClient as any).mockReturnValue(client);

    const res = await POST({
      request: makeRequest(validPayload, { "cf-connecting-ip": "203.0.113.5" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });

    // Insert happened against contact_submissions with normalized email.
    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall).toBeDefined();
    expect(insertCall!.args[0]).toMatchObject({
      name: "Jane Doe",
      email: "jane@example.com",
      message: validPayload.message,
      ip_address: "203.0.113.5",
      status: "received",
    });

    // Classification fired with the new submission id.
    expect(classifyAndStore).toHaveBeenCalledTimes(1);
    expect(classifyAndStore).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ id: "sub-123", email: "jane@example.com" }),
    );

    // Owner + visitor acknowledgment emails enqueued.
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(2);
    const calledTemplates = (sendTransactionalEmail as any).mock.calls.map(
      (c: any[]) => c[0].templateName,
    );
    expect(calledTemplates).toContain("contact-inquiry");
    expect(calledTemplates).toContain("contact-acknowledgment");
  });

  it("rejects bot-flavored payloads where the honeypot field is populated", async () => {
    // `website` is the honeypot — its Zod schema is `.string().max(0)`, so a
    // non-empty value fails validation outright (400). The handler also has
    // a defense-in-depth post-parse check that silent-success-drops anything
    // with `website.length > 0`, but the schema fires first. Either way: no
    // DB writes, no email enqueue.
    const { client } = buildSupabaseMock({ contact_submissions: [] });
    (createClient as any).mockReturnValue(client);

    const res = await POST({
      request: makeRequest({ ...validPayload, website: "https://spam.example.com" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(classifyAndStore).not.toHaveBeenCalled();
  });
});

describe("POST /api/public/contact — validation", () => {
  it("rejects missing email with 400", async () => {
    const res = await POST({
      request: makeRequest({ ...validPayload, email: undefined as any }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
  });

  it("rejects malformed email with 400 and validation error", async () => {
    const res = await POST({
      request: makeRequest({ ...validPayload, email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/invalid email/i);
  });

  it("rejects empty message with 400", async () => {
    const res = await POST({
      request: makeRequest({ ...validPayload, message: "" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/message is required/i);
  });

  it("rejects mismatched captcha with 400 + security-question copy", async () => {
    // Use an in-range but wrong answer so the schema passes and the
    // handler's server-side math check is the path that returns 400.
    const res = await POST({
      request: makeRequest({ ...validPayload, captcha: { a: 2, b: 3, answer: 11 } }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/security question/i);
  });

  it("rejects out-of-range captcha answer at the schema layer with 400", async () => {
    const res = await POST({
      request: makeRequest({ ...validPayload, captcha: { a: 2, b: 3, answer: 99 } }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects payload missing the captcha block with 400", async () => {
    const res = await POST({
      request: makeRequest({ ...validPayload, captcha: undefined as any }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/public/contact — rate limit + dedup", () => {
  it("returns 429 once the 10-minute IP burst threshold is hit", async () => {
    const { client } = buildSupabaseMock({
      contact_submissions: [
        { kind: "count", count: 5 }, // short window — at limit
        { kind: "count", count: 5 }, // 24h window — value irrelevant
      ],
    });
    (createClient as any).mockReturnValue(client);

    const res = await POST({
      request: makeRequest(validPayload, { "cf-connecting-ip": "203.0.113.5" }),
    });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("returns success without re-inserting when a duplicate is found", async () => {
    const { client, calls } = buildSupabaseMock({
      contact_submissions: [
        { kind: "count", count: 0 },
        { kind: "count", count: 0 },
        { kind: "maybeSingle", data: { id: "existing-dup-1" } }, // dedup hit
      ],
    });
    (createClient as any).mockReturnValue(client);

    const res = await POST({
      request: makeRequest(validPayload, { "cf-connecting-ip": "203.0.113.5" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, deduplicated: true });
    expect(calls.find((c) => c.method === "insert")).toBeUndefined();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(classifyAndStore).not.toHaveBeenCalled();
  });
});

describe("POST /api/public/contact — server config + delivery failures", () => {
  it("returns 500 when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST({ request: makeRequest(validPayload) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 500 when owner email enqueue fails", async () => {
    const { client } = buildSupabaseMock({
      contact_submissions: [
        { kind: "count", count: 0 },
        { kind: "count", count: 0 },
        { kind: "maybeSingle", data: null }, // dedup miss
        { kind: "maybeSingle", data: { id: "sub-fail" } }, // insert
      ],
    });
    (createClient as any).mockReturnValue(client);
    (sendTransactionalEmail as any).mockResolvedValueOnce({
      success: false,
      reason: "enqueue_failed",
      error: "boom",
    });

    const res = await POST({
      request: makeRequest(validPayload, { "cf-connecting-ip": "203.0.113.5" }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("still returns 200 when visitor acknowledgment fails", async () => {
    const { client } = buildSupabaseMock({
      contact_submissions: [
        { kind: "count", count: 0 },
        { kind: "count", count: 0 },
        { kind: "maybeSingle", data: null },
        { kind: "maybeSingle", data: { id: "sub-ack-fail" } },
      ],
    });
    (createClient as any).mockReturnValue(client);
    // First call (owner) succeeds, second call (acknowledgment) throws.
    (sendTransactionalEmail as any)
      .mockResolvedValueOnce({ success: true, messageId: "owner-ok" })
      .mockRejectedValueOnce(new Error("ack template render blew up"));

    const res = await POST({
      request: makeRequest(validPayload, { "cf-connecting-ip": "203.0.113.5" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});

describe("OPTIONS /api/public/contact — CORS preflight", () => {
  it("returns 204 with permissive CORS headers", async () => {
    const OPTIONS = (Route.options as any).server.handlers.OPTIONS as () => Promise<Response>;
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
