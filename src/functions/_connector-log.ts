// Best-effort writer for `connector_activity_log`. Never throws — logging
// failures must not break the actual outbound action.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ConnectorLogInput {
  organizationId: string;
  userId?: string | null;
  leadId?: string | null;
  provider: string;
  direction: "outbound" | "inbound";
  action: string;
  status?: "success" | "failed" | "partial";
  summary?: string | null;
  errorMessage?: string | null;
  payload?: Record<string, unknown>;
}

export async function recordConnectorActivity(input: ConnectorLogInput): Promise<void> {
  try {
    await supabaseAdmin.from("connector_activity_log").insert({
      organization_id: input.organizationId,
      user_id: input.userId ?? null,
      lead_id: input.leadId ?? null,
      provider: input.provider,
      direction: input.direction,
      action: input.action,
      status: input.status ?? "success",
      summary: input.summary ?? null,
      error_message: input.errorMessage ?? null,
      payload: (input.payload ?? {}) as never,
    });
  } catch (err) {
    console.warn("[connector-log] insert failed", err);
  }
}
