import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ConnectorStatus } from "@/functions/connectors.functions";

interface ConnectorStatusBadgeProps {
  status: ConnectorStatus | undefined;
  loading: boolean;
}

export function ConnectorStatusBadge({ status, loading }: ConnectorStatusBadgeProps) {
  const enabled = !!status?.enabled;
  const credentialPresent = !!status?.credentialPresent;
  const verified = status?.verified;

  if (loading || !enabled) {
    return (
      <Badge variant="outline" className="text-[10px]">
        Not connected
      </Badge>
    );
  }
  if (verified === true) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3 text-success" />
        Connected
      </Badge>
    );
  }
  if (verified === false) {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] border-warning/50 text-warning">
        <AlertTriangle className="h-3 w-3" />
        Reconnect
      </Badge>
    );
  }
  if (credentialPresent) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3 text-success" />
        Enabled
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-[10px] border-warning/50 text-warning">
      <AlertTriangle className="h-3 w-3" />
      Awaiting auth
    </Badge>
  );
}
