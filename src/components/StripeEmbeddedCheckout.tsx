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
  mode: "price";
  priceId: string;
  quantity?: number;
}

export interface StripeResellerCheckoutProps extends StripeCheckoutBaseProps {
  mode: "reseller";
  resellerSlug: string;
  planSlug: string;
}

export type StripeEmbeddedCheckoutProps = StripePriceCheckoutProps | StripeResellerCheckoutProps;

export function StripeEmbeddedCheckoutForm(props: StripeEmbeddedCheckoutProps) {
  const fetchClientSecret = async (): Promise<string> => {
    const environment = getStripeEnvironment();
    if (props.mode === "reseller") {
      const { data, error } = await supabase.functions.invoke("create-reseller-checkout", {
        body: {
          resellerSlug: props.resellerSlug,
          planSlug: props.planSlug,
          customerEmail: props.customerEmail,
          userId: props.userId,
          returnUrl: props.returnUrl,
          environment,
        },
      });
      if (error || !data?.clientSecret) {
        throw new Error(error?.message || "Failed to start checkout");
      }
      return data.clientSecret as string;
    }

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
