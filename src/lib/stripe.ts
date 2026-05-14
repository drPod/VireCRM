import { loadStripe, type Stripe } from "@stripe/stripe-js";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) {
      throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
    }
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): "sandbox" | "live" {
  // Live ONLY when the publishable key explicitly starts with pk_live_.
  // Anything else (missing, pk_test_, malformed) → sandbox. This MUST agree
  // with useSubscription's getEnvForMode so writes/reads target the same env.
  return clientToken?.startsWith("pk_live_") ? "live" : "sandbox";
}

export function isStripeConfigured(): boolean {
  return Boolean(clientToken);
}
