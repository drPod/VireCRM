// Generates a Paddle customer portal session URL for the authenticated user
// based on their current subscription. Opens in a new tab from the client.
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Find the user's most recent Paddle subscription (skip "manual" / lifetime rows).
    const { data: subs } = await admin
      .from('subscriptions')
      .select('paddle_customer_id, paddle_subscription_id, environment, status')
      .eq('user_id', user.id)
      .neq('environment', 'manual')
      .order('updated_at', { ascending: false })
      .limit(5);

    const sub = (subs ?? []).find((s) => s.paddle_customer_id && !s.paddle_customer_id.startsWith('manual_'));
    if (!sub) {
      return json({ error: 'No managed subscription found. Lifetime / manual accounts have no portal.' }, 404);
    }

    const env = sub.environment as PaddleEnv;
    const paddle = getPaddleClient(env);

    // The Paddle SDK expects: create(customerId, subscriptionIds[])
    const subIds = sub.paddle_subscription_id && !sub.paddle_subscription_id.startsWith('txn_')
      ? [sub.paddle_subscription_id]
      : [];

    // deno-lint-ignore no-explicit-any
    const session: any = await (paddle as any).customerPortalSessions.create(
      sub.paddle_customer_id,
      subIds,
    );

    const url =
      session?.urls?.general?.overview ||
      session?.urls?.subscriptions?.[0]?.cancelSubscription ||
      session?.urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod ||
      null;

    if (!url) return json({ error: 'Could not create portal session' }, 502);

    return json({ url });
  } catch (err) {
    console.error('customer-portal error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
