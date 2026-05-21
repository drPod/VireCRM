import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/auth/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * One-click temp test-account generator (and revoker).
 *
 * Why: the platform owner needs throwaway logins to QA the CRM end-to-end
 * (smoke tests, customer-facing flows, etc.) without rotating their own
 * credentials. Created accounts are tagged via auth user_metadata so
 * `revokeTestAccount` can refuse to delete anything that isn't a test user.
 *
 * Security:
 *   - Caller must be an `owner` in their organization, OR a platform admin.
 *   - Created user is scoped to the caller's organization with `sales_rep`.
 *   - Revoke verifies the target user is still flagged `is_test_account` and
 *     belongs to the caller's org.
 */

const TEST_ACCOUNT_FLAG = "is_test_account";

function randomPassword(): string {
  // 18 chars, alphanumeric + symbols. Crypto-random, no ambiguous chars.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function assertOwnerOrPlatformAdmin(
  userId: string,
): Promise<{ organizationId: string }> {
  // Platform admin can mint test accounts in any org → use their own org.
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);
  if (!profile?.organization_id) throw new Error("No organization on profile");

  const { data: isAdmin } = await supabaseAdmin.rpc("is_platform_admin", {
    p_user_id: userId,
  });
  if (isAdmin) return { organizationId: profile.organization_id };

  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (roleErr) throw new Error(roleErr.message);
  if (roleRow?.role !== "owner") {
    throw new Error("Only workspace owners can mint test accounts");
  }
  return { organizationId: profile.organization_id };
}

export const createTestAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { organizationId } = await assertOwnerOrPlatformAdmin(userId);

    const stamp = Date.now().toString(36);
    const email = `qa+test-${stamp}@genesisx.test`;
    const password = randomPassword();

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          [TEST_ACCOUNT_FLAG]: true,
          created_by: userId,
          organization_id: organizationId,
          full_name: "QA Test Account",
        },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create auth user");
    }
    const newUserId = created.user.id;

    try {
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: newUserId,
          organization_id: organizationId,
          full_name: "QA Test Account",
        });
      if (profileErr) throw new Error(profileErr.message);

      const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
        user_id: newUserId,
        organization_id: organizationId,
        role: "sales_rep",
      });
      if (roleErr) throw new Error(roleErr.message);
    } catch (e) {
      // Roll back the auth user if we couldn't finish the org wiring.
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw e;
    }

    return { userId: newUserId, email, password };
  });

const revokeSchema = z.object({ userId: z.string().uuid() });

export const revokeTestAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: z.infer<typeof revokeSchema>) =>
    revokeSchema.parse(input),
  )
  .handler(async ({ data, context }) => {
    const callerId = context.userId;
    const { organizationId } = await assertOwnerOrPlatformAdmin(callerId);

    const { data: target, error: targetErr } =
      await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (targetErr || !target.user) {
      throw new Error(targetErr?.message ?? "Target user not found");
    }
    const meta = (target.user.user_metadata ?? {}) as Record<string, unknown>;
    if (meta[TEST_ACCOUNT_FLAG] !== true) {
      throw new Error("Refusing to delete: not a test account");
    }
    if (meta.organization_id && meta.organization_id !== organizationId) {
      // Platform admins can revoke across orgs; non-admins are blocked above
      // (assertOwnerOrPlatformAdmin only returns the caller's org).
      const { data: isAdmin } = await supabaseAdmin.rpc("is_platform_admin", {
        p_user_id: callerId,
      });
      if (!isAdmin) throw new Error("Test account belongs to another org");
    }

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(
      data.userId,
    );
    if (delErr) throw new Error(delErr.message);
    // profiles + user_roles cascade via FK.
    return { revoked: true };
  });
