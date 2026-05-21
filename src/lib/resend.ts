/**
 * Resend client — calls the Resend SDK (`resend@6.x`) directly. `RESEND_API_KEY`
 * is set as a Worker secret (`wrangler secret put RESEND_API_KEY`).
 *
 * Per-org settings (verified `from` address, optional `reply_to`) live in
 * `org_integrations.config` under provider = 'resend'.
 *
 * Docs: https://resend.com/docs/api-reference/emails/send-email
 */
import { Resend, type ErrorResponse } from "resend";

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. Set it via `wrangler secret put RESEND_API_KEY`.",
    );
  }
  return new Resend(apiKey);
}

/**
 * Surfaces HTTP status + retry-after up to the dispatcher's existing
 * `isRateLimited` / `isForbidden` / `getRetryAfterSeconds` helpers, which key
 * off `.status` and `.retryAfterSeconds`. The Resend SDK returns `{ data, error }`
 * without throwing — we throw this wrapper so the dispatcher's try/catch path
 * keeps working unchanged.
 */
export class ResendSendError extends Error {
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;
  readonly name = "ResendSendError";
  constructor(err: ErrorResponse) {
    super(err.message);
    this.status = err.statusCode;
    // Resend SDK doesn't surface the Retry-After header — default to 60s on
    // rate limit (matches the dispatcher's prior fallback for unstructured 429s).
    this.retryAfterSeconds = err.statusCode === 429 ? 60 : null;
  }
}

/**
 * Lightweight probe — confirms the API key is accepted by Resend. Uses
 * `domains.list()` because it's a cheap, read-only call that exercises the
 * same auth path as `.emails.send()`. Does NOT verify the sender domain's
 * DNS — that's a separate concern (see Resend dashboard).
 */
export async function verifyResendConnection(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  try {
    const resend = getClient();
    const { error } = await resend.domains.list();
    if (error) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        return {
          ok: false,
          reason: "Resend API key rejected. Check RESEND_API_KEY secret.",
        };
      }
      return {
        ok: false,
        reason: `Resend verify failed (${error.statusCode}): ${error.message.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Couldn't reach Resend.",
    };
  }
}

export interface ResendSendOpts {
  /** Verified Resend sender address. Canonical domain: `notify.virecrm.com`. */
  from: string;
  /** Single recipient (we don't expose batching here — outreach is 1:1). */
  to: string;
  subject: string;
  /** HTML body. Plain text is auto-derived by Resend if `text` not given. */
  html: string;
  /** Optional plain-text body. */
  text?: string;
  /** Optional reply-to address. */
  replyTo?: string;
  /** Optional idempotency key — Resend returns the same response for duplicate keys within 24h. */
  idempotencyKey?: string;
  /** Optional unsubscribe URL — emitted as List-Unsubscribe / List-Unsubscribe-Post headers. */
  unsubscribeUrl?: string;
}

export async function sendResendEmail(opts: ResendSendOpts): Promise<{ messageId: string | null }> {
  const resend = getClient();

  const headers: Record<string, string> = {};
  if (opts.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${opts.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const { data, error } = await resend.emails.send(
    {
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    },
    opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );

  if (error) {
    throw new ResendSendError(error);
  }

  return { messageId: data?.id ?? null };
}
