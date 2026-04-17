import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log('Received event:', event.eventType, 'env:', env);

    switch (event.eventType) {
      case EventName.SubscriptionCreated:
        await handleSubscriptionCreated(event.data, env);
        break;
      case EventName.SubscriptionUpdated:
        await handleSubscriptionUpdated(event.data, env);
        break;
      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event.data, env);
        break;
      case EventName.TransactionCompleted:
        await handleTransactionCompleted(event.data, env);
        break;
      case EventName.TransactionPaymentFailed:
        console.log('Payment failed:', event.data.id, 'env:', env);
        break;
      // Refunds in Paddle are modeled as adjustments. We act on adjustment.updated
      // because that's when status flips from `pending` -> `approved`. We also
      // handle adjustment.created in case it lands in `approved` immediately.
      case (EventName as any).AdjustmentCreated ?? 'adjustment.created':
      case 'adjustment.created' as any:
      case (EventName as any).AdjustmentUpdated ?? 'adjustment.updated':
      case 'adjustment.updated' as any:
        await handleAdjustment(event.data, env);
        break;
      default:
        console.log('Unhandled event:', event.eventType);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
});

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;

  const userId = customData?.userId;
  if (!userId) {
    console.error('No userId in customData');
    return;
  }

  const item = items[0];
  const priceId = item.price.importMeta?.externalId || item.price.id;
  const productId = item.product.importMeta?.externalId || item.product.id;

  // Resolve reseller attribution. customData.resellerId is the reseller's organization UUID.
  let attributedResellerId: string | null = null;
  const rawResellerId = customData?.resellerId;
  if (rawResellerId) {
    const { data: resellerRow } = await supabase
      .from('organizations')
      .select('id, is_reseller')
      .eq('id', rawResellerId)
      .maybeSingle();
    if (resellerRow?.is_reseller) {
      attributedResellerId = resellerRow.id;
    } else {
      console.warn('resellerId did not match an active reseller org:', rawResellerId);
    }
  }

  // Resolve reseller plan attribution (for markup-based payouts).
  let resellerPlanId: string | null = null;
  const rawPlanId = customData?.resellerPlanId;
  if (rawPlanId) {
    const { data: planRow } = await supabase
      .from('reseller_plans')
      .select('id, reseller_id')
      .eq('id', rawPlanId)
      .maybeSingle();
    if (planRow) {
      resellerPlanId = planRow.id;
      // If we have a plan but no explicit reseller, infer reseller from plan
      if (!attributedResellerId) attributedResellerId = planRow.reseller_id;
    }
  }

  await supabase.from('subscriptions').upsert({
    user_id: userId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status: status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    environment: env,
    attributed_reseller_id: attributedResellerId,
    reseller_plan_id: resellerPlanId,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,environment',
  });
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange } = data;

  await supabase.from('subscriptions')
    .update({
      status: status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === 'cancel',
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await supabase.from('subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', data.id)
    .eq('environment', env);
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const { id, customerId, subscriptionId, items, customData, billedAt, currencyCode, details } = data;

  const userId = customData?.userId;
  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId || item?.price?.id;

  // Persist one-time purchases as a permanent subscription row (existing behavior)
  if (item && !item.price?.billingCycle && userId) {
    await supabase.from('subscriptions').upsert({
      user_id: userId,
      paddle_subscription_id: `txn_${id}`,
      paddle_customer_id: customerId,
      product_id: priceId?.includes('enterprise') ? 'custom_enterprise' : 'full_ownership',
      price_id: priceId,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: null,
      environment: env,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,environment',
    });
  }

  // Record the actual transaction for payout calculation.
  // Resolve attribution: prefer the subscription's stored reseller + plan, fall back to customData.
  let subscriptionRowId: string | null = null;
  let attributedResellerId: string | null = null;
  let attributedPlanId: string | null = null;
  let resolvedUserId: string | null = userId ?? null;

  if (subscriptionId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, user_id, attributed_reseller_id, reseller_plan_id')
      .eq('paddle_subscription_id', subscriptionId)
      .eq('environment', env)
      .maybeSingle();
    if (sub) {
      subscriptionRowId = sub.id;
      attributedResellerId = sub.attributed_reseller_id ?? null;
      attributedPlanId = sub.reseller_plan_id ?? null;
      resolvedUserId = resolvedUserId ?? sub.user_id;
    }
  }

  // Last-resort attribution from customData (e.g. one-time checkouts via /r/:slug)
  if (!attributedResellerId && customData?.resellerId) {
    const { data: resellerRow } = await supabase
      .from('organizations')
      .select('id, is_reseller')
      .eq('id', customData.resellerId)
      .maybeSingle();
    if (resellerRow?.is_reseller) attributedResellerId = resellerRow.id;
  }
  if (!attributedPlanId && customData?.resellerPlanId) {
    const { data: planRow } = await supabase
      .from('reseller_plans')
      .select('id, reseller_id')
      .eq('id', customData.resellerPlanId)
      .maybeSingle();
    if (planRow) {
      attributedPlanId = planRow.id;
      if (!attributedResellerId) attributedResellerId = planRow.reseller_id;
    }
  }

  // Amount: Paddle gives grandTotal as a string in minor units
  const grandTotalRaw =
    details?.totals?.grandTotal ??
    details?.totals?.grand_total ??
    data?.payoutTotals?.grandTotal;
  const amountCents = grandTotalRaw != null ? Math.abs(Number(grandTotalRaw)) : 0;

  if (amountCents > 0) {
    const { error: txErr } = await supabase.from('transactions').upsert({
      paddle_transaction_id: id,
      paddle_subscription_id: subscriptionId ?? null,
      subscription_id: subscriptionRowId,
      user_id: resolvedUserId,
      attributed_reseller_id: attributedResellerId,
      reseller_plan_id: attributedPlanId,
      amount_cents: amountCents,
      currency: currencyCode ?? 'USD',
      status: 'completed',
      environment: env,
      billed_at: billedAt ?? new Date().toISOString(),
      raw_payload: data,
    }, { onConflict: 'paddle_transaction_id' });
    if (txErr) console.error('Failed to record transaction:', txErr);
  } else {
    console.log('Transaction completed with zero/missing amount, skipping insert:', id);
  }

  console.log('Transaction completed:', id, 'env:', env);
}

async function handleAdjustment(data: any, env: PaddleEnv) {
  // Paddle adjustment payload (camelCased by SDK):
  //   { id, action, status, transactionId, subscriptionId, totals: { total }, ... }
  // We only care about approved refunds. Skip credits, chargebacks, pending, rejected.
  const action: string | undefined = data?.action;
  const status: string | undefined = data?.status;
  if (action !== 'refund') {
    console.log('Skipping non-refund adjustment:', { id: data?.id, action, status });
    return;
  }
  if (status !== 'approved') {
    console.log('Skipping non-approved refund adjustment:', { id: data?.id, status });
    return;
  }

  const adjustmentId: string | undefined = data?.id;
  const transactionId: string | undefined = data?.transactionId ?? data?.transaction_id;
  const subscriptionId: string | undefined = data?.subscriptionId ?? data?.subscription_id;
  const refundedAt: string =
    data?.updatedAt ?? data?.createdAt ?? new Date().toISOString();

  // Refund amount in minor units. Adjustment totals.total is the canonical field;
  // fall back to a few alternates in case the SDK shape shifts.
  const grandTotalStr: string | number | undefined =
    data?.totals?.total ??
    data?.payoutTotals?.total ??
    data?.details?.totals?.grandTotal ??
    data?.details?.totals?.grand_total;
  const refundAmountCents = grandTotalStr != null ? Math.abs(Number(grandTotalStr)) : 0;

  if (!transactionId || !subscriptionId || !refundAmountCents) {
    console.log('Refund adjustment missing required fields:', {
      adjustmentId, transactionId, subscriptionId, refundAmountCents, env,
    });
    return;
  }

  const { data: result, error } = await supabase.rpc('apply_refund_adjustment', {
    p_paddle_subscription_id: subscriptionId,
    p_refund_transaction_id: transactionId,
    p_refund_amount_cents: refundAmountCents,
    p_refund_at: refundedAt,
    p_environment: env,
  });

  if (error) {
    console.error('apply_refund_adjustment failed:', error);
    return;
  }
  console.log('Refund adjustment applied:', { adjustmentId, transactionId, env, result });
}
