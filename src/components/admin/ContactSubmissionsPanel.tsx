import { Loader2, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useContactSubmissions } from "@/hooks/useContactSubmissions";

import { SubmissionTable } from "./SubmissionTable";

/**
 * Admin contact-submissions panel — last 200 inquiries from the public
 * `/contact` form, with row expansion for full message body, AI classification
 * metadata, Stripe invoice creation, and the per-submission payment-history
 * view. Container wires the `useContactSubmissions` hook through to the
 * `SubmissionTable` sibling; the heavy invoice + payment-history logic lives
 * in `SubmissionInvoicePanel` + `SubmissionPaymentHistory`.
 */
export function ContactSubmissionsPanel() {
  const { rows, loading, search, setSearch, expanded, savingId, filtered, load, toggleRow, setStatus } =
    useContactSubmissions();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Contact Submissions</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Latest 200 inquiries. Click a row to see the full message, AI classification, and send
            an invoice.
            {rows ? (
              <>
                {" "}
                Showing {filtered.length} of {rows.length}.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search submissions…"
              className="w-56 pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !rows ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No submissions match.</p>
        ) : (
          <SubmissionTable
            rows={filtered}
            expanded={expanded}
            savingId={savingId}
            onToggleRow={toggleRow}
            onSetStatus={(id, status) => void setStatus(id, status)}
          />
        )}
      </CardContent>
    </Card>
  );
}
