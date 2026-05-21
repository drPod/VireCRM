#!/usr/bin/env bun
/**
 * Provision throwaway owner-role creds for Playwright e2e + tear them down.
 *
 * Thin wrapper over `scripts/mint-smoke-user.ts` — same DB shape, but emits
 * shell `export` lines for the variables consumed by tests/e2e specs
 * (`QA_TEST_EMAIL`, `QA_TEST_PASSWORD`, `QA_TEST_ORG_ID`) plus a
 * `CLEANUP_TOKEN` (JSON blob) that `teardown` consumes.
 *
 * Usage:
 *   eval "$(bun run scripts/e2e-setup-creds.ts setup)"
 *   bun run scripts/e2e-setup-creds.ts teardown "$CLEANUP_TOKEN"
 */
import { createClient } from "@supabase/supabase-js";

const SMOKE_FLAG = "is_smoke_account";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Source .env first: " +
      "`set -a; source .env; set +a`.",
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

async function pickOrganizationId(): Promise<string> {
  // Mirror `scripts/mint-smoke-user.ts`: prefer the dedicated smoke org if
  // it exists, otherwise borrow the oldest org. We deliberately don't
  // create a fresh org here — RLS + slug uniqueness make that brittle, and
  // the smoke user only needs ownership inside an existing org.
  const { data: existing } = await admin
    .from("organizations")
    .select("id")
    .ilike("name", "smoke-test-org%")
    .order("created_at", { ascending: true })
    .limit(1);
  if (existing && existing.length > 0) return existing[0]!.id;

  const { data: anyOrg, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !anyOrg) {
    throw new Error(`No organizations found: ${error?.message ?? "empty table"}`);
  }
  return anyOrg.id;
}

async function setup(): Promise<void> {
  const organizationId = await pickOrganizationId();
  const stamp = Date.now().toString(36);
  const email = `e2e-${stamp}@genesisx.test`;
  const password = randomPassword();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      [SMOKE_FLAG]: true,
      full_name: "E2E Test User",
      organization_id: organizationId,
    },
  });
  if (createErr || !created.user) {
    throw new Error(createErr?.message ?? "Failed to create auth user");
  }
  const userId = created.user.id;

  try {
    const { error: profileErr } = await admin.from("profiles").upsert(
      { user_id: userId, organization_id: organizationId, full_name: "E2E Test User" },
      { onConflict: "user_id" },
    );
    if (profileErr) throw new Error(`profiles upsert: ${profileErr.message}`);

    const { error: roleErr } = await admin.from("user_roles").upsert(
      { user_id: userId, organization_id: organizationId, role: "owner" },
      { onConflict: "user_id,organization_id" },
    );
    if (roleErr) throw new Error(`user_roles upsert: ${roleErr.message}`);
  } catch (e) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw e;
  }

  const cleanupToken = JSON.stringify({ userId, organizationId });
  // Emit shell-eval'able export lines. Single-quote every value so shell
  // metacharacters in passwords/tokens (& ! @ $ etc.) don't get interpreted.
  // Embedded single quotes are escaped via the standard `'\''` trick.
  const shellQuote = (v: string): string => `'${v.replace(/'/g, `'\\''`)}'`;
  process.stdout.write(`export QA_TEST_EMAIL=${shellQuote(email)}\n`);
  process.stdout.write(`export QA_TEST_PASSWORD=${shellQuote(password)}\n`);
  process.stdout.write(`export QA_TEST_ORG_ID=${shellQuote(organizationId)}\n`);
  process.stdout.write(`export CLEANUP_TOKEN=${shellQuote(cleanupToken)}\n`);
}

async function teardown(tokenJson: string): Promise<void> {
  if (!tokenJson) {
    console.error("teardown requires a CLEANUP_TOKEN argument");
    process.exit(1);
  }
  let token: { userId?: string; organizationId?: string };
  try {
    token = JSON.parse(tokenJson);
  } catch (e) {
    throw new Error(`Invalid CLEANUP_TOKEN: ${(e as Error).message}`);
  }
  const { userId } = token;
  if (!userId) {
    console.error("CLEANUP_TOKEN missing userId; nothing to revoke");
    return;
  }

  // Safety check: only delete smoke-flagged users (mirrors mint-smoke-user).
  const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !target.user) {
    // Idempotent — user already gone.
    console.error(`User ${userId} not found, treating as already-cleaned`);
    return;
  }
  const meta = (target.user.user_metadata ?? {}) as Record<string, unknown>;
  if (meta[SMOKE_FLAG] !== true) {
    throw new Error(`Refusing to delete ${userId}: not a smoke account`);
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    // Don't fail teardown for already-gone errors.
    console.error(`deleteUser ${userId}: ${delErr.message}`);
  }
  // We intentionally do NOT delete the org — it's a shared resource that
  // other smoke runs may borrow. Profiles + roles cascade on user delete.
}

const mode = process.argv[2];
switch (mode) {
  case "setup":
    await setup();
    break;
  case "teardown":
    await teardown(process.argv[3] ?? "");
    break;
  default:
    console.error("Usage: e2e-setup-creds.ts setup | teardown <CLEANUP_TOKEN>");
    process.exit(1);
}
