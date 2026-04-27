// Integration test: verify the consume_credit RPC charges exactly 1 credit
// per outreach action for lower tiers (Starter / Growth / Pro / Lease-*) and
// bypasses credit usage entirely for Custom CRM and Full Ownership tiers.
//
// We hit the Supabase REST API directly with the service-role key so the
// test exercises the same code path the outreach functions use.
//
// Required env vars (provided automatically when run via `deno test` against
// a Supabase project):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// The test creates two ephemeral organizations, exercises the RPC, and
// cleans them up regardless of pass/fail.

import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const skip = !SUPABASE_URL || !SERVICE_KEY;

async function rpc<T = unknown>(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`RPC ${name} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function pgrest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  prefer = "return=representation",
) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function makeOrg(name: string, opts: {
  plan: string;
  monthly_credit_quota: number;
  unlimited_credits: boolean;
}) {
  const slug = `credit-test-${crypto.randomUUID().slice(0, 8)}`;
  const rows = await pgrest("POST", "organizations", {
    name,
    slug,
    brand_name: name,
    plan: opts.plan,
    monthly_credit_quota: opts.monthly_credit_quota,
    credits_used_this_period: 0,
    unlimited_credits: opts.unlimited_credits,
  });
  return rows[0].id as string;
}

async function dropOrg(id: string) {
  // org_features may have FK references — clear first, then delete the org.
  await pgrest("DELETE", `org_features?organization_id=eq.${id}`, undefined, "return=minimal").catch(() => {});
  await pgrest("DELETE", `organizations?id=eq.${id}`, undefined, "return=minimal");
}

Deno.test({
  name: "consume_credit: lower tier deducts exactly 1 per call",
  ignore: skip,
  async fn() {
    const orgId = await makeOrg("Credit Test (Starter)", {
      plan: "starter",
      monthly_credit_quota: 10,
      unlimited_credits: false,
    });
    try {
      const r1 = await rpc<{ ok: boolean; used: number; remaining: number }>(
        "consume_credit",
        { p_org_id: orgId, p_count: 1 },
      );
      const r2 = await rpc<{ ok: boolean; used: number; remaining: number }>(
        "consume_credit",
        { p_org_id: orgId, p_count: 1 },
      );
      const r3 = await rpc<{ ok: boolean; used: number; remaining: number }>(
        "consume_credit",
        { p_org_id: orgId, p_count: 1 },
      );

      assertEquals(r1.ok, true);
      assertEquals(r1.used, 1);
      assertEquals(r1.remaining, 9);
      assertEquals(r2.used, 2);
      assertEquals(r2.remaining, 8);
      assertEquals(r3.used, 3);
      assertEquals(r3.remaining, 7);

      // Persisted org counter matches the per-call totals
      const orgRows = await pgrest(
        "GET",
        `organizations?id=eq.${orgId}&select=credits_used_this_period`,
      );
      assertEquals(orgRows[0].credits_used_this_period, 3);
    } finally {
      await dropOrg(orgId);
    }
  },
});

Deno.test({
  name: "consume_credit: Custom CRM / Full Ownership tier bypasses charging",
  ignore: skip,
  async fn() {
    const orgId = await makeOrg("Credit Test (Ownership)", {
      plan: "ownership",
      monthly_credit_quota: 0,
      unlimited_credits: true,
    });
    try {
      // Three consecutive outreach actions
      for (let i = 0; i < 3; i++) {
        const r = await rpc<{ ok: boolean; unlimited?: boolean }>(
          "consume_credit",
          { p_org_id: orgId, p_count: 1 },
        );
        assertEquals(r.ok, true, `call ${i + 1} should succeed`);
        assertEquals(r.unlimited, true, `call ${i + 1} should report unlimited`);
      }

      // The persisted counter must NOT advance for unlimited orgs
      const orgRows = await pgrest(
        "GET",
        `organizations?id=eq.${orgId}&select=credits_used_this_period`,
      );
      assertEquals(
        orgRows[0].credits_used_this_period,
        0,
        "ownership orgs must not decrement credits",
      );
    } finally {
      await dropOrg(orgId);
    }
  },
});

Deno.test({
  name: "consume_credit: lower tier returns credits_exhausted past quota",
  ignore: skip,
  async fn() {
    const orgId = await makeOrg("Credit Test (Exhaust)", {
      plan: "starter",
      monthly_credit_quota: 2,
      unlimited_credits: false,
    });
    try {
      const ok1 = await rpc<{ ok: boolean }>("consume_credit", {
        p_org_id: orgId,
        p_count: 1,
      });
      const ok2 = await rpc<{ ok: boolean }>("consume_credit", {
        p_org_id: orgId,
        p_count: 1,
      });
      const fail = await rpc<{ ok: boolean; error?: string }>(
        "consume_credit",
        { p_org_id: orgId, p_count: 1 },
      );
      assertEquals(ok1.ok, true);
      assertEquals(ok2.ok, true);
      assertEquals(fail.ok, false);
      assertEquals(fail.error, "credits_exhausted");
      assert(true);
    } finally {
      await dropOrg(orgId);
    }
  },
});
