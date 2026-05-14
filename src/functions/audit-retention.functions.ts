import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateSchema = z.object({
  retention_days: z.number().int().min(0).max(3650),
});

export interface AuditRetentionInfo {
  retention_days: number;
  oldest_entry: string | null;
  total_entries: number;
  is_owner: boolean;
}

export const getAuditRetentionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditRetentionInfo> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      return { retention_days: 90, oldest_entry: null, total_entries: 0, is_owner: false };
    }

    const [orgRes, roleRes, oldestRes, countRes] = await Promise.all([
      supabase
        .from("organizations")
        .select("audit_log_retention_days")
        .eq("id", profile.organization_id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("organization_id", profile.organization_id)
        .eq("role", "owner")
        .maybeSingle(),
      supabase
        .from("advisor_audit_log")
        .select("created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("advisor_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id),
    ]);

    return {
      retention_days:
        (orgRes.data as { audit_log_retention_days?: number } | null)?.audit_log_retention_days ??
        90,
      oldest_entry: oldestRes.data?.created_at ?? null,
      total_entries: countRes.count ?? 0,
      is_owner: !!roleRes.data,
    };
  });

export const updateAuditRetentionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof updateSchema>) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) throw new Error("No organization");

    const { data: ownerRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", profile.organization_id)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerRow) throw new Error("Owner role required");

    const { error } = await supabase
      .from("organizations")
      .update({ audit_log_retention_days: data.retention_days })
      .eq("id", profile.organization_id);

    if (error) throw new Error(error.message);
    return { success: true, retention_days: data.retention_days };
  });

export const purgeAuditLogNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) throw new Error("No organization");

    const { data: ownerRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", profile.organization_id)
      .eq("role", "owner")
      .maybeSingle();

    if (!ownerRow) throw new Error("Owner role required");

    const { data: org } = await supabase
      .from("organizations")
      .select("audit_log_retention_days")
      .eq("id", profile.organization_id)
      .maybeSingle();

    const days =
      (org as { audit_log_retention_days?: number } | null)?.audit_log_retention_days ?? 0;

    if (!days || days <= 0) {
      return { success: true, deleted: 0, message: "Retention disabled" };
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { count: before } = await supabase
      .from("advisor_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .lt("created_at", cutoff);

    const { error } = await supabase
      .from("advisor_audit_log")
      .delete()
      .eq("organization_id", profile.organization_id)
      .lt("created_at", cutoff);

    if (error) throw new Error(error.message);
    return { success: true, deleted: before ?? 0 };
  });
