# stripe-node — context7 reference chunks

Source: `mcp__context7__query-docs` against `/stripe/stripe-node` (v19.1.0 indexed; mirror targets v22+).
Topic: webhook signature verification, Cloudflare Workers, fetch HTTP client, async `constructEvent`, `createSubtleCryptoProvider`.
Snapshot: 2026-05-22.

Regenerate via the Claude Code MCP — see `scripts/sync-stripe-node-docs.sh` for the procedure (no CLI equivalent exists).

---

## Generate Test Webhook Signature Header in Stripe Node.js

Source: https://github.com/stripe/stripe-node/blob/master/README.md

Create a mock Stripe webhook signature header for testing purposes using a payload string and a secret, then use it to construct and verify a test event.

```javascript
const payload = {
  id: 'evt_test_webhook',
  object: 'event',
};

const payloadString = JSON.stringify(payload, null, 2);
const secret = 'whsec_test_secret';

const header = stripeClient.webhooks.generateTestHeaderString({
  payload: payloadString,
  secret,
});

const event = stripeClient.webhooks.constructEvent(payloadString, header, secret);

// Do something with mocked signed event
expect(event.id).to.equal(payload.id);
```

---

## Construct Webhook Event in Stripe Node.js

Source: https://github.com/stripe/stripe-node/blob/master/README.md

Verify the authenticity of a Stripe webhook event by constructing it using the raw request body, the Stripe signature header, and your webhook secret.

```javascript
const event = stripeClient.webhooks.constructEvent(
  webhookRawBody,
  webhookStripeSignatureHeader,
  webhookSecret
);
```

---

## Configure Stripe Client with HTTP Protocol for Local Proxies in Node.js

Source: https://github.com/stripe/stripe-node/wiki/Migration-guide-for-v8

This snippet demonstrates how to instantiate the Stripe client with a non-HTTPS protocol (e.g., HTTP) using the `protocol` option in `stripe-node` v8.0.0. This feature is intended for testing and local proxy setups, replacing deprecated `stripe.setProtocol()` and `stripe.setHost()` methods. Production traffic must always use HTTPS.

```javascript
const stripe = new Stripe(apiKey, {
  host: '127.0.0.1',
  port: 3000,
  protocol: 'http',
});
```

---

## Webhook signing

Source: https://github.com/stripe/stripe-node/blob/master/README.md

Stripe can optionally sign webhook events to validate they were not sent by a third-party. The raw request body, exactly as received from Stripe, must be passed to the `constructEvent()` function for validation. The `generateTestHeaderString` method can be used to mock and test webhook events during development.

---

## Checking webhook signatures — install and run (Express example)

Source: https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/README.md

To get started with the webhook signing example, first navigate into one of the provided sample directories, such as `cd examples/webhook-signing/express`. Once there, install the project's dependencies using `npm install`. It is crucial to update your `.env` file with your personal Stripe API keys for the application to function correctly. You will also need to install the Stripe CLI and authenticate it with your Stripe account by running `stripe login`. After authentication, initiate webhook forwarding by executing `stripe listen --forward-to localhost:3000/webhook`; this command will provide a unique webhook signing secret (e.g., `whsec_xxx`) that must be copied into your `.env` file. Finally, in a separate terminal, start the local sample server by running `./main.ts`, and then trigger a test event, like `stripe trigger payment_intent.succeeded`, to observe the webhook event details being logged in your Node.js console.
