import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Simulate a subscription tier change for the caller's organization and
 * verify that monthly_credit_quota / unlimited_credits are updated immediately
 * via the apply_credit_plan RPC.
 *
 * Owner-only. Restores the previous plan after the simulation so this is safe
 * to run against production orgs as a smoke test.
 */

const SUPPORTED_PRICE_KEYS = [
  "crm_starter_monthly",
  "crm_growth_monthly",
  "crm_pro_monthly",
  "lease_starter_monthly",
  "lease_pro_monthly",
  "crm_ownership_onetime",
  "crm_custom_onetime",
] as const;

const inputSchema = z.object({
  price_key: z.enum(SUPPORTED_PRICE_KEYS),
  /** When true, restore the original plan after verifying. Defaults to true. */
  restore: z.boolean().optional(),
});

export interface SimulationStep {
  price_key: string;
  expected: { quota: number; unlimited: boolean; plan: string };
  actual: { quota: number; unlimited: boolean; plan: string };
  matches: boolean;
}

export interface SimulateTierChangeResponse {
  organization_id: string;
  before: { quota: number; unlimited: boolean; plan: string };
  step: SimulationStep;
  restored?: SimulationStep;
  passed: boolean;
}

export const simulateTierChangeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SimulateTierChangeResponse> => {
    const userId = context.userId;
    const admin = supabaseAdmin();

    // Resolve org + verify owner
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profErr || !profile?.organization_id) {
      throw new Error("Organization not found for current user");
    }
    const orgId = profile.organization_id as string;

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .eq("role", "owner")
      .maybeSingle();
    if (!roleRow) {
      throw new Error("Only organization owners can run tier simulations");
    }

    const readOrg = async () => {
      const { data: org, error } = await admin
        .from("organizations")
        .select("monthly_credit_quota, unlimited_credits, plan")
        .eq("id", orgId)
        .single();
      if (error || !org) throw new Error("Failed to read organization");
      return {
        quota: org.monthly_credit_quota ?? 0,
        unlimited: org.unlimited_credits ?? false,
        plan: org.plan ?? "starter",
      };
    };

    const expectedFor = async (priceKey: string) => {
      const { data: planJson, error } = await admin.rpc("credit_plan_for_price", {
        p_price_key: priceKey,
      });
      if (error || !planJson) throw new Error(`credit_plan_for_price failed: ${error?.message}`);
      const j = planJson as { quota: number; unlimited: boolean; plan: string };
      return { quota: j.quota, unlimited: j.unlimited, plan: j.plan };
    };

    const before = await readOrg();
    const originalPriceKey = priceKeyFromPlan(before.plan);

    // Apply the simulated tier change
    const expected = await expectedFor(data.price_key);
    const { error: applyErr } = await admin.rpc("apply_credit_plan", {
      p_org_id: orgId,
      p_price_key: data.price_key,
    });
    if (applyErr) throw new Error(`apply_credit_plan failed: ${applyErr.message}`);

    const actual = await readOrg();
    const matches =
      actual.quota === expected.quota &&
      actual.unlimited === expected.unlimited &&
      actual.plan === expected.plan;

    const step: SimulationStep = {
      price_key: data.price_key,
      expected,
      actual,
      matches,
    };

    let restored: SimulationStep | undefined;
    if (data.restore !== false) {
      const restoreExpected = await expectedFor(originalPriceKey);
      const { error: restoreErr } = await admin.rpc("apply_credit_plan", {
        p_org_id: orgId,
        p_price_key: originalPriceKey,
      });
      if (restoreErr) throw new Error(`restore failed: ${restoreErr.message}`);
      const restoreActual = await readOrg();
      restored = {
        price_key: originalPriceKey,
        expected: restoreExpected,
        actual: restoreActual,
        matches:
          restoreActual.quota === restoreExpected.quota &&
          restoreActual.unlimited === restoreExpected.unlimited &&
          restoreActual.plan === restoreExpected.plan,
      };
    }

    return {
      organization_id: orgId,
      before,
      step,
      restored,
      passed: matches && (restored ? restored.matches : true),
    };
  });

function priceKeyFromPlan(plan: string): string {
  switch (plan) {
    case "starter":
      return "crm_starter_monthly";
    case "growth":
      return "crm_growth_monthly";
    case "pro":
    case "professional":
      return "crm_pro_monthly";
    case "lease_starter":
      return "lease_starter_monthly";
    case "lease_pro":
      return "lease_pro_monthly";
    case "ownership":
      return "crm_ownership_onetime";
    case "custom":
      return "crm_custom_onetime";
    default:
      return "crm_starter_monthly";
  }
}
