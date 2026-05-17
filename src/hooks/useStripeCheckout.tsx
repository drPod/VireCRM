import { useCallback, useState } from "react";
import {
  StripeEmbeddedCheckoutForm,
  type StripeEmbeddedCheckoutProps,
} from "@/components/StripeEmbeddedCheckout";
import { TermsCheckbox } from "@/components/auth/TermsCheckbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function CheckoutBody({ options }: { options: StripeEmbeddedCheckoutProps }) {
  const [accepted, setAccepted] = useState(false);

  if (!accepted) {
    return (
      <div className="space-y-4 py-2">
        <p className="text-sm text-muted-foreground">
          Before continuing to payment, please review and accept our Terms. Payments are{" "}
          <span className="font-semibold text-foreground">final and non-refundable</span>.
        </p>
        <TermsCheckbox checked={accepted} onCheckedChange={setAccepted} />
        <Button
          variant="command"
          className="w-full"
          disabled={!accepted}
          onClick={() => setAccepted(true)}
        >
          Continue to Payment
        </Button>
      </div>
    );
  }

  return <StripeEmbeddedCheckoutForm {...options} />;
}

export function useStripeCheckout() {
  const [options, setOptions] = useState<StripeEmbeddedCheckoutProps | null>(null);

  const openCheckout = useCallback((opts: StripeEmbeddedCheckoutProps) => {
    setOptions(opts);
  }, []);

  const closeCheckout = useCallback(() => setOptions(null), []);

  const CheckoutDialog = (
    <Dialog
      open={!!options}
      onOpenChange={(open) => {
        if (!open) closeCheckout();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4">
        <DialogHeader>
          <DialogTitle>Complete your purchase</DialogTitle>
          <DialogDescription>
            Review the Majix Terms &amp; Conditions before payment.
          </DialogDescription>
        </DialogHeader>
        {options && (
          <CheckoutBody
            key={
              options.mode === "price"
                ? options.priceId
                : `${options.resellerSlug}/${options.planSlug}`
            }
            options={options}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  return { openCheckout, closeCheckout, isOpen: !!options, CheckoutDialog };
}
