// Platform-admin only. Creates a Stripe invoice on the PLATFORM Stripe
// account (not a connected account) for the email on a contact submission,
// then mirrors it into platform_invoices. The hosted invoice URL doubles
// as the payment link the prospect can use.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, corsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface LineItem {
  description: string;
  amount_cents: number;
  quantity?: number;
}

interface Body {
  submissionId: string;
  description?: string;
  lineItems: LineItem[];
  currency?: string;
  dueDays?: number;
  send?: boolean;
  environment?: StripeEnv;
  /** Plan key (e.g. "full_ownership") to auto-grant on payment via webhook. */
  grantPlan?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Platform-admin gate
    const { data: isAdminData, error: adminErr } = await supabase.rpc("is_platform_admin", {
      p_user_id: user.id,
    });
    if (adminErr) throw adminErr;
    if (!isAdminData) throw new Error("Platform admin only");

    const body: Body = await req.json();
    const env: StripeEnv = body.environment === "live" ? "live" : "sandbox";

    if (!body.submissionId) throw new Error("submissionId required");
    if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
      throw new Error("At least one line item required");
    }
    for (const li of body.lineItems) {
      if (!li.description || typeof li.amount_cents !== "number" || li.amount_cents < 50) {
        throw new Error("Each line item needs a description and amount_cents >= 50");
      }
    }

    const { data: sub, error: subErr } = await supabase
      .from("contact_submissions")
      .select("id, name, email, company, project_type")
      .eq("id", body.submissionId)
      .maybeSingle();
    if (subErr) throw subErr;
    if (!sub) throw new Error("Submission not found");
    if (!sub.email) throw new Error("Submission has no email");

    const stripe = createStripeClient(env);
    const currency = (body.currency || "usd").toLowerCase();

    // 1) Prefer our mapping table (per-environment) so repeat submissions
    //    from the same email always reuse the same Stripe customer.
    // 2) Fall back to a Stripe email lookup, then create as a last resort.
    let customer: { id: string } | null = null;

    const { data: mapped } = await supabase
      .from("submission_stripe_customers")
      .select("stripe_customer_id")
      .eq("email", sub.email)
      .eq("environment", env)
      .maybeSingle();

    if (mapped?.stripe_customer_id) {
      try {
        const c = await stripe.customers.retrieve(mapped.stripe_customer_id);
        if (c && !(c as { deleted?: boolean }).deleted) customer = c as { id: string };
      } catch (_e) {
        customer = null; // stripe customer was deleted — recreate below
      }
    }

    if (!customer) {
      const existing = await stripe.customers.list({ email: sub.email, limit: 1 });
      customer = existing.data[0] ?? null;
    }

    if (!customer) {
      customer = await stripe.customers.create({
        email: sub.email,
        name: sub.name || undefined,
        metadata: {
          submission_id: sub.id,
          source: "contact_submission",
          ...(sub.company ? { company: sub.company } : {}),
        },
      });
    }

    // Persist / refresh the mapping so subsequent submissions reuse it.
    await supabase.from("submission_stripe_customers").upsert(
      {
        email: sub.email,
        environment: env,
        stripe_customer_id: customer.id,
        first_submission_id: sub.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email,environment" },
    );

    // Draft invoice with metadata so the webhook can match it back
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: body.dueDays ?? 14,
      description:
        body.description ||
        `Genesis — ${sub.project_type ?? "project"} for ${sub.company ?? sub.name}`,
      metadata: {
        submission_id: sub.id,
        platform_invoice: "true",
        ...(body.grantPlan ? { grant_plan: body.grantPlan } : {}),
      },
    });

    for (const li of body.lineItems) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        amount: li.amount_cents * (li.quantity || 1),
        currency,
        description: li.description,
      });
    }

    let finalInvoice = invoice;
    if (body.send !== false) {
      finalInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      finalInvoice = await stripe.invoices.sendInvoice(invoice.id);
    }

    const totalCents = body.lineItems.reduce(
      (sum, li) => sum + li.amount_cents * (li.quantity || 1),
      0,
    );

    const row = {
      submission_id: sub.id,
      customer_email: sub.email,
      customer_name: sub.name,
      stripe_customer_id: customer.id,
      stripe_invoice_id: finalInvoice.id,
      hosted_invoice_url: finalInvoice.hosted_invoice_url,
      invoice_pdf: finalInvoice.invoice_pdf,
      number: finalInvoice.number,
      description:
        body.description ||
        `Genesis — ${sub.project_type ?? "project"} for ${sub.company ?? sub.name}`,
      amount_due_cents: finalInvoice.amount_due ?? totalCents,
      amount_paid_cents: finalInvoice.amount_paid ?? 0,
      currency,
      status: finalInvoice.status || "draft",
      line_items: body.lineItems,
      due_date: finalInvoice.due_date ? new Date(finalInvoice.due_date * 1000).toISOString() : null,
      sent_at: body.send !== false ? new Date().toISOString() : null,
      environment: env,
      created_by: user.id,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("platform_invoices")
      .insert(row)
      .select()
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ invoice: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-submission-invoice error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
