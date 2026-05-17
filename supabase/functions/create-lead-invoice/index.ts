// Creates and (optionally) sends a Stripe invoice or recurring subscription
// FROM the caller's connected Stripe account TO a lead (acting as customer).
// Stores a mirror row in client_invoices.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, buildCorsHeaders } from "../_shared/stripe.ts";

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
  leadId: string;
  description?: string;
  lineItems: LineItem[];
  currency?: string;
  dueDays?: number;
  isRecurring?: boolean;
  interval?: "month" | "year";
  send?: boolean;
  environment?: "sandbox" | "live";
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
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

    const body: Body = await req.json();
    const env: StripeEnv = body.environment === "live" ? "live" : "sandbox";

    if (!body.leadId) throw new Error("leadId required");
    if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
      throw new Error("At least one line item required");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.organization_id) throw new Error("No organization");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id);
    const isOwner = (roles || []).some((r) => r.role === "owner");
    if (!isOwner) throw new Error("Only owners can send invoices");

    const { data: account } = await supabase
      .from("client_stripe_accounts")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (!account?.stripe_account_id) {
      throw new Error("Connect your Stripe account first");
    }
    if (!account.charges_enabled) {
      throw new Error(
        "Your Stripe account is not yet ready to accept charges. Finish onboarding first.",
      );
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("id, name, email, organization_id")
      .eq("id", body.leadId)
      .maybeSingle();
    if (!lead || lead.organization_id !== profile.organization_id) {
      throw new Error("Lead not found");
    }
    if (!lead.email) throw new Error("Lead has no email — add one before invoicing");

    const stripe = createStripeClient(env);
    const stripeAccount = account.stripe_account_id;
    const currency = (body.currency || account.default_currency || "usd").toLowerCase();

    // 1. Customer (idempotent by email on connected account)
    const existingCustomers = await stripe.customers.list(
      { email: lead.email, limit: 1 },
      { stripeAccount },
    );
    const customer =
      existingCustomers.data[0] ??
      (await stripe.customers.create(
        { email: lead.email, name: lead.name, metadata: { lead_id: lead.id } },
        { stripeAccount },
      ));

    let invoiceRow: Record<string, unknown> = {
      organization_id: profile.organization_id,
      lead_id: lead.id,
      stripe_account_id: stripeAccount,
      stripe_customer_id: customer.id,
      currency,
      description: body.description || null,
      line_items: body.lineItems,
      is_recurring: !!body.isRecurring,
      interval: body.isRecurring ? body.interval || "month" : null,
      environment: env,
      created_by: user.id,
    };

    if (body.isRecurring) {
      // RECURRING: create products+prices, then a subscription that bills automatically
      const items = [];
      for (const li of body.lineItems) {
        const product = await stripe.products.create({ name: li.description }, { stripeAccount });
        const price = await stripe.prices.create(
          {
            unit_amount: li.amount_cents,
            currency,
            recurring: { interval: body.interval || "month" },
            product: product.id,
          },
          { stripeAccount },
        );
        items.push({ price: price.id, quantity: li.quantity || 1 });
      }
      const subscription = await stripe.subscriptions.create(
        {
          customer: customer.id,
          items,
          collection_method: "send_invoice",
          days_until_due: body.dueDays || 14,
          metadata: { lead_id: lead.id, organization_id: profile.organization_id },
        },
        { stripeAccount },
      );
      const totalCents = body.lineItems.reduce(
        (sum, li) => sum + li.amount_cents * (li.quantity || 1),
        0,
      );
      invoiceRow = {
        ...invoiceRow,
        stripe_subscription_id: subscription.id,
        amount_due_cents: totalCents,
        status: subscription.status,
        sent_at: new Date().toISOString(),
      };
    } else {
      // ONE-OFF: create draft invoice + items, optionally finalize+send
      const invoice = await stripe.invoices.create(
        {
          customer: customer.id,
          collection_method: "send_invoice",
          days_until_due: body.dueDays || 14,
          description: body.description || undefined,
          metadata: { lead_id: lead.id, organization_id: profile.organization_id },
        },
        { stripeAccount },
      );
      for (const li of body.lineItems) {
        await stripe.invoiceItems.create(
          {
            customer: customer.id,
            invoice: invoice.id,
            amount: li.amount_cents * (li.quantity || 1),
            currency,
            description: li.description,
          },
          { stripeAccount },
        );
      }

      let finalInvoice = invoice;
      if (body.send !== false) {
        finalInvoice = await stripe.invoices.finalizeInvoice(invoice.id, {}, { stripeAccount });
        finalInvoice = await stripe.invoices.sendInvoice(invoice.id, {}, { stripeAccount });
      }

      invoiceRow = {
        ...invoiceRow,
        stripe_invoice_id: finalInvoice.id,
        hosted_invoice_url: finalInvoice.hosted_invoice_url,
        invoice_pdf: finalInvoice.invoice_pdf,
        number: finalInvoice.number,
        amount_due_cents: finalInvoice.amount_due,
        amount_paid_cents: finalInvoice.amount_paid,
        status: finalInvoice.status || "draft",
        due_date: finalInvoice.due_date
          ? new Date(finalInvoice.due_date * 1000).toISOString()
          : null,
        sent_at: body.send !== false ? new Date().toISOString() : null,
      };
    }

    const { data: row, error: insErr } = await supabase
      .from("client_invoices")
      .insert(invoiceRow)
      .select()
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ invoice: row }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-lead-invoice error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
