// Platform-admin only. Generates a Stripe Payment Link for an admin quote
// (either the total as one line, or every line item separately) and stores
// the link URL + Stripe IDs back on the quote row.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient, buildCorsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

interface Body {
  quoteId: string;
  mode?: "total" | "items"; // default: "total"
  environment?: StripeEnv; // default: "sandbox"
}

const sanitize = (s: string) => s.replace(/[^\w .,()\-/&]/g, "").slice(0, 250) || "Quote item";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Auth: must be a platform admin.
    const auth = req.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: isAdmin, error: adminErr } = await supabase.rpc("is_platform_admin", {
      p_user_id: user.id,
    });
    if (adminErr) throw adminErr;
    if (!isAdmin) throw new Error("Platform admin only");

    const body: Body = await req.json();
    if (!body.quoteId) throw new Error("quoteId required");
    const mode = body.mode === "items" ? "items" : "total";
    const env: StripeEnv = body.environment === "live" ? "live" : "sandbox";

    // Load the quote.
    const { data: quote, error: qErr } = await supabase
      .from("admin_quotes")
      .select("*")
      .eq("id", body.quoteId)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!quote) throw new Error("Quote not found");
    if (quote.status === "paid" || quote.status === "cancelled") {
      throw new Error(`Cannot create a link for a ${quote.status} quote`);
    }

    const items = (quote.line_items as LineItem[] | null) ?? [];
    const currency = (quote.currency || "usd").toLowerCase();
    const totalCents: number = quote.total_cents ?? 0;
    if (totalCents < 50) throw new Error("Total must be at least $0.50");

    const stripe = createStripeClient(env);

    // Best-effort cleanup of a previously generated link for this quote so
    // regenerating doesn't leave dangling Stripe objects.
    if (quote.stripe_payment_link_id) {
      try {
        await stripe.paymentLinks.update(quote.stripe_payment_link_id, { active: false });
      } catch (e) {
        console.warn("Could not deactivate prior payment link:", (e as Error).message);
      }
    }

    let lineItems: { price: string; quantity: number }[] = [];
    let stripeProductId: string | null = null;
    let stripePriceId: string | null = null;

    if (mode === "items" && items.length > 0) {
      // One Product+Price per line item, all bundled in a single Payment Link.
      for (const li of items) {
        if (!li.description?.trim() || li.quantity < 1 || li.unit_price_cents < 50) continue;
        const product = await stripe.products.create({
          name: sanitize(`${quote.quote_number} — ${li.description}`),
          metadata: { admin_quote_id: quote.id, kind: "quote_item" },
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: li.unit_price_cents,
          currency,
        });
        lineItems.push({ price: price.id, quantity: li.quantity });
      }
      if (lineItems.length === 0) throw new Error("No valid line items to charge");
    } else {
      // Single line for the quote total.
      const product = await stripe.products.create({
        name: sanitize(`${quote.quote_number} — ${quote.title}`),
        metadata: { admin_quote_id: quote.id, kind: "quote_total" },
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: totalCents,
        currency,
      });
      stripeProductId = product.id;
      stripePriceId = price.id;
      lineItems = [{ price: price.id, quantity: 1 }];
    }

    const link = await stripe.paymentLinks.create({
      line_items: lineItems,
      metadata: {
        admin_quote_id: quote.id,
        quote_number: quote.quote_number,
        mode,
        recipient_email: quote.recipient_email,
      },
      allow_promotion_codes: false,
    });

    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = {
      payment_link_url: link.url,
      stripe_payment_link_id: link.id,
      stripe_product_id: stripeProductId,
      stripe_price_id: stripePriceId,
      payment_link_environment: env,
      updated_at: nowIso,
    };
    // If the quote was still a draft, mark it sent now that we have a real link.
    if (quote.status === "draft") {
      patch.status = "sent";
      patch.sent_at = nowIso;
    }

    const { data: updated, error: upErr } = await supabase
      .from("admin_quotes")
      .update(patch)
      .eq("id", quote.id)
      .select()
      .single();
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({
        quote: updated,
        payment_link_url: link.url,
        payment_link_id: link.id,
        environment: env,
        mode,
        line_count: lineItems.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-quote-payment-link error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
