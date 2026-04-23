import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const listSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25).optional(),
  phase: z.enum(["plan", "execute", "all"]).default("all").optional(),
});

export interface AdvisorAuditEntry {
  id: string;
  command: string;
  phase: "plan" | "execute";
  summary: string | null;
  plan: unknown;
  results: unknown;
  handlers: Record<string, number> | null;
  ok_count: number;
  error_count: number;
  skipped_count: number;
  duration_ms: number;
  error_message: string | null;
  created_at: string;
  user_id: string | null;
}

export const listAdvisorAuditFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof listSchema>) => listSchema.parse(input))
  .handler(async ({ data, context }): Promise<AdvisorAuditEntry[]> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) return [];

    let q = supabase
      .from("advisor_audit_log")
      .select(
        "id, command, phase, summary, plan, results, handlers, ok_count, error_count, skipped_count, duration_ms, error_message, created_at, user_id",
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 25);

    if (data.phase && data.phase !== "all") {
      q = q.eq("phase", data.phase);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AdvisorAuditEntry[];
  });
