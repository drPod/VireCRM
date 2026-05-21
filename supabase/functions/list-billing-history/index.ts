import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient, buildCorsHeaders } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface BillingHistoryItem {
  id: string;
  type: "invoice" | "charge";
  number: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  created: number; // unix seconds
  description: string | null;
  hosted_url: string | null; // for viewing in browser
  pdf_url: string | null; // direct PDF download (invoices only)
  receipt_url: string | null; // for one-off charges
}

interface BillingHistoryResponse {
  items: BillingHistoryItem[];
  has_more: boolean;
  next_cursors: { invoice?: string; charge?: string };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      environment?: StripeEnv;
      limit?: number;
      starting_after_invoice?: string;
      starting_after_charge?: string;
    };
    const env = (body.environment || "sandbox") as StripeEnv;
    const rawLimit = Number.isFinite(body.limit) ? Number(body.limit) : DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(rawLimit)));
    const startingAfterInvoice = body.starting_after_invoice;
    const startingAfterCharge = body.starting_after_charge;

    const stripe = createStripeClient(env);

    // Find every Stripe customer the user has been billed under in this env.
    // A user can have multiple subscriptions over time (plan switches, churn-and-return),
    // so we collect all distinct customer IDs.
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .eq("environment", env)
      .not("stripe_customer_id", "is", null);

    const customerIds = Array.from(
      new Set((subs ?? []).map((s) => s.stripe_customer_id).filter(Boolean)),
    ) as string[];

    if (customerIds.length === 0) {
      const empty: BillingHistoryResponse = {
        items: [],
        has_more: false,
        next_cursors: {},
      };
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch up to `limit` invoices + `limit` charges per customer in parallel.
    // Invoices cover subscription billing; charges cover any one-off purchases.
    const invoicePromises = customerIds.map((cid) =>
      stripe.invoices.list({
        customer: cid,
        limit,
        ...(startingAfterInvoice && { starting_after: startingAfterInvoice }),
      }),
    );
    const chargePromises = customerIds.map((cid) =>
      stripe.charges.list({
        customer: cid,
        limit,
        ...(startingAfterCharge && { starting_after: startingAfterCharge }),
      }),
    );

    const [invoiceResults, chargeResults] = await Promise.all([
      Promise.all(invoicePromises),
      Promise.all(chargePromises),
    ]);

    const items: BillingHistoryItem[] = [];

    for (const result of invoiceResults) {
      for (const inv of result.data) {
        items.push({
          id: inv.id ?? "",
          type: "invoice",
          number: inv.number,
          status: inv.status ?? "unknown",
          amount_cents: inv.amount_paid || inv.amount_due || 0,
          currency: inv.currency,
          created: inv.created,
          description:
            inv.lines?.data?.[0]?.description ??
            (inv.lines?.data?.[0] as { plan?: { nickname?: string } | null })?.plan?.nickname ??
            null,
          hosted_url: inv.hosted_invoice_url ?? null,
          pdf_url: inv.invoice_pdf ?? null,
          receipt_url: null,
        });
      }
    }

    // Skip charges that already have a corresponding invoice
    // (Stripe creates a charge for every paid invoice; we don't want duplicates).
    const invoiceChargeIds = new Set(
      invoiceResults.flatMap((r) => r.data.map((i) => i.charge).filter(Boolean)),
    );

    for (const result of chargeResults) {
      for (const ch of result.data) {
        if (invoiceChargeIds.has(ch.id)) continue;
        if (ch.invoice) continue;
        items.push({
          id: ch.id,
          type: "charge",
          number: null,
          status: ch.status,
          amount_cents: ch.amount,
          currency: ch.currency,
          created: ch.created,
          description: ch.description,
          hosted_url: ch.receipt_url ?? null,
          pdf_url: null,
          receipt_url: ch.receipt_url ?? null,
        });
      }
    }

    // Newest first
    items.sort((a, b) => b.created - a.created);

    const nextCursorFrom = <T extends { id?: string | null }>(
      results: { has_more: boolean; data: T[] }[],
    ): { hasMore: boolean; cursor: string | undefined } => {
      const hasMore = results.some((r) => r.has_more);
      if (!hasMore) return { hasMore, cursor: undefined };
      const cursor = results
        .map((r) => r.data[r.data.length - 1]?.id)
        .filter((id): id is string => Boolean(id))
        .pop();
      return { hasMore, cursor };
    };

    const { hasMore: invoiceHasMore, cursor: lastInvoiceId } = nextCursorFrom(invoiceResults);
    const { hasMore: chargeHasMore, cursor: lastChargeId } = nextCursorFrom(chargeResults);

    const response: BillingHistoryResponse = {
      items,
      has_more: invoiceHasMore || chargeHasMore,
      next_cursors: {
        ...(lastInvoiceId && { invoice: lastInvoiceId }),
        ...(lastChargeId && { charge: lastChargeId }),
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
