import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  organization_id: string;
}

interface UserRole {
  role: "owner" | "manager" | "sales_rep";
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  brand_name: string | null;
  custom_domain: string | null;
  plan: string;
  ai_tokens_used: number;
  ai_tokens_limit: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  organization: Organization | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  organization: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, organization_id")
        .eq("user_id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Fetch role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role, organization_id")
          .eq("user_id", userId)
          .eq("organization_id", profileData.organization_id)
          .single();

        if (roleData) {
          setRole(roleData as UserRole);
        }

        // Fetch organization
        const { data: orgData } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", profileData.organization_id)
          .single();

        if (orgData) {
          setOrganization(orgData as Organization);
        }
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    let initialized = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchUserData(currentSession.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setOrganization(null);
        }
        // Only release loading after the initial session check has run, so the
        // app doesn't briefly see user=null and bounce to /login.
        if (initialized) setLoading(false);
      }
    );

    // THEN check existing session — this is the authoritative initial state.
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        fetchUserData(existingSession.user.id);
      }
      initialized = true;
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, role, organization, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
