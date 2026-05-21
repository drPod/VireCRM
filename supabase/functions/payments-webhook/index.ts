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
  const envParam = url.searchParams.get("env");
  if (envParam !== "sandbox" && envParam !== "live") {
    console.error("Webhook env param invalid or missing:", envParam);
    return new Response(
      JSON.stringify({
        error: "Missing or invalid ?env query param (must be 'sandbox' or 'live')",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  const env: StripeEnv = envParam;

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
        await handleCheckoutCompleted(event.data.object, env, event);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscription(event.data.object, env, event);
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

type WebhookFailureKind = "credit_grant" | "missing_user_id" | "missing_org_id" | "rpc_error";

// Insert a dead-letter row so platform admins can triage / replay broken
// webhook deliveries instead of them disappearing into stderr.
async function recordWebhookFailure(params: {
  env: StripeEnv;
  event: { id?: string; type?: string };
  failureKind: WebhookFailureKind;
  stripeObjectId?: string | null;
  errorMessage?: string | null;
  rawPayload: unknown;
}) {
  const { env, event, failureKind, stripeObjectId, errorMessage, rawPayload } = params;
  const { error } = await supabase.from("payment_webhook_failures").insert({
    event_id: event?.id ?? null,
    event_type: event?.type ?? "unknown",
    stripe_object_id: stripeObjectId ?? null,
    failure_kind: failureKind,
    error_message: errorMessage ?? null,
    raw_payload: rawPayload,
    environment: env,
  });
  if (error) {
    console.error("[webhook-failure] failed to log dead-letter row", error);
  }
}

async function maybeMarkAdminQuotePaid(session: any, env: StripeEnv) {
  const quoteId = session.metadata?.admin_quote_id;
  if (!quoteId) return false;
  if (session.payment_status !== "paid") return true;

  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from("admin_quotes")
    .select("status")
    .eq("id", quoteId)
    .maybeSingle();

  if (!existing) {
    console.warn("[admin-quote] checkout for unknown quote", quoteId);
    return true;
  }
  if (existing.status === "paid") return true;

  const { error } = await supabase
    .from("admin_quotes")
    .update({
      status: "paid",
      paid_at: nowIso,
      payment_link_environment: env,
      updated_at: nowIso,
    })
    .eq("id", quoteId);

  if (error) {
    console.error("[admin-quote] failed to mark paid", quoteId, error);
    return true;
  }

  await supabase.from("admin_quote_events").insert({
    quote_id: quoteId,
    event_type: "paid",
    from_status: existing.status,
    to_status: "paid",
    note: `Stripe checkout ${session.id} (${env}) — ${session.amount_total ?? 0}¢`,
  });

  console.log("[admin-quote] marked paid", quoteId, "session", session.id);
  return true;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv, event: any) {
  // Admin (Super Admin) quote payment — short-circuit.
  if (await maybeMarkAdminQuotePaid(session, env)) return;

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
    await maybeGrantCreditPack(session, env, userId, event);
  }
}

async function maybeGrantCreditPack(
  session: any,
  env: StripeEnv,
  userId: string | null,
  event: any,
) {
  try {
    const orgId = session.metadata?.organizationId || null;
    const priceKey: string | null = session.metadata?.priceId || null;

    // Fallback: re-fetch line items if priceId wasn't stamped on metadata.
    if (!priceKey) {
      // Only the lookup_key carries our human-readable priceId; we'd need
      // a stripe API call to resolve. To keep webhook fast and avoid extra
      // gateway calls, require the metadata stamp from create-checkout.
      console.log("[credit-pack] skip — no priceId on session metadata", session.id);
      await recordWebhookFailure({
        env,
        event,
        failureKind: "credit_grant",
        stripeObjectId: session.id ?? null,
        errorMessage: "no priceId on session metadata",
        rawPayload: session,
      });
      return;
    }

    const credits = CREDIT_PACK_PRICES[priceKey];
    if (!credits) return; // not a credit pack purchase

    if (!orgId) {
      console.error("[credit-pack] missing organizationId on session", session.id);
      await recordWebhookFailure({
        env,
        event,
        failureKind: "missing_org_id",
        stripeObjectId: session.id ?? null,
        errorMessage: `missing organizationId on credit-pack session (priceKey=${priceKey})`,
        rawPayload: session,
      });
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
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
          expand: ["latest_charge"],
        });
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
      await recordWebhookFailure({
        env,
        event,
        failureKind: "rpc_error",
        stripeObjectId: session.id ?? null,
        errorMessage: error.message ?? String(error),
        rawPayload: session,
      });
    } else {
      console.log("[credit-pack] granted", credits, "credits to org", orgId, data);
    }
  } catch (e) {
    console.error("[credit-pack] unexpected error", e);
  }
}

async function upsertSubscription(subscription: any, env: StripeEnv, event: any) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    await recordWebhookFailure({
      env,
      event,
      failureKind: "missing_user_id",
      stripeObjectId: subscription.id ?? null,
      errorMessage: "subscription.metadata.userId missing",
      rawPayload: subscription,
    });
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.id;
  const productId =
    typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;

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
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
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
  if (priceId && (subscription.status === "active" || subscription.status === "trialing")) {
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
      } else {
        console.error(
          "[credit-plan] profile.organization_id not found for user",
          userId,
          "subscription",
          subscription.id,
        );
        await recordWebhookFailure({
          env,
          event,
          failureKind: "missing_org_id",
          stripeObjectId: subscription.id ?? null,
          errorMessage: `profile.organization_id not found for user ${userId}`,
          rawPayload: subscription,
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

async function recordTransaction(invoice: any, env: StripeEnv, status: string) {
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
    line_items:
      invoice.lines?.data?.map((l: any) => ({
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
  const customerEmail = invoice.customer_email || invoice.customer_address?.email || null;
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
