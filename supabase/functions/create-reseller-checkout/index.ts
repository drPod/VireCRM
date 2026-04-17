// Creates (or reuses) a one-off Paddle price at the marked-up amount for a
// specific reseller plan, and returns the Paddle internal price ID so the
// frontend can open Paddle Checkout. The price is created under the same
// underlying base product so subscription renewals keep the same product
// identity, but the unit_price reflects the reseller's chosen markup.
//
// Idempotency: we tag created prices with custom_data.reseller_plan_id so we
// can find and reuse the existing Paddle price on subsequent calls instead
// of creating a new one every time.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface RequestBody {
  resellerPlanId: string;
  environment?: PaddleEnv;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { resellerPlanId, environment = 'sandbox' } = (await req.json()) as RequestBody;
    if (!resellerPlanId) {
      return new Response(JSON.stringify({ error: 'resellerPlanId required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch the reseller plan
    const { data: plan, error: planErr } = await supabase
      .from('reseller_plans')
      .select('id, reseller_id, name, base_price_id, monthly_price_cents, currency, is_active')
      .eq('id', resellerPlanId)
      .maybeSingle();

    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }
    if (!plan.is_active) {
      return new Response(JSON.stringify({ error: 'Plan is not active' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Resolve the base product/price from Paddle to inherit billing_cycle + product_id
    const baseLookupResp = await gatewayFetch(
      environment,
      `/prices?external_id=${encodeURIComponent(plan.base_price_id)}&include=product`,
    );
    const baseLookup = await baseLookupResp.json();
    if (!baseLookupResp.ok || !baseLookup.data?.length) {
      console.error('Base price lookup failed:', baseLookup);
      return new Response(
        JSON.stringify({ error: `Base price not found: ${plan.base_price_id}` }),
        { status: 502, headers: corsHeaders },
      );
    }
    const basePrice = baseLookup.data[0];
    const productId: string = basePrice.product_id;
    const billingCycle = basePrice.billing_cycle ?? { interval: 'month', frequency: 1 };

    // Try to reuse existing reseller price by matching custom_data.reseller_plan_id
    const listResp = await gatewayFetch(
      environment,
      `/prices?product_id=${encodeURIComponent(productId)}&per_page=200`,
    );
    const listJson = await listResp.json();
    let existingId: string | null = null;
    if (listResp.ok && Array.isArray(listJson.data)) {
      for (const p of listJson.data) {
        if (
          p?.custom_data?.reseller_plan_id === plan.id &&
          String(p?.unit_price?.amount) === String(plan.monthly_price_cents) &&
          p?.status === 'active'
        ) {
          existingId = p.id;
          break;
        }
      }
    }

    if (existingId) {
      return new Response(
        JSON.stringify({
          paddlePriceId: existingId,
          resellerPlanId: plan.id,
          resellerId: plan.reseller_id,
          reused: true,
        }),
        { headers: corsHeaders },
      );
    }

    // Create a new price tied to the same product, but at the marked-up amount.
    const createResp = await gatewayFetch(environment, '/prices', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        description: `Reseller plan: ${plan.name}`,
        billing_cycle: billingCycle,
        unit_price: {
          amount: String(plan.monthly_price_cents),
          currency_code: plan.currency,
        },
        quantity: { minimum: 1, maximum: 1 },
        custom_data: {
          reseller_plan_id: plan.id,
          reseller_id: plan.reseller_id,
          base_price_id: plan.base_price_id,
        },
      }),
    });
    const createJson = await createResp.json();
    if (!createResp.ok || !createJson.data?.id) {
      console.error('Failed to create reseller Paddle price:', createJson);
      return new Response(
        JSON.stringify({ error: 'Could not create reseller price', detail: createJson }),
        { status: 502, headers: corsHeaders },
      );
    }

    return new Response(
      JSON.stringify({
        paddlePriceId: createJson.data.id,
        resellerPlanId: plan.id,
        resellerId: plan.reseller_id,
        reused: false,
      }),
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error('create-reseller-checkout error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: corsHeaders },
    );
  }
});
