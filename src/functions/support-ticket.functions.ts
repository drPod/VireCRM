import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const submitSchema = z.object({
  description: z.string().min(1).max(5000),
  errorMessage: z.string().max(2000).optional().nullable(),
  errorStack: z.string().max(8000).optional().nullable(),
  componentStack: z.string().max(8000).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  organizationId: z.string().uuid().optional().nullable(),
});

export const submitSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    try {
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
          user_id: data.userId ?? null,
          organization_id: data.organizationId ?? null,
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
