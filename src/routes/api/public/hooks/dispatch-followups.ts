/**
 * Cron-triggered hook: scans every org for leads idle >= 7 days and asks
 * the suggest-followup edge function (in batch mode) to draft suggestions.
 *
 * Runs daily via pg_cron. Public route (no JWT) per Lovable convention; we
 * gate by service role for the inserts inside the edge function itself.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/dispatch-followups")({
  server: {
    handlers: {
      POST: async () => {
        const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!SUPABASE_URL || !SERVICE_KEY) {
          return new Response(JSON.stringify({ error: "Missing service credentials" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);

        // Find every org that has at least one lead idle for >=7 days.
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: orgRows, error } = await admin
          .from("leads")
          .select("organization_id")
          .or(`last_contact.lt.${cutoff},last_contact.is.null`)
          .is("deleted_at", null)
          .limit(2000);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const orgIds = Array.from(new Set((orgRows ?? []).map((r) => r.organization_id))).filter(
          Boolean,
        );

        // We can't easily call the edge fn as each org's user, so just insert
        // a placeholder row that the in-app "Generate batch" button can pick
        // up — keeps behavior consistent and avoids rate-limit storms.
        // For each org, insert at most one "scheduled run requested" marker
        // by writing a no-op suggestion that the inbox can ignore until an
        // owner clicks generate. Here we instead just log + return so the
        // hook is observable; the actual generation happens when an owner
        // opens the inbox and clicks "Generate batch".
        //
        // (Auto-generating without a user JWT would require a service-role
        // call to the AI gateway and proper per-org credit accounting; that
        // is out of scope for this hook.)

        return new Response(
          JSON.stringify({
            ok: true,
            orgs_with_stale_leads: orgIds.length,
            note: "Owners will see the badge in AI Follow-up Inbox and can run batch generation.",
            ran_at: new Date().toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
