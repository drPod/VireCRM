import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertOrgMember(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.organization_id !== orgId)
    throw new Error("Unauthorized: not a member of this organization");
}

export async function assertOwner(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<void> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("Only organization owners can perform this action");
}
