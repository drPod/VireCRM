import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadBillingSummary } from "@/components/crm/LeadDetailDrawer.types";

/**
 * Computes the compact billing summary shown in `LeadDetailDrawer` (count +
 * collected + outstanding + last-paid). Subscribes to realtime updates on the
 * lead's `client_invoices` rows so the card refreshes as Stripe webhooks land.
 */
export function useLeadBillingSummary(
  leadId: string | undefined,
  organizationId: string | undefined,
) {
  const [billingSummary, setBillingSummary] = useState<LeadBillingSummary | null>(null);

  const refresh = useCallback(async () => {
    if (!leadId || !organizationId) {
      setBillingSummary(null);
      return;
    }
    const { data } = await supabase
      .from("client_invoices")
      .select(
        "amount_due_cents, amount_paid_cents, currency, status, is_recurring, paid_at, hosted_invoice_url, created_at",
      )
      .eq("lead_id", leadId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    const rows = data || [];
    if (rows.length === 0) {
      setBillingSummary({
        count: 0,
        collectedCents: 0,
        outstandingCents: 0,
        recurringActive: 0,
        currency: "USD",
        lastPaidAt: null,
        lastInvoiceUrl: null,
      });
      return;
    }
    let collected = 0;
    let outstanding = 0;
    let recurringActive = 0;
    let lastPaidAt: string | null = null;
    for (const r of rows) {
      if (r.status === "paid") {
        collected += r.amount_paid_cents || r.amount_due_cents;
        if (r.paid_at && (!lastPaidAt || r.paid_at > lastPaidAt)) lastPaidAt = r.paid_at;
      } else if (r.status === "open" || r.status === "past_due") {
        outstanding += r.amount_due_cents;
      }
      if (r.is_recurring && (r.status === "active" || r.status === "open")) recurringActive += 1;
    }
    setBillingSummary({
      count: rows.length,
      collectedCents: collected,
      outstandingCents: outstanding,
      recurringActive,
      currency: (rows[0].currency || "USD").toUpperCase(),
      lastPaidAt,
      lastInvoiceUrl: rows.find((r) => r.hosted_invoice_url)?.hosted_invoice_url ?? null,
    });
  }, [leadId, organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!leadId || !organizationId) return;
    const channel = supabase
      .channel(`lead_invoices_${leadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_invoices",
          filter: `lead_id=eq.${leadId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [leadId, organizationId, refresh]);

  return { billingSummary, refresh };
}
