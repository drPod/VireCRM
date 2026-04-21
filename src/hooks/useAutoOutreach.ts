import { useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autoOutreachFn } from "@/functions/auto-outreach.functions";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeadForOutreach {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
}

export function useAutoOutreach() {
  const { organization } = useAuth();
  const outreach = useServerFn(autoOutreachFn);
  const pendingRef = useRef(false);

  const triggerOutreach = useCallback(
    async (leads: LeadForOutreach[]) => {
      if (!organization?.id || leads.length === 0 || pendingRef.current) return;

      const leadsWithEmail = leads.filter((l) => l.email);
      if (leadsWithEmail.length === 0) return;

      pendingRef.current = true;

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          toast.info("Auto-outreach skipped — please sign in again.");
          return;
        }

        const result = await outreach({
          headers: { Authorization: `Bearer ${token}` },
          data: {
            organizationId: organization.id,
            leads: leadsWithEmail.map((l) => ({
              id: l.id,
              name: l.name,
              email: l.email || undefined,
              company: l.company || undefined,
            })),
          },
        });

        if (result.sent > 0) {
          toast.success(
            `Auto-outreach: ${result.sent} email${result.sent > 1 ? "s" : ""} sent!`,
            {
              description:
                result.skipped > 0
                  ? `${result.skipped} skipped — ${result.errors[0] ?? "see message log"}`
                  : "AI-generated personalized emails were dispatched.",
            }
          );
        } else if (result.skipped > 0) {
          // Nothing went out at all — surface the first concrete reason.
          toast.error("Auto-outreach: no emails sent", {
            description: result.errors[0] ?? "All recipients were skipped.",
          });
        }
      } catch (err) {
        console.error("Auto-outreach failed:", err);
        // Silent fail — don't block lead creation UX
        toast.info("Leads added. Auto-outreach will be retried later.", {
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        pendingRef.current = false;
      }
    },
    [organization?.id, outreach]
  );

  return { triggerOutreach };
}

