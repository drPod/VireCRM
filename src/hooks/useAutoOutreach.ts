import { useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autoOutreachFn } from "@/functions/auto-outreach.functions";
import { useAuth } from "@/components/auth/AuthProvider";
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
        const result = await outreach({
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
          toast.success(`Auto-outreach: ${result.sent} email${result.sent > 1 ? "s" : ""} sent!`, {
            description: "AI-generated personalized emails were sent to your new leads.",
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
