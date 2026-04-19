import { useCallback, useState } from "react";
import {
  StripeEmbeddedCheckoutForm,
  type StripeEmbeddedCheckoutProps,
} from "@/components/StripeEmbeddedCheckout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function useStripeCheckout() {
  const [options, setOptions] = useState<StripeEmbeddedCheckoutProps | null>(
    null,
  );

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
        </DialogHeader>
        {options && <StripeEmbeddedCheckoutForm {...options} />}
      </DialogContent>
    </Dialog>
  );

  return { openCheckout, closeCheckout, isOpen: !!options, CheckoutDialog };
}
