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
      // @ts-ignore — EventName.TransactionRefunded may not be exported in all SDK versions
      case (EventName as any).TransactionRefunded ?? 'transaction.refunded':
      case 'transaction.refunded' as any:
        await handleTransactionRefunded(event.data, env);
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
  // Handle one-time purchases (Full Ownership, Custom Enterprise)
  const { id, customerId, items, customData } = data;
  
  const userId = customData?.userId;
  if (!userId) {
    console.log('Transaction completed without userId:', id);
    return;
  }

  // Check if this is a one-time purchase (no subscription)
  const item = items[0];
  const priceId = item.price.importMeta?.externalId || item.price.id;
  
  // If it's a one-time purchase (no billing cycle), store as a permanent subscription
  if (!item.price.billingCycle) {
    const productId = item.price.productId;
    
    await supabase.from('subscriptions').upsert({
      user_id: userId,
      paddle_subscription_id: `txn_${id}`,
      paddle_customer_id: customerId,
      product_id: priceId.includes('enterprise') ? 'custom_enterprise' : 'full_ownership',
      price_id: priceId,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: null, // perpetual
      environment: env,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,environment',
    });
  }

  console.log('Transaction completed:', id, 'env:', env);
}

async function handleTransactionRefunded(data: any, env: PaddleEnv) {
  // Fired when a refund is approved. Payload shape (camelCased by SDK):
  //   { id, subscriptionId, details: { totals: { grandTotal } }, ... }
  // Fall back across a few field names because Paddle sends slightly different
  // shapes for transaction.refunded vs adjustment.created.
  const transactionId: string | undefined = data?.id;
  const subscriptionId: string | undefined = data?.subscriptionId ?? data?.subscription_id;
  const refundedAt: string =
    data?.updatedAt ?? data?.refundedAt ?? data?.createdAt ?? new Date().toISOString();

  // Refund amount in minor units. Try a few plausible paths.
  const grandTotalStr: string | number | undefined =
    data?.details?.totals?.grandTotal ??
    data?.details?.totals?.grand_total ??
    data?.payoutTotals?.grandTotal ??
    data?.totals?.grandTotal ??
    data?.amount;
  const refundAmountCents = grandTotalStr != null ? Math.abs(Number(grandTotalStr)) : 0;

  if (!transactionId || !subscriptionId || !refundAmountCents) {
    console.log('Refund webhook missing required fields:', {
      transactionId, subscriptionId, refundAmountCents, env,
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
  console.log('Refund adjustment applied:', { transactionId, env, result });
}
