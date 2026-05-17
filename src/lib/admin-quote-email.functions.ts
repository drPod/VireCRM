import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Send an admin quote/proposal to the recipient via the platform email queue.
 *
 * Flow:
 *   1. Verify caller is platform admin.
 *   2. Load the quote.
 *   3. Ensure a stored PDF exists (caller is responsible for regenerating
 *      first if they want a fresh one — we don't silently re-render here).
 *   4. Mint a 7-day signed URL for the PDF.
 *   5. Call the transactional send route as the calling user — that route
 *      handles suppression, unsubscribe tokens, rendering, and enqueue.
 *   6. On success, flip status to `sent`, stamp sent_at, log an event.
 *
 * Returns { success, alreadySent, queued } so the UI can toast accurately.
 */

const inputSchema = z.object({ quoteId: z.string().uuid() });

interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

const formatMoney = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);

export const sendAdminQuoteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1. Platform-admin gate
    const { data: isAdmin } = await supabaseAdmin.rpc("is_platform_admin", { p_user_id: userId });
    if (!isAdmin) throw new Error("Unauthorized: platform admin required");

    // 2. Load quote
    const { data: quote, error } = await supabaseAdmin
      .from("admin_quotes")
      .select("*")
      .eq("id", data.quoteId)
      .single();
    if (error || !quote) throw new Error(error?.message ?? "Quote not found");

    if (!quote.recipient_email) {
      throw new Error("This quote has no recipient email");
    }

    // 3. Resolve PDF signed URL (7 days). Quote must already have a PDF
    // generated — UI flow regenerates before sending.
    if (!quote.pdf_url) {
      throw new Error(
        "Generate the proposal PDF first (Regenerate proposal PDF), then resend.",
      );
    }
    let pdfPath = quote.pdf_url;
    const marker = "/quote-pdfs/";
    const idx = pdfPath.indexOf(marker);
    if (idx >= 0) pdfPath = pdfPath.slice(idx + marker.length);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("quote-pdfs")
      .createSignedUrl(pdfPath, 60 * 60 * 24 * 7); // 7 days
    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message || "Failed to sign PDF URL");
    }

    // 4. Build template data
    const lineItems = (quote.line_items ?? []) as unknown as LineItem[];
    const totalFormatted = formatMoney(quote.total_cents, quote.currency);

    // 5. Call the transactional send route. We re-use the caller's bearer
    // token (already validated by requireSupabaseAuth) so the send route
    // accepts the request and runs its suppression + enqueue logic.
    const incoming = getRequest();
    const accessToken = incoming?.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    if (!accessToken) throw new Error("Missing user session token");

    const requestOrigin = incoming ? new URL(incoming.url).origin : null;
    const origin =
      requestOrigin ||
      process.env.SITE_URL ||
      process.env.PUBLISHED_URL ||
      "https://majix.ai";

    const sendRes = await fetch(`${origin}/api/email/transactional/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        templateName: "quote-proposal",
        recipientEmail: quote.recipient_email,
        idempotencyKey: `quote-${quote.id}-${quote.updated_at ?? quote.created_at}`,
        templateData: {
          recipientName: quote.recipient_name,
          recipientCompany: quote.recipient_company,
          quoteNumber: quote.quote_number,
          title: quote.title,
          totalFormatted,
          validUntil: quote.valid_until,
          lineItems,
          currency: quote.currency,
          pdfUrl: signed.signedUrl,
          paymentLinkUrl: quote.payment_link_url,
          notes: quote.notes,
          senderName: "Majix",
        },
      }),
    });

    if (!sendRes.ok) {
      const detail = await sendRes.text().catch(() => "");
      throw new Error(`Email send failed (${sendRes.status}): ${detail.slice(0, 200)}`);
    }

    const sendBody = (await sendRes.json().catch(() => ({}))) as {
      success?: boolean;
      reason?: string;
      queued?: boolean;
    };

    if (!sendBody.success) {
      // Suppressed / blocked — surface the reason and don't flip status.
      return {
        success: false,
        reason: sendBody.reason ?? "send_blocked",
        queued: false,
      };
    }

    // 6. Mark as sent (only if it wasn't already)
    const wasAlreadySent = quote.status === "sent" || quote.status === "paid";
    if (!wasAlreadySent) {
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("admin_quotes")
        .update({ status: "sent", sent_at: now })
        .eq("id", quote.id);
    }

    await supabaseAdmin.from("admin_quote_events").insert({
      quote_id: quote.id,
      event_type: "email_sent",
      from_status: wasAlreadySent ? quote.status : "draft",
      to_status: wasAlreadySent ? quote.status : "sent",
      actor_user_id: userId,
      note: `Proposal emailed to ${quote.recipient_email}`,
    });

    return { success: true, queued: true, alreadySent: wasAlreadySent };
  });
