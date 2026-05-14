import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/purge-audit-log")({
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

        const supabase = createClient(import.meta.env.VITE_SUPABASE_URL!, token, {
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
