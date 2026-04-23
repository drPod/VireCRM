import { useCallback, useRef } from "react";
import { autoOutreachFn } from "@/functions/auto-outreach.functions";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedServerFn } from "@/hooks/useAuthedServerFn";
import { isAuthError } from "@/lib/server-fn-auth";
import { toast } from "sonner";

interface LeadForOutreach {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  /**
   * Where the lead came from. Auto-outreach only fires for leads sourced
   * from real data integrations (Apollo / Hunter / Snov) — not from
   * manual entry, CSV imports, or speculative AI suggestions.
   */
  source?: string | null;
}

/**
 * Sources that represent verified leads from real data integrations.
 * Anything outside this set will not trigger auto-outreach — the user can
 * still email those leads manually from the lead drawer.
 */
const INTEGRATION_SOURCES = new Set<string>([
  "apollo",
  "hunter",
  "snov",
  // Legacy tag used before per-provider sourcing — still treated as integration-sourced.
  "ai_discovery",
  // CSV/XLSX imports — the user uploaded these addresses, so they've vouched
  // for them. Auto-outreach is opt-in via the import dialog toggle.
  "csv_import",
  "xlsx_import",
  // Apollo list import — same idea: user-supplied verified addresses.
  "apollo_list_import",
  // Leads created by the AI Advisor task dispatcher.
  "ai_advisor_task",
]);

export function useAutoOutreach() {
  const { organization } = useAuth();
  const outreach = useAuthedServerFn(autoOutreachFn);
  const pendingRef = useRef(false);

  const triggerOutreach = useCallback(
    async (leads: LeadForOutreach[]) => {
      if (!organization?.id || leads.length === 0 || pendingRef.current) return;

      // Step 1: drop anything without an email — outreach can't send to nothing.
      const leadsWithEmail = leads.filter((l) => l.email);
      if (leadsWithEmail.length === 0) return;

      // Step 2: enforce integration-only sourcing. This is the gate that
      // prevents AI-guessed or manually entered leads from being blasted with
      // automated emails to addresses that may not be real.
      const integrationLeads = leadsWithEmail.filter((l) =>
        l.source ? INTEGRATION_SOURCES.has(l.source) : false
      );

      if (integrationLeads.length === 0) {
        toast.info("Auto-outreach skipped", {
          description:
            "Auto-outreach only runs on leads from integrations (Apollo, Hunter, Snov), CSV/XLSX imports, or the AI Advisor. Manually-added leads can still be emailed from the lead drawer.",
        });
        return;
      }

      pendingRef.current = true;

      try {
        const result = await outreach({
          data: {
            organizationId: organization.id,
            leads: integrationLeads.map((l) => ({
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
                  : "AI-personalized emails were dispatched to integration-verified leads.",
            }
          );
        } else if (result.skipped > 0) {
          // Nothing went out at all — surface the first concrete reason.
          toast.error("Auto-outreach: no emails sent", {
            description: result.errors[0] ?? "All recipients were skipped.",
          });
        }
      } catch (err) {
        // Auth errors already surfaced by useAuthedServerFn — stay silent here.
        if (isAuthError(err)) return;
        console.error("Auto-outreach failed:", err);
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
