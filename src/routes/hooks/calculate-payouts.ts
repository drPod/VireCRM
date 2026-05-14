import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Monthly cron-triggered route that calculates reseller payouts for the
 * previous calendar month. Idempotent — safe to re-run for the same period
 * since it upserts into reseller_payouts and only updates rows still in
 * 'pending' status (paid/void payouts are preserved).
 *
 * Cron schedule: 1st of every month at 02:00 UTC.
 */
export const Route = createFileRoute("/hooks/calculate-payouts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "");

        if (!token) {
          return new Response(JSON.stringify({ error: "Missing authorization header" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Allow overriding the period from the cron body for backfills/manual runs
        let body: { periodStart?: string; periodEnd?: string } = {};
        try {
          body = await request.json();
        } catch {
          // empty body is fine
        }

        // Default: previous calendar month
        const now = new Date();
        const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
        const periodStart = body.periodStart || defaultStart.toISOString().slice(0, 10);
        const periodEnd = body.periodEnd || defaultEnd.toISOString().slice(0, 10);

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data, error } = await supabase.rpc("calculate_reseller_payouts", {
          p_period_start: periodStart,
          p_period_end: periodEnd,
        });

        if (error) {
          console.error("Payout calc failed:", error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        console.log("Payouts calculated:", data);
        return new Response(JSON.stringify({ success: true, result: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
