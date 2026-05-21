export type AppRole = "owner" | "manager" | "sales_rep";

export interface CustomRoleLite {
  id: string;
  name: string;
  base_role: AppRole;
  color: string | null;
  is_builtin: boolean;
}

export interface Member {
  user_id: string;
  full_name: string | null;
  role: AppRole;
  custom_role_id: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  custom_role_id: string | null;
  token: string;
  status: string;
  created_at: string;
  expires_at: string;
}
