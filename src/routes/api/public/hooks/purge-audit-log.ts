import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/purge-audit-log")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Cron-only endpoint — gated by a shared secret, not a JWT, since
        // pg_cron has no user identity. Matches sibling hooks.
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "Server not configured" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data, error } = await supabase.rpc("purge_advisor_audit_log");

        if (error) {
          console.error("[purge-audit-log] error:", error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        console.log("[purge-audit-log] result:", data);
        return new Response(JSON.stringify({ success: true, result: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
