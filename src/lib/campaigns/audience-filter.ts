import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const audienceFilterSchema = z.object({
  statuses: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  search: z.string().optional(),
  has_email: z.boolean().optional(),
  exclude_closed: z.boolean().optional(),
});

export type AudienceFilter = z.infer<typeof audienceFilterSchema>;

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export async function resolveAudienceFilter(
  supabase: SupabaseClient<Database>,
  orgId: string,
  filter: AudienceFilter,
): Promise<Lead[]> {
  let q = supabase.from("leads").select("*").eq("organization_id", orgId).is("deleted_at", null);

  if (filter.statuses?.length) q = q.in("status", filter.statuses);
  if (filter.sources?.length) q = q.in("source", filter.sources);
  if (filter.assignees?.length) q = q.in("assigned_to", filter.assignees);
  if (filter.tags?.length) q = q.overlaps("tags", filter.tags);
  if (filter.has_email) q = q.not("email", "is", null);
  if (filter.exclude_closed) q = q.not("status", "in", "(won,lost)");
  if (filter.search) {
    const s = filter.search.replace(/[%_]/g, "");
    q = q.or(`name.ilike.%${s}%,company.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data, error } = await q.limit(10000);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function countAudience(
  supabase: SupabaseClient<Database>,
  orgId: string,
  filter: AudienceFilter,
): Promise<number> {
  const leads = await resolveAudienceFilter(supabase, orgId, filter);
  return leads.length;
}
