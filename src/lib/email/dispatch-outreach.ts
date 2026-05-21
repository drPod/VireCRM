/**
 * Internal outreach email dispatcher — server-only.
 *
 * Why this exists: previously the outreach server functions issued an HTTP
 * `fetch(${origin}/api/email/transactional/send)` call back into the same
 * Worker. On Cloudflare that self-loop times out with a 522 (the worker
 * cannot make a request to its own public hostname while still handling the
 * inbound request). The fix is to do the same work in-process: render the
 * template, run the suppression / unsubscribe-token bookkeeping, and enqueue
 * the message via the `enqueue_email` RPC — exactly what the send route does,
 * just without an HTTP hop.
 *
 * Keep the behavior aligned with src/routes/api/email/transactional/send.ts
 * so changes (suppression rules, unsubscribe handling, queue payload shape)
 * stay in sync.
 */

import * as React from "react";
import { render } from "@react-email/components";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { SENDER_DOMAIN, FROM_DOMAIN, SITE_NAME } from "@/config/domains";
import { generateToken } from "@/lib/crypto";


export interface DispatchOutreachInput {
  templateName: string;
  recipientEmail: string;
  templateData: Record<string, unknown>;
  /** Stable key used by the email pipeline to dedupe retries. */
  idempotencyKey: string;
  /** Display name in the From: header (e.g. the org's brand name). */
  fromName?: string | null;
  /** Reply-To address — the user's business inbox. */
  replyTo?: string | null;
}

export type DispatchOutreachResult =
  | { success: true; messageId: string }
  | { success: false; reason: "suppressed" | "render_failed" | "enqueue_failed"; error?: string };

/**
 * Render + enqueue an outreach email in-process. Returns success/failure with
 * a stable `reason` so callers can update message status accordingly.
 */
export async function dispatchOutreachEmail(
  input: DispatchOutreachInput,
): Promise<DispatchOutreachResult> {
  const messageId = crypto.randomUUID();
  const recipient = input.recipientEmail.trim();
  const normalizedEmail = recipient.toLowerCase();

  const template = TEMPLATES[input.templateName];
  if (!template) {
    return {
      success: false,
      reason: "render_failed",
      error: `Template '${input.templateName}' not registered`,
    };
  }

  // 1. Suppression check — fail-closed if the lookup itself fails.
  const { data: suppressed, error: suppressionError } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (suppressionError) {
    return { success: false, reason: "enqueue_failed", error: suppressionError.message };
  }

  if (suppressed) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: input.templateName,
      recipient_email: recipient,
      status: "suppressed",
    });
    return { success: false, reason: "suppressed" };
  }

  // 2. Unsubscribe token (one per email, reused across sends).
  let unsubscribeToken: string;
  const { data: existingToken } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token;
  } else if (!existingToken) {
    unsubscribeToken = generateToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: "email", ignoreDuplicates: true },
      );
    // Re-read so concurrent inserts don't desync us from what's stored.
    const { data: stored } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (!stored) {
      return { success: false, reason: "enqueue_failed", error: "Token storage failed" };
    }
    unsubscribeToken = stored.token;
  } else {
    // Token used but not on suppression list — treat as suppressed defensively.
    return { success: false, reason: "suppressed" };
  }

  // 3. Render template to HTML + plain text.
  let html: string;
  let plainText: string;
  let resolvedSubject: string;
  try {
    const element = React.createElement(template.component, input.templateData);
    html = await render(element);
    plainText = await render(element, { plainText: true });
    resolvedSubject =
      typeof template.subject === "function"
        ? template.subject(input.templateData)
        : template.subject;
  } catch (err) {
    const error = err instanceof Error ? err.message : "render error";
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: input.templateName,
      recipient_email: recipient,
      status: "failed",
      error_message: `Render failed: ${error}`,
    });
    return { success: false, reason: "render_failed", error };
  }

  const bodyPreview = plainText.replace(/\s+/g, " ").trim().slice(0, 200);

  // 4. Log pending then enqueue. Pending is logged first so we still have a
  // record if enqueue itself crashes.
  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: input.templateName,
    recipient_email: recipient,
    status: "pending",
    metadata: { subject: resolvedSubject, body_preview: bodyPreview },
  });

  const fromDisplayName =
    (input.fromName ?? "")
      .trim()
      .replace(/["<>\r\n]/g, "")
      .slice(0, 100) || SITE_NAME;

  const replyToClean = (() => {
    const candidate = (input.replyTo ?? "").trim();
    if (!candidate) return undefined;
    return /^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/.test(candidate)
      ? candidate.toLowerCase()
      : undefined;
  })();

  const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${fromDisplayName} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      body_preview: bodyPreview,
      html,
      text: plainText,
      purpose: "transactional",
      label: input.templateName,
      idempotency_key: input.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      reply_to: replyToClean,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: input.templateName,
      recipient_email: recipient,
      status: "failed",
      error_message: `Enqueue failed: ${enqueueError.message}`,
    });
    return { success: false, reason: "enqueue_failed", error: enqueueError.message };
  }

  return { success: true, messageId };
}
