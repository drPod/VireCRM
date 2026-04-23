import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Stripe event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscription(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await markSubscriptionDeleted(event.data.object, env);
        break;
      case "invoice.payment_succeeded":
        await verifyInvoiceDiscount(event.data.object, env);
        await recordTransaction(event.data.object, env, "completed");
        break;
      case "invoice.payment_failed":
        await markPastDue(event.data.object, env);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // Verify the launch promo discount actually landed on the session.
  await verifySessionDiscount(session, env);

  // For one-off payments we may want to record a transaction here.
  // Subscription rows are populated by customer.subscription.created.
  if (session.mode === "payment" && session.payment_status === "paid") {
    const userId = session.metadata?.userId || null;
    const resellerId = session.metadata?.attributedResellerId || null;
    const planId = session.metadata?.resellerPlanId || null;

    await supabase.from("transactions").upsert(
      {
        stripe_transaction_id: session.id,
        user_id: userId,
        amount_cents: session.amount_total || 0,
        currency: (session.currency || "usd").toUpperCase(),
        status: "completed",
        environment: env,
        attributed_reseller_id: resellerId,
        reseller_plan_id: planId,
        billed_at: new Date().toISOString(),
        raw_payload: session,
      },
      { onConflict: "stripe_transaction_id" },
    );
  }
}

/**
 * Expected promo discount applied to every checkout: 35% off via the
 * `launch35` Stripe coupon. We tolerate ±1 cent for rounding.
 */
const EXPECTED_DISCOUNT_PERCENT = 35;
const EXPECTED_COUPON_ID = "launch35";

/**
 * Flag any completed checkout session whose total doesn't reflect 35% off
 * the subtotal. Writes a structured row into error_logs so finance/ops can
 * audit it. Never throws — discount auditing must not break webhook ingest.
 */
async function verifySessionDiscount(session: any, env: StripeEnv) {
  try {
    const subtotal = Number(session.amount_subtotal ?? 0);
    const total = Number(session.amount_total ?? 0);
    if (!subtotal || subtotal <= 0) return;

    const expectedTotal = Math.round(subtotal * (1 - EXPECTED_DISCOUNT_PERCENT / 100));
    const drift = Math.abs(total - expectedTotal);
    const couponId =
      session.total_details?.breakdown?.discounts?.[0]?.discount?.coupon?.id ||
      session.discounts?.[0]?.coupon ||
      null;
    const couponOk = couponId === EXPECTED_COUPON_ID;

    if (drift <= 1 && couponOk) return; // healthy

    const reason = !couponOk
      ? `Missing or wrong coupon (got ${couponId ?? "none"}, expected ${EXPECTED_COUPON_ID})`
      : `Total ${total}¢ does not match expected ${expectedTotal}¢ (subtotal ${subtotal}¢, drift ${drift}¢)`;

    console.error(
      `[discount-audit] session=${session.id} env=${env} ${reason}`,
    );

    await supabase.from("error_logs").insert({
      message: `Discount mismatch on checkout.session.completed: ${reason}`,
      url: `stripe://checkout/session/${session.id}`,
      user_id: session.metadata?.userId || null,
      organization_id: session.metadata?.attributedResellerId || null,
      metadata: {
        kind: "discount_mismatch",
        source: "checkout.session.completed",
        session_id: session.id,
        environment: env,
        currency: session.currency,
        amount_subtotal: subtotal,
        amount_total: total,
        expected_total: expectedTotal,
        drift_cents: drift,
        expected_coupon: EXPECTED_COUPON_ID,
        applied_coupon: couponId,
        mode: session.mode,
        customer_email: session.customer_details?.email || session.customer_email || null,
        reseller_plan_id: session.metadata?.resellerPlanId || null,
      },
    });
  } catch (e) {
    console.error("[discount-audit] failed to verify session", e);
  }
}

/**
 * For recurring subscriptions, Stripe issues an invoice on each renewal.
 * We re-check the first paid invoice (billing_reason === "subscription_create")
 * to ensure the coupon was carried into the subscription billing.
 */
async function verifyInvoiceDiscount(invoice: any, env: StripeEnv) {
  try {
    // Only audit the initial subscription invoice — recurring renewals reuse
    // the same coupon (forever) and don't need to be re-flagged repeatedly.
    if (invoice.billing_reason !== "subscription_create") return;

    const subtotal = Number(invoice.subtotal ?? 0);
    const total = Number(invoice.total ?? invoice.amount_paid ?? 0);
    if (!subtotal || subtotal <= 0) return;

    const expectedTotal = Math.round(subtotal * (1 - EXPECTED_DISCOUNT_PERCENT / 100));
    const drift = Math.abs(total - expectedTotal);
    const couponId = invoice.discount?.coupon?.id || invoice.discounts?.[0] || null;
    const couponOk = couponId === EXPECTED_COUPON_ID;

    if (drift <= 1 && couponOk) return;

    const reason = !couponOk
      ? `Missing or wrong coupon on invoice (got ${couponId ?? "none"}, expected ${EXPECTED_COUPON_ID})`
      : `Invoice total ${total}¢ does not match expected ${expectedTotal}¢ (subtotal ${subtotal}¢, drift ${drift}¢)`;

    console.error(
      `[discount-audit] invoice=${invoice.id} env=${env} ${reason}`,
    );

    await supabase.from("error_logs").insert({
      message: `Discount mismatch on invoice.payment_succeeded: ${reason}`,
      url: `stripe://invoice/${invoice.id}`,
      metadata: {
        kind: "discount_mismatch",
        source: "invoice.payment_succeeded",
        invoice_id: invoice.id,
        subscription_id: invoice.subscription,
        environment: env,
        currency: invoice.currency,
        amount_subtotal: subtotal,
        amount_total: total,
        expected_total: expectedTotal,
        drift_cents: drift,
        expected_coupon: EXPECTED_COUPON_ID,
        applied_coupon: couponId,
        billing_reason: invoice.billing_reason,
        customer_email: invoice.customer_email || null,
      },
    });
  } catch (e) {
    console.error("[discount-audit] failed to verify invoice", e);
  }
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.lookup_key ||
    item?.price?.id;
  const productId =
    item?.price?.product?.metadata?.lovable_external_id ||
    (typeof item?.price?.product === "string"
      ? item.price.product
      : item?.price?.product?.id);

  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      attributed_reseller_id: subscription.metadata?.attributedResellerId || null,
      reseller_plan_id: subscription.metadata?.resellerPlanId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function markSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function markPastDue(invoice: any, env: StripeEnv) {
  const subId = invoice.subscription;
  if (!subId) return;
  await supabase
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env);
}

async function recordTransaction(
  invoice: any,
  env: StripeEnv,
  status: string,
) {
  const subId = invoice.subscription;
  let userId: string | null = null;
  let resellerId: string | null = null;
  let planId: string | null = null;

  if (subId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("user_id, attributed_reseller_id, reseller_plan_id")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    if (sub) {
      userId = sub.user_id;
      resellerId = sub.attributed_reseller_id;
      planId = sub.reseller_plan_id;
    }
  }

  await supabase.from("transactions").upsert(
    {
      stripe_transaction_id: invoice.id,
      user_id: userId,
      amount_cents: invoice.amount_paid || invoice.amount_due || 0,
      currency: (invoice.currency || "usd").toUpperCase(),
      status,
      environment: env,
      attributed_reseller_id: resellerId,
      reseller_plan_id: planId,
      billed_at: invoice.created
        ? new Date(invoice.created * 1000).toISOString()
        : new Date().toISOString(),
      raw_payload: invoice,
    },
    { onConflict: "stripe_transaction_id" },
  );
}
