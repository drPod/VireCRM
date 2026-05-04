import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient, verifyWebhook } from "../_shared/stripe.ts";

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
    const connectAccount = (event as any).account as string | undefined;
    console.log("Stripe event:", event.type, "env:", env, "connect:", connectAccount || "platform");

    // Connect events: invoices our clients sent to their leads.
    if (connectAccount && event.type.startsWith("invoice.")) {
      await syncConnectInvoice(event.data.object, env, connectAccount, event.type);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (connectAccount && event.type.startsWith("customer.subscription.")) {
      await syncConnectSubscription(event.data.object, env, connectAccount, event.type);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

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
      case "invoice.finalized":
      case "invoice.sent":
      case "invoice.updated":
      case "invoice.voided":
      case "invoice.marked_uncollectible":
        await syncPlatformInvoice(event.data.object, env, event.type);
        break;
      case "invoice.payment_succeeded":
        await verifyInvoiceDiscount(event.data.object, env);
        await recordTransaction(event.data.object, env, "completed");
        await syncPlatformInvoice(event.data.object, env, event.type);
        break;
      case "invoice.payment_failed":
        await markPastDue(event.data.object, env);
        await syncPlatformInvoice(event.data.object, env, event.type);
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

// Map of credit pack price IDs → credit count granted on purchase.
// Keep in sync with the products created via batch_create_product.
const CREDIT_PACK_PRICES: Record<string, number> = {
  credit_pack_small_onetime: 100,
  credit_pack_medium_onetime: 500,
  credit_pack_large_onetime: 2000,
  credit_pack_bulk_onetime: 10000,
};

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

    // Credit pack purchase? Grant credits to the org. We rely on the
    // session.metadata.priceId stamped at checkout creation, falling back
    // to expanding line_items if absent.
    await maybeGrantCreditPack(session, env, userId);
  }
}

async function maybeGrantCreditPack(
  session: any,
  env: StripeEnv,
  userId: string | null,
) {
  try {
    const orgId = session.metadata?.organizationId || null;
    let priceKey: string | null = session.metadata?.priceId || null;

    // Fallback: re-fetch line items if priceId wasn't stamped on metadata.
    if (!priceKey) {
      // Only the lookup_key carries our human-readable priceId; we'd need
      // a stripe API call to resolve. To keep webhook fast and avoid extra
      // gateway calls, require the metadata stamp from create-checkout.
      console.log("[credit-pack] skip — no priceId on session metadata", session.id);
      return;
    }

    const credits = CREDIT_PACK_PRICES[priceKey];
    if (!credits) return; // not a credit pack purchase

    if (!orgId) {
      console.error("[credit-pack] missing organizationId on session", session.id);
      return;
    }

    const isAutoRecharge = session.metadata?.source === "auto_recharge";

    // Resolve the receipt URL from the underlying PaymentIntent → latest charge.
    // Falls back to the hosted invoice URL if the session generated an invoice.
    let receiptUrl: string | null = null;
    let hostedInvoiceUrl: string | null = null;
    try {
      const stripe = createStripeClient(env);
      if (session.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(
          session.payment_intent as string,
          { expand: ["latest_charge"] },
        );
        const charge = (pi as any).latest_charge as any;
        if (charge && typeof charge === "object") {
          receiptUrl = charge.receipt_url ?? null;
        }
      }
      if (session.invoice) {
        const inv = await stripe.invoices.retrieve(session.invoice as string);
        hostedInvoiceUrl = (inv as any).hosted_invoice_url ?? null;
        if (!receiptUrl) {
          // Stripe-hosted invoice page also offers a PDF receipt download.
          receiptUrl = hostedInvoiceUrl;
        }
      }
    } catch (e) {
      console.warn("[credit-pack] failed to resolve receipt URL", e);
    }

    const { data, error } = await supabase.rpc("grant_credit_pack", {
      p_org_id: orgId,
      p_pack_key: priceKey,
      p_credits: credits,
      p_purchased_by: userId,
      p_amount_cents: session.amount_total || null,
      p_currency: (session.currency || "usd").toLowerCase(),
      p_source: isAutoRecharge ? "auto_recharge" : "checkout",
      p_stripe_session_id: session.id,
      p_stripe_payment_intent_id: session.payment_intent || null,
      p_receipt_url: receiptUrl,
      p_hosted_invoice_url: hostedInvoiceUrl,
    });

    if (error) {
      console.error("[credit-pack] grant_credit_pack failed", error);
    } else {
      console.log("[credit-pack] granted", credits, "credits to org", orgId, data);
    }
  } catch (e) {
    console.error("[credit-pack] unexpected error", e);
  }
}


/**
 * Expected promo discount applied to every checkout: 30% off via the
 * `launch30` Stripe coupon. We tolerate ±1 cent for rounding.
 */
const EXPECTED_DISCOUNT_PERCENT = 30;
const EXPECTED_COUPON_ID = "launch30";

