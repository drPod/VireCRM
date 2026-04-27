/**
 * n8n dispatch router for the AI Advisor "Execute" flow.
 *
 * The Advisor produces a list of actions (create_task, draft_message, etc.).
 * For each action, if the org has registered an n8n webhook URL for that
 * action type, we POST the structured payload there and treat the action as
 * handled externally. Otherwise the caller runs the in-app fallback.
 *
 * Webhook URLs live in `org_connectors` with provider="n8n" and config of
 * shape: { webhooks: { [actionType]: string } }.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type N8nActionType =
  | "create_task"
  | "draft_message"
  | "score_leads"
  | "create_campaign"
  | "pipeline_summary"
  | "note"
  | "update_lead_status"
  | "log_message"
  | "schedule_follow_up"
  | "create_lead";

interface N8nConnectorConfig {
  webhooks?: Partial<Record<N8nActionType, string>>;
}

export interface N8nDispatchResult {
  dispatched: true;
  status: "ok" | "error";
  message: string;
  http_status?: number;
  response_excerpt?: string;
}

export type N8nWebhookMap = Partial<Record<N8nActionType, string>>;

/**
 * Load the n8n webhook map for an org. Returns {} if not configured or
 * the connector row is missing.
 */
export async function loadN8nWebhookMap(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<N8nWebhookMap> {
  const { data } = await supabase
    .from("org_connectors")
    .select("config, enabled")
    .eq("organization_id", organizationId)
    .eq("provider", "n8n")
    .maybeSingle();

  if (!data || data.enabled === false) return {};
  const cfg = (data.config ?? {}) as N8nConnectorConfig;
  const map = cfg.webhooks ?? {};
  // Only keep entries that look like http(s) URLs
  const cleaned: N8nWebhookMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) {
      cleaned[k as N8nActionType] = v.trim();
    }
  }
  return cleaned;
}

/**
 * POST a single action payload to the configured n8n webhook for that type.
 * Returns null if no webhook is configured for the type — caller should
 * then run the in-app fallback.
 */
export async function dispatchToN8n(
  webhookUrl: string | undefined,
  payload: Record<string, unknown>,
): Promise<N8nDispatchResult | null> {
  if (!webhookUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    const excerpt = text ? text.slice(0, 200) : undefined;

    if (!res.ok) {
      return {
        dispatched: true,
        status: "error",
        message: `n8n webhook returned ${res.status}`,
        http_status: res.status,
        response_excerpt: excerpt,
      };
    }

    return {
      dispatched: true,
      status: "ok",
      message: "Handled by n8n workflow",
      http_status: res.status,
      response_excerpt: excerpt,
    };
  } catch (err) {
    return {
      dispatched: true,
      status: "error",
      message:
        err instanceof Error
          ? err.name === "AbortError"
            ? "n8n webhook timed out after 10s"
            : `n8n webhook failed: ${err.message}`
          : "n8n webhook failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
