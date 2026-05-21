import { Card, CardContent } from "@/components/ui/card";

/**
 * Minimal label/value tile used by admin panels (e.g. QuotesPanel header stats).
 * Other routes (_app.admin, _app.gym, _app.funnels, _app.invoices) have richer
 * local StatCard variants that take icons + tones — those are intentionally NOT
 * unified here. Keeping this surface narrow.
 */
export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
