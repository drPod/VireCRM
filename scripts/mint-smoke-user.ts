#!/usr/bin/env bun
/**
 * Mint a throwaway owner-role user for headless smoke tests, then print
 * { email, password, userId, organizationId, deleteUrl? } as JSON on stdout.
 *
 * Why a dedicated script vs. the in-app `createTestAccount` server fn:
 *   - createTestAccount requires a signed-in caller (owner / platform admin)
 *     to mint. Smoke tests run from a cold start with no session.
 *   - createTestAccount mints `sales_rep`; smoke needs `owner` to walk the
 *     reseller surfaces.
 *
 * Cleanup: pass `--cleanup <userId>` (or `--cleanup-all-smoke`) to revoke.
 * Smoke users are tagged via `user_metadata.is_smoke_account = true` so the
 * cleanup path refuses to touch anything else.
 *
 * Usage:
 *   bun run scripts/mint-smoke-user.ts                     # mint, print JSON
 *   bun run scripts/mint-smoke-user.ts --cleanup <userId>  # delete one
 *   bun run scripts/mint-smoke-user.ts --cleanup-all-smoke # delete every smoke acct
 */
import { createClient } from "@supabase/supabase-js";

const SMOKE_FLAG = "is_smoke_account";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. " +
      "Source .env first: `set -a; source .env; set +a`.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function randomPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

async function cleanup(userId: string): Promise<void> {
  const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !target.user) {
    throw new Error(getErr?.message ?? "User not found");
  }
  const meta = (target.user.user_metadata ?? {}) as Record<string, unknown>;
  if (meta[SMOKE_FLAG] !== true) {
    throw new Error(`Refusing to delete ${userId}: not a smoke account`);
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) throw new Error(delErr.message);
  console.log(JSON.stringify({ revoked: userId }));
}

async function cleanupAllSmoke(): Promise<void> {
  // Page through up to 1000 users — smoke runs shouldn't generate more.
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  const targets = data.users.filter(
    (u) => (u.user_metadata as Record<string, unknown> | undefined)?.[SMOKE_FLAG] === true,
  );
  const revoked: string[] = [];
  for (const u of targets) {
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) {
      console.error(`Failed to delete ${u.id}: ${delErr.message}`);
      continue;
    }
    revoked.push(u.id);
  }
  console.log(JSON.stringify({ revokedCount: revoked.length, revoked }));
}

async function mint(): Promise<void> {
  // Pick an organization to host the user. Prefer the smoke-flagged
  // dedicated org if it exists, otherwise fall back to the oldest org.
  const { data: existing } = await admin
    .from("organizations")
    .select("id, name")
    .ilike("name", "smoke-test-org%")
    .order("created_at", { ascending: true })
    .limit(1);

  let organizationId: string;
  if (existing && existing.length > 0) {
    organizationId = existing[0].id;
  } else {
    const { data: anyOrg, error: anyErr } = await admin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (anyErr || !anyOrg) {
      throw new Error(
        `No organizations found to host the smoke user: ${anyErr?.message ?? "empty table"}`,
      );
    }
    organizationId = anyOrg.id;
  }

  const stamp = Date.now().toString(36);
  const email = `smoke-${stamp}@genesisx.test`;
  const password = randomPassword();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      [SMOKE_FLAG]: true,
      full_name: "Smoke Test User",
      organization_id: organizationId,
    },
  });
  if (createErr || !created.user) {
    throw new Error(createErr?.message ?? "Failed to create auth user");
  }
  const userId = created.user.id;

  try {
    // A DB trigger on auth.users may have already created a profile row
    // (handle_new_user). Upsert by user_id so we own the org binding.
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          organization_id: organizationId,
          full_name: "Smoke Test User",
        },
        { onConflict: "user_id" },
      );
    if (profileErr) throw new Error(`profiles upsert: ${profileErr.message}`);

    const { error: roleErr } = await admin.from("user_roles").upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        role: "owner",
      },
      { onConflict: "user_id,organization_id" },
    );
    if (roleErr) throw new Error(`user_roles upsert: ${roleErr.message}`);
  } catch (e) {
    // Roll back the auth user if the org wiring failed.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw e;
  }

  console.log(JSON.stringify({ userId, organizationId, email, password }));
}

const cleanupFlag = process.argv.indexOf("--cleanup");
if (cleanupFlag !== -1) {
  const id = process.argv[cleanupFlag + 1];
  if (!id) {
    console.error("--cleanup requires a userId");
    process.exit(1);
  }
  await cleanup(id);
} else if (process.argv.includes("--cleanup-all-smoke")) {
  await cleanupAllSmoke();
} else {
  await mint();
}
