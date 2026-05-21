import * as React from "react";
import { render } from "@react-email/components";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { generateToken } from "@/lib/crypto";
import { SENDER_DOMAIN, FROM_DOMAIN, SITE_NAME } from "@/config/domains";

export interface SendTransactionalEmailInput {
  supabase: SupabaseClient;
  templateName: string;
  templateData: Record<string, unknown>;
  recipientEmail?: string;
  /** Overrides template.to AND recipientEmail — use for test-mode inbox redirects. */
  recipientOverride?: string;
  fromName?: string | null;
  replyTo?: string | null;
  idempotencyKey: string;
}

export type SendTransactionalEmailResult =
  | { success: true; messageId: string }
  | {
      success: false;
      reason: "template_not_found" | "suppressed" | "enqueue_failed";
      error?: string;
    };

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<SendTransactionalEmailResult> {
  const { supabase, templateName, templateData, fromName, replyTo, idempotencyKey } = input;

  const template = TEMPLATES[templateName];
  if (!template) {
    return { success: false, reason: "template_not_found", error: `Template '${templateName}' not found` };
  }

  const effectiveRecipient = input.recipientOverride ?? template.to ?? input.recipientEmail;
  if (!effectiveRecipient) {
    return { success: false, reason: "template_not_found", error: "No recipient" };
  }

  const normalizedRecipient = effectiveRecipient.toLowerCase();

  // Suppression check
  const { data: suppressed } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalizedRecipient)
    .maybeSingle();
  if (suppressed) return { success: false, reason: "suppressed" };

  // Reuse-or-create unsubscribe token (one per email address)
  let unsubscribeToken: string;
  const { data: existingToken } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedRecipient)
    .maybeSingle();

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token as string;
  } else if (existingToken?.used_at) {
    // Used token means the address unsubscribed — treat as suppressed
    return { success: false, reason: "suppressed" };
  } else {
    unsubscribeToken = generateToken();
    await supabase
      .from("email_unsubscribe_tokens")
      .upsert({ token: unsubscribeToken, email: normalizedRecipient }, {
        onConflict: "email",
        ignoreDuplicates: true,
      });
    const { data: stored } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedRecipient)
      .maybeSingle();
    if (!stored) return { success: false, reason: "enqueue_failed", error: "Failed to store unsubscribe token" };
    unsubscribeToken = stored.token as string;
  }

  // Render template
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const plainText = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;
  const bodyPreview = plainText.replace(/\s+/g, " ").trim().slice(0, 200);

  const messageId = crypto.randomUUID();
  const fromDisplayName = fromName?.trim() || SITE_NAME;

  // Log pending before enqueue so we have a record even if enqueue crashes
  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: "pending",
    metadata: { subject, body_preview: bodyPreview },
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${fromDisplayName} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      body_preview: bodyPreview,
      html,
      text: plainText,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      reply_to: replyTo ?? undefined,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    return { success: false, reason: "enqueue_failed", error: enqueueError.message };
  }

  return { success: true, messageId };
}
