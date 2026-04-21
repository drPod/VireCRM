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
  support_email: string | null;
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
      // Use maybeSingle() everywhere — .single() throws when 0 rows are found,
      // which can leave the app in a half-loaded state where the user is signed
      // in but profile/role/org are null forever. maybeSingle returns null
      // instead so we can degrade gracefully.
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileErr) {
        console.warn("AuthProvider: profile fetch failed", profileErr);
        return;
      }

      if (profileData) {
        setProfile(profileData);

        // Fetch role + organization in parallel — both depend on profile.
        const [roleRes, orgRes] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role, organization_id")
            .eq("user_id", userId)
            .eq("organization_id", profileData.organization_id)
            .maybeSingle(),
          supabase
            .from("organizations")
            .select("*")
            .eq("id", profileData.organization_id)
            .maybeSingle(),
        ]);

        if (roleRes.data) setRole(roleRes.data as UserRole);
        else if (roleRes.error) console.warn("AuthProvider: role fetch failed", roleRes.error);

        if (orgRes.data) setOrganization(orgRes.data as Organization);
        else if (orgRes.error) console.warn("AuthProvider: org fetch failed", orgRes.error);
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
