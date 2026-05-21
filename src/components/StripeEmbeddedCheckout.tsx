import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

export interface StripeCheckoutBaseProps {
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
  organizationId?: string;
}

export interface StripePriceCheckoutProps extends StripeCheckoutBaseProps {
  priceId: string;
  quantity?: number;
}

export type StripeEmbeddedCheckoutProps = StripePriceCheckoutProps;

export function StripeEmbeddedCheckoutForm(props: StripeEmbeddedCheckoutProps) {
  const fetchClientSecret = async (): Promise<string> => {
    const environment = getStripeEnvironment();
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        priceId: props.priceId,
        quantity: props.quantity,
        customerEmail: props.customerEmail,
        userId: props.userId,
        returnUrl: props.returnUrl,
        environment,
        organizationId: props.organizationId,
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Failed to start checkout");
    }
    return data.clientSecret as string;
  };

  return (
    <div id="checkout" className="min-h-[500px]">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
