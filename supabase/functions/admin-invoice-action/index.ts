// Platform-admin only. Voids a Stripe invoice or refunds the underlying
// payment intent, then mirrors the new state into platform_invoices.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, corsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Body {
  invoiceId: string; // platform_invoices.id
  action: "void" | "refund" | "resend";
  amountCents?: number; // optional partial refund amount
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: isAdminData, error: adminErr } = await supabase.rpc("is_platform_admin", {
      p_user_id: user.id,
    });
    if (adminErr) throw adminErr;
    if (!isAdminData) throw new Error("Platform admin only");

    const body: Body = await req.json();
    if (!body.invoiceId) throw new Error("invoiceId required");
    if (body.action !== "void" && body.action !== "refund" && body.action !== "resend") {
      throw new Error("action must be 'void', 'refund', or 'resend'");
    }

    const { data: row, error: rowErr } = await supabase
      .from("platform_invoices")
      .select("*")
      .eq("id", body.invoiceId)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) throw new Error("Invoice not found");
    if (!row.stripe_invoice_id) throw new Error("Invoice has no Stripe ID");

    const env: StripeEnv = row.environment === "live" ? "live" : "sandbox";
    const stripe = createStripeClient(env);

    if (body.action === "resend") {
      if (row.status === "paid" || row.status === "void" || row.status === "refunded") {
        throw new Error(`Cannot resend a ${row.status} invoice.`);
      }
      const sent = await stripe.invoices.sendInvoice(row.stripe_invoice_id);
      const { data: updated, error: upErr } = await supabase
        .from("platform_invoices")
        .update({
          sent_at: new Date().toISOString(),
          hosted_invoice_url: sent.hosted_invoice_url ?? row.hosted_invoice_url,
          invoice_pdf: sent.invoice_pdf ?? row.invoice_pdf,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select()
        .single();
      if (upErr) throw upErr;
      return new Response(JSON.stringify({ invoice: updated, action: "resend" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "void") {
      if (row.status === "paid") {
        throw new Error("Paid invoices cannot be voided — issue a refund instead.");
      }
      const voided = await stripe.invoices.voidInvoice(row.stripe_invoice_id);

      const { data: updated, error: upErr } = await supabase
        .from("platform_invoices")
        .update({
          status: voided.status || "void",
          voided_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select()
        .single();
      if (upErr) throw upErr;

      return new Response(JSON.stringify({ invoice: updated, action: "void" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "refund"
    if (row.amount_paid_cents <= 0) {
      throw new Error("Nothing to refund — invoice has no payment recorded.");
    }

    // Look up the payment_intent on the Stripe invoice
    const stripeInvoice = await stripe.invoices.retrieve(row.stripe_invoice_id);
    const paymentIntentId =
      typeof stripeInvoice.payment_intent === "string"
        ? stripeInvoice.payment_intent
        : stripeInvoice.payment_intent?.id;
    if (!paymentIntentId) {
      throw new Error("No payment intent on this invoice — cannot refund.");
    }

    const refundAmount = body.amountCents && body.amountCents > 0
      ? Math.min(body.amountCents, row.amount_paid_cents)
      : undefined; // omit -> full refund

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(refundAmount !== undefined ? { amount: refundAmount } : {}),
      reason: body.reason || "requested_by_customer",
      metadata: {
        platform_invoice_id: row.id,
        admin_user_id: user.id,
      },
    });

    const refundedCents = refund.amount ?? refundAmount ?? row.amount_paid_cents;
    const newPaidCents = Math.max(0, row.amount_paid_cents - refundedCents);
    const newStatus = newPaidCents === 0 ? "refunded" : "partially_refunded";

    const { data: updated, error: upErr } = await supabase
      .from("platform_invoices")
      .update({
        amount_paid_cents: newPaidCents,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select()
      .single();
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({
        invoice: updated,
        action: "refund",
        refund_id: refund.id,
        refunded_cents: refundedCents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("admin-invoice-action error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Failed" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
