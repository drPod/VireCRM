// SendGrid REST client — server-side only.
// Docs: https://docs.sendgrid.com/api-reference
//
// Unlike Apollo/Hunter/Snov, SendGrid is purely an email-send provider
// (no lead-finding). It joins our BYO API-key flow because SendGrid is NOT
// available as a one-click Lovable Connector.

const SENDGRID_BASE = "https://api.sendgrid.com/v3";

export async function verifySendgridKey(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${SENDGRID_BASE}/scopes`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason: "SendGrid rejected this API key. Make sure it has at least 'Mail Send' permission.",
      };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `SendGrid responded ${res.status}: ${text.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Couldn't reach SendGrid",
    };
  }
}

export interface SendgridSendOpts {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  /** HTML body. Plain text is auto-derived by SendGrid. */
  html: string;
  /** Optional reply-to address. */
  replyTo?: string;
}

export async function sendSendgridEmail(
  opts: SendgridSendOpts,
): Promise<{ messageId: string | null }> {
  const res = await fetch(`${SENDGRID_BASE}/mail/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: opts.to }] }],
      from: { email: opts.from },
      reply_to: opts.replyTo ? { email: opts.replyTo } : undefined,
      subject: opts.subject,
      content: [{ type: "text/html", value: opts.html }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SendGrid send failed [${res.status}]: ${text.slice(0, 300)}`);
  }

  // SendGrid returns the message id in the X-Message-Id header.
  return { messageId: res.headers.get("x-message-id") };
}
