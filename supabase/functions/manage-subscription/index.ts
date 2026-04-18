// Lets the authenticated user cancel, resume, or change the price of their own
// Paddle subscription. The webhook will sync the resulting state back to the
// `subscriptions` table — this function only triggers the action.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

interface RequestBody {
  action: 'cancel' | 'resume' | 'change_price';
  // For change_price: the human-readable external_id (e.g. "crm_growth_monthly")
  newPriceExternalId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401);

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    if (!body || !body.action) return json({ error: 'Invalid body' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: subs } = await admin
      .from('subscriptions')
      .select('paddle_subscription_id, environment, status')
      .eq('user_id', user.id)
      .neq('environment', 'manual')
      .order('updated_at', { ascending: false })
      .limit(5);

    const sub = (subs ?? []).find(
      (s) => s.paddle_subscription_id && !s.paddle_subscription_id.startsWith('txn_'),
    );
    if (!sub) return json({ error: 'No managed subscription found' }, 404);

    const env = sub.environment as PaddleEnv;
    const paddle = getPaddleClient(env);
    const subId = sub.paddle_subscription_id;

    if (body.action === 'cancel') {
      // Cancel at period end so the user keeps access until then.
      // deno-lint-ignore no-explicit-any
      await (paddle as any).subscriptions.cancel(subId, { effectiveFrom: 'next_billing_period' });
      return json({ success: true, action: 'cancel' });
    }

    if (body.action === 'resume') {
      // If subscription is canceled at period end, "resume" by removing scheduled change.
      // deno-lint-ignore no-explicit-any
      await (paddle as any).subscriptions.update(subId, { scheduledChange: null });
      return json({ success: true, action: 'resume' });
    }

    if (body.action === 'change_price') {
      if (!body.newPriceExternalId) return json({ error: 'newPriceExternalId required' }, 400);

      // Resolve external_id -> Paddle internal price id
      const priceLookup = await fetch(
        `https://connector-gateway.lovable.dev/paddle/prices?external_id=${encodeURIComponent(body.newPriceExternalId)}`,
        {
          headers: {
            'X-Connection-Api-Key': env === 'sandbox'
              ? Deno.env.get('PADDLE_SANDBOX_API_KEY')!
              : Deno.env.get('PADDLE_LIVE_API_KEY')!,
            'Lovable-API-Key': Deno.env.get('LOVABLE_API_KEY')!,
          },
        },
      );
      const priceJson = await priceLookup.json();
      const newPriceId = priceJson?.data?.[0]?.id;
      if (!newPriceId) return json({ error: `Price not found: ${body.newPriceExternalId}` }, 404);

      // deno-lint-ignore no-explicit-any
      await (paddle as any).subscriptions.update(subId, {
        items: [{ priceId: newPriceId, quantity: 1 }],
        prorationBillingMode: 'prorated_immediately',
      });
      return json({ success: true, action: 'change_price', newPriceId });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('manage-subscription error:', msg);
    return json({ error: msg }, 500);
  }
});