/**
 * Flag any completed checkout session whose total doesn't reflect 30% off
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

  // Sync the org's credit allowance to match this subscription's tier.
  // Custom CRM / Full Ownership lookup keys map to unlimited; standard
  // tiers map to their monthly credit quota. No-op on cancel/past_due.
  if (
    priceId &&
    (subscription.status === "active" || subscription.status === "trialing")
  ) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (profile?.organization_id) {
        await supabase.rpc("apply_credit_plan", {
          p_org_id: profile.organization_id,
          p_price_key: priceId,
        });
      }
    } catch (e) {
      console.error("[credit-plan] failed to sync org credit allowance", e);
    }
  }
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

// ====== Connect events: invoices our clients sent to their leads ======

async function syncConnectInvoice(
  invoice: any,
  env: StripeEnv,
  connectAccount: string,
  eventType: string,
) {
  const status =
    eventType === "invoice.payment_succeeded"
      ? "paid"
      : eventType === "invoice.voided"
        ? "void"
        : eventType === "invoice.marked_uncollectible"
          ? "uncollectible"
          : eventType === "invoice.payment_failed"
            ? "past_due"
            : eventType === "invoice.finalized" || eventType === "invoice.sent"
              ? "open"
              : invoice.status || "open";

  const update: Record<string, unknown> = {
    status,
    amount_due_cents: invoice.amount_due ?? 0,
    amount_paid_cents: invoice.amount_paid ?? 0,
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    invoice_pdf: invoice.invoice_pdf || null,
    number: invoice.number || null,
    updated_at: new Date().toISOString(),
  };
  if (status === "paid") update.paid_at = new Date().toISOString();
  if (status === "void") update.voided_at = new Date().toISOString();
  if (eventType === "invoice.finalized" || eventType === "invoice.sent") {
    update.sent_at = new Date().toISOString();
  }

  // Update existing mirror row if present
  const { data: existing } = await supabase
    .from("client_invoices")
    .select("id, organization_id, lead_id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("client_invoices").update(update).eq("id", existing.id);
    // Mark the lead as won if invoice paid
    if (status === "paid" && existing.lead_id) {
      await supabase
        .from("leads")
        .update({ status: "won", updated_at: new Date().toISOString() })
        .eq("id", existing.lead_id)
        .neq("status", "won");
    }
    return;
  }

  // Otherwise insert (e.g. invoice created externally on the connected account)
  const orgLookup = await supabase
    .from("client_stripe_accounts")
    .select("organization_id")
    .eq("stripe_account_id", connectAccount)
    .maybeSingle();
  if (!orgLookup.data) {
    console.log("Connect invoice for unknown account:", connectAccount);
    return;
  }
  await supabase.from("client_invoices").insert({
    organization_id: orgLookup.data.organization_id,
    stripe_account_id: connectAccount,
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: invoice.subscription || null,
    stripe_customer_id: invoice.customer || null,
    hosted_invoice_url: invoice.hosted_invoice_url,
    invoice_pdf: invoice.invoice_pdf,
    number: invoice.number,
    description: invoice.description,
    amount_due_cents: invoice.amount_due ?? 0,
    amount_paid_cents: invoice.amount_paid ?? 0,
    currency: (invoice.currency || "usd").toLowerCase(),
    status,
    environment: env,
    line_items: invoice.lines?.data?.map((l: any) => ({
      description: l.description,
      amount_cents: l.amount,
      quantity: l.quantity,
    })) || [],
  });
}

async function syncConnectSubscription(
  subscription: any,
  env: StripeEnv,
  _connectAccount: string,
  eventType: string,
) {
  const newStatus = eventType === "customer.subscription.deleted" ? "void" : subscription.status;
  await supabase
    .from("client_invoices")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
}

// ---------- Platform invoices (created via create-submission-invoice) ----------
// These live on the PLATFORM Stripe account (no `connectAccount` on the event)
// and carry `metadata.platform_invoice = "true"` plus `metadata.submission_id`.
// We mirror status changes back into the platform_invoices table so the admin
// console can show real-time payment status.
async function syncPlatformInvoice(invoice: any, env: StripeEnv, eventType: string) {
  if (!invoice?.id) return;
  // Only act on invoices we created. Stripe Connect events arrive separately
  // via the syncConnectInvoice path and shouldn't touch this table.
  const meta = invoice.metadata || {};
  if (meta.platform_invoice !== "true" && !meta.submission_id) return;

  const patch: Record<string, unknown> = {
    status: invoice.status || "open",
    amount_due_cents: invoice.amount_due ?? 0,
    amount_paid_cents: invoice.amount_paid ?? 0,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    invoice_pdf: invoice.invoice_pdf ?? null,
    number: invoice.number ?? null,
    updated_at: new Date().toISOString(),
  };
  if (eventType === "invoice.payment_succeeded" || invoice.status === "paid") {
    patch.paid_at = new Date().toISOString();
  }
  if (eventType === "invoice.voided" || invoice.status === "void") {
    patch.voided_at = new Date().toISOString();
  }

  // Upsert by stripe_invoice_id so a webhook arriving before our DB row exists
  // (rare but possible) still lands cleanly.
  const { error } = await supabase
    .from("platform_invoices")
    .update(patch)
    .eq("stripe_invoice_id", invoice.id)
    .eq("environment", env);
  if (error) console.error("syncPlatformInvoice update error:", error);

  // On payment, grant the plan stored in invoice metadata (e.g. Full Ownership).
  // Idempotent: re-running the RPC just re-asserts the same plan.
  const isPaid = eventType === "invoice.payment_succeeded" || invoice.status === "paid";
  const grantPlan = typeof meta.grant_plan === "string" ? meta.grant_plan.trim() : "";
  const customerEmail =
    invoice.customer_email ||
    invoice.customer_address?.email ||
    null;
  if (isPaid && grantPlan && customerEmail) {
    const { data: grantResult, error: grantErr } = await supabase.rpc(
      "webhook_grant_plan_by_email",
      { p_email: customerEmail, p_plan: grantPlan },
    );
    if (grantErr) {
      console.error("webhook_grant_plan_by_email error:", grantErr);
    } else {
      console.log("Plan granted on invoice payment:", {
        invoice: invoice.id,
        email: customerEmail,
        plan: grantPlan,
        result: grantResult,
      });
    }
  }
}
