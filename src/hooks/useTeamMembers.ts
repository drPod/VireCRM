import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AppRole,
  CustomRoleLite,
  Invitation,
  Member,
} from "@/components/crm/team-members.types";

interface UseTeamMembersResult {
  members: Member[];
  invitations: Invitation[];
  customRoles: CustomRoleLite[];
  customRoleMap: Map<string, CustomRoleLite>;
  assignableRoles: CustomRoleLite[];
  defaultRepRoleId: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

export function useTeamMembers(organizationId: string | undefined): UseTeamMembersResult {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleLite[]>([]);
  const [loading, setLoading] = useState(true);

  const customRoleMap = useMemo(() => {
    const m = new Map<string, CustomRoleLite>();
    for (const r of customRoles) m.set(r.id, r);
    return m;
  }, [customRoles]);

  // Roles assignable via the picker (exclude any owner-tier role, since
  // ownership transfer is not supported through this UI).
  const assignableRoles = useMemo(
    () => customRoles.filter((r) => r.base_role !== "owner"),
    [customRoles],
  );

  const defaultRepRoleId = useMemo(() => {
    const defaultRep = customRoles.find(
      (r) => r.is_builtin && r.base_role === "sales_rep",
    );
    return defaultRep?.id ?? null;
  }, [customRoles]);

  const loadData = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [profilesRes, rolesRes, invRes, customRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("organization_id", organizationId),
        supabase
          .from("user_roles")
          .select("user_id, role, custom_role_id")
          .eq("organization_id", organizationId),
        supabase
          .from("invitations")
          .select("id, email, role, custom_role_id, token, status, created_at, expires_at")
          .eq("organization_id", organizationId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("custom_roles")
          .select("id, name, base_role, color, is_builtin")
          .eq("organization_id", organizationId)
          .order("is_builtin", { ascending: false })
          .order("name", { ascending: true }),
      ]);

      const roleRows = (rolesRes.data ?? []) as {
        user_id: string;
        role: AppRole;
        custom_role_id: string | null;
      }[];
      const roleMap = new Map(roleRows.map((r) => [r.user_id, r]));

      const memberList: Member[] = (profilesRes.data ?? []).map((p) => {
        const r = roleMap.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          role: (r?.role ?? "sales_rep") as AppRole,
          custom_role_id: r?.custom_role_id ?? null,
        };
      });

      setMembers(memberList);
      setInvitations((invRes.data ?? []) as Invitation[]);
      setCustomRoles((customRes.data ?? []) as CustomRoleLite[]);
    } catch (err) {
      console.error("Failed to load team", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return {
    members,
    invitations,
    customRoles,
    customRoleMap,
    assignableRoles,
    defaultRepRoleId,
    loading,
    reload: loadData,
  };
}
