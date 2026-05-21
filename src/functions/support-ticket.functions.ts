import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuth } from "@/auth/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Note: userId / organizationId are intentionally NOT accepted from the
// client. They are derived server-side from the authenticated session to
// prevent attribution spoofing.
const submitSchema = z.object({
  description: z.string().min(1).max(5000),
  errorMessage: z.string().max(2000).optional().nullable(),
  errorStack: z.string().max(8000).optional().nullable(),
  componentStack: z.string().max(8000).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
});

export const submitSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const userId = context.userId;

      // Derive organization_id server-side from the user's profile.
      let organizationId: string | null = null;
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();
      organizationId = (profile?.organization_id as string | null) ?? null;

      const userAgent = getRequestHeader("user-agent") ?? null;
      const ip = (() => {
        try {
          return getRequestIP({ xForwardedFor: true }) ?? null;
        } catch {
          return null;
        }
      })();

      const { data: row, error } = await supabaseAdmin
        .from("support_tickets")
        .insert({
          description: data.description,
          error_message: data.errorMessage ?? null,
          error_stack: data.errorStack ?? null,
          component_stack: data.componentStack ?? null,
          url: data.url ?? null,
          user_agent: userAgent?.slice(0, 1000) ?? null,
          user_id: userId,
          organization_id: organizationId,
          metadata: ip ? { ip } : null,
        })
        .select("id")
        .single();

      if (error) {
        console.error("submitSupportTicket insert error:", error);
        return { success: false as const, error: "Failed to submit report" };
      }
      return { success: true as const, ticketId: row.id };
    } catch (err) {
      console.error("submitSupportTicket failed:", err);
      return { success: false as const, error: "Unexpected error submitting report" };
    }
  });
