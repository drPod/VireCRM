import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCfHostnameStatus, type CfHostnamePollFn } from "@/hooks/useCfHostnameStatus";
import { CfStatusBadge } from "./DomainHealthStatusBadge";
import { RecordRow } from "./DomainHealthRecordRow";

/**
 * Per-hostname Cloudflare for SaaS status: badge + SSL state + ownership +
 * SSL DCV TXT records. Surfaces the CF custom-hostname + SSL cert state
 * separately from the live HTTPS probe in the parent panel so operators can
 * see when a hostname is still being provisioned vs. fully active.
 */
export function CfHostnameStatus({
  organizationId,
  hostname,
  poll,
}: {
  organizationId: string;
  hostname: string;
  poll: CfHostnamePollFn;
}) {
  const { snapshot, loading, kind, label, errorMsg, refresh } = useCfHostnameStatus(
    organizationId,
    hostname,
    poll,
  );

  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-foreground">Cloudflare for SaaS</span>
        <CfStatusBadge kind={kind} label={label} />
        {snapshot?.sslStatus && (
          <Badge variant="outline" className="text-[10px]">
            SSL: {snapshot.sslStatus}
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-6 gap-1 px-2 text-[10px]"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>
      {errorMsg && <p className="text-[11px] text-muted-foreground">{errorMsg}</p>}
      {snapshot?.ownershipVerification && (
        <RecordRow
          label="Ownership verification (TXT)"
          type="TXT"
          name={snapshot.ownershipVerification.name}
          value={snapshot.ownershipVerification.value}
          note="Add this TXT record at the customer's DNS to prove ownership."
        />
      )}
      {snapshot?.sslValidationRecords?.map((record, idx) => (
        <RecordRow
          key={`${record.name}-${idx}`}
          label={`SSL DCV (TXT)${snapshot.sslValidationRecords.length > 1 ? ` — ${idx + 1}/${snapshot.sslValidationRecords.length}` : ""}`}
          type="TXT"
          name={record.name}
          value={record.value}
          note="Add this TXT record at the customer's DNS so Cloudflare can issue the SSL cert."
        />
      ))}
    </div>
  );
}
