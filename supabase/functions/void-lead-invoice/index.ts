// Voids an open Stripe invoice belonging to the caller's org.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, buildCorsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }
  try {
    const auth = req.headers.get("Authorization");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(auth?.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { invoiceId, environment } = await req.json();
    const env: StripeEnv = environment === "live" ? "live" : "sandbox";

    const { data: row } = await supabase
      .from("client_invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!row) throw new Error("Invoice not found");

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", row.organization_id);
    if (!(roles || []).some((r) => r.role === "owner")) throw new Error("Owner only");

    const stripe = createStripeClient(env);
    if (row.stripe_subscription_id) {
      await stripe.subscriptions.cancel(row.stripe_subscription_id, undefined, {
        stripeAccount: row.stripe_account_id,
      });
    } else if (row.stripe_invoice_id) {
      await stripe.invoices.voidInvoice(
        row.stripe_invoice_id,
        {},
        {
          stripeAccount: row.stripe_account_id,
        },
      );
    }

    await supabase
      .from("client_invoices")
      .update({ status: "void", voided_at: new Date().toISOString() })
      .eq("id", invoiceId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("void-lead-invoice error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
