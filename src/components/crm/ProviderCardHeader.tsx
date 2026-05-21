import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { VerifiedExplainer } from "./VerifiedExplainer";
import type { ProviderConfig, ProviderStatus } from "@/types/integrations";

export interface ProviderCardHeaderProps {
  config: ProviderConfig;
  status: ProviderStatus;
}

/** Card header: name + connected badge + verified-explainer tooltip + docs link. */
export function ProviderCardHeader({ config, status }: ProviderCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-foreground">{config.name}</h3>
          {status.configured ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
          <VerifiedExplainer variant="byo" providerLabel={config.name} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
      </div>
      <a
        href={config.docsUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
      >
        Get API key <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
