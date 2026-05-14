/**
 * Resend client — calls go through the Lovable connector gateway, which
 * handles auth/refresh transparently. We never store a Resend API key per
 * org: the connection is workspace-level and `RESEND_API_KEY` is injected
 * into the server runtime by the connector.
 *
 * Per-org settings (verified `from` address, optional `reply_to`) are stored
 * in `org_integrations.config` under provider = 'resend'.
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function getGatewayHeaders(): Record<string, string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) {
    throw new Error("LOVABLE_API_KEY is not configured on the server.");
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error(
      "Resend is not connected. Connect the Resend integration from CRM settings to enable sending.",
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": resendKey,
  };
}

/**
 * Lightweight ping to the connector gateway's verify endpoint. Confirms the
 * Resend connection is linked and credentials are valid without spending
 * a real send.
 */
export async function verifyResendConnection(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  try {
    const headers = getGatewayHeaders();
    const res = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
      method: "POST",
      headers,
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason:
          "Resend connection rejected by the gateway. Try disconnecting and reconnecting Resend.",
      };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `Resend verify failed (${res.status}): ${text.slice(0, 200)}`,
      };
    }
    const data = (await res.json().catch(() => ({}))) as {
      outcome?: string;
      error?: string;
    };
    if (data.outcome === "verified" || data.outcome === "skipped") {
      return { ok: true };
    }
    return {
      ok: false,
      reason: data.error ?? "Resend rejected the credentials.",
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Couldn't reach the connector gateway.",
    };
  }
}

export interface ResendSendOpts {
  /** Verified sender address, e.g. `noreply@mail.vireonx.space`. */
  from: string;
  /** Single recipient (we don't expose batching here — outreach is 1:1). */
  to: string;
  subject: string;
  /** HTML body. Plain text is auto-derived by Resend. */
  html: string;
  /** Optional reply-to address. */
  replyTo?: string;
}

export async function sendResendEmail(opts: ResendSendOpts): Promise<{ messageId: string | null }> {
  const headers = getGatewayHeaders();
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend send failed [${res.status}]: ${text.slice(0, 300)}`);
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { messageId: data.id ?? null };
}
