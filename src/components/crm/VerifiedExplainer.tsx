/**
 * Tiny "What does verified mean?" popover, shown next to the status badge
 * on every integration card.
 *
 * The wording differs by integration type:
 *   - "connector"  → one-click OAuth integrations (Slack/Gmail/HubSpot…).
 *                   Verification means the gateway successfully refreshed the
 *                   stored token and the provider accepted it.
 *   - "byo"        → Bring-Your-Own API key providers (Apollo/Hunter/Snov/
 *                   SendGrid). Verification means we called the provider
 *                   directly with the saved key and got a 200-class response.
 *
 * Renders as a help-icon button. Click opens a small popover with the
 * explanation; nothing else changes about the parent layout.
 */
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  variant: "connector" | "byo";
  /** Display label, used in the explanation copy. */
  providerLabel: string;
}

export function VerifiedExplainer({ variant, providerLabel }: Props) {
  const isConnector = variant === "connector";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`What does verified mean for ${providerLabel}?`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-72 p-3 text-[11px] leading-relaxed"
      >
        <p className="font-semibold text-foreground mb-1">
          What "Verified" means for {providerLabel}
        </p>
        {isConnector ? (
          <>
            <p className="text-muted-foreground">
              We refreshed your stored {providerLabel} token and called the provider with it. The
              provider accepted the call, so {providerLabel} is reachable from your CRM right now.
            </p>
            <p className="text-muted-foreground mt-2">
              If the provider later expires the token or revokes access, the card will switch to{" "}
              <span className="text-warning">Reconnect</span> and explain what happened.
            </p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              We called {providerLabel} directly with the API key you pasted in and got a successful
              response. That means the key is valid and your account is reachable.
            </p>
            <p className="text-muted-foreground mt-2">
              If {providerLabel} later rejects the key (revoked, rate-limited, or out of credits),
              the next test run will surface the exact error returned by {providerLabel}.
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
