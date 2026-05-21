import type {
  AppRole,
  CustomRoleLite,
  Invitation,
  Member,
} from "@/components/crm/team-members.types";

const BASE_ROLE_LABEL: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  sales_rep: "Sales Rep",
};

export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/accept-invite?token=${token}`;
}

export function resolveRoleLabel(
  customRoleId: string | null,
  baseRole: AppRole,
  customRoleMap: Map<string, CustomRoleLite>,
): string {
  if (customRoleId) {
    const cr = customRoleMap.get(customRoleId);
    if (cr) return cr.name;
  }
  return BASE_ROLE_LABEL[baseRole];
}

export function memberRoleLabel(
  m: Member,
  customRoleMap: Map<string, CustomRoleLite>,
): string {
  return resolveRoleLabel(m.custom_role_id, m.role, customRoleMap);
}

export function invitationRoleLabel(
  inv: Invitation,
  customRoleMap: Map<string, CustomRoleLite>,
): string {
  return resolveRoleLabel(inv.custom_role_id, inv.role, customRoleMap);
}
