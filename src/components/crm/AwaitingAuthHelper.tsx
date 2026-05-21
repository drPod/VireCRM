import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildConnectorConnectPrompt } from "@/lib/connectors/ai-prompt";

interface AwaitingAuthHelperProps {
  providerLabel: string;
  connectorId: string;
}

/**
 * Inline helper shown on connector cards that are enabled in our DB but
 * still missing the gateway-injected credential. Most users don't realise
 * the OAuth handshake has to be triggered by their AI assistant — this
 * panel makes that crystal clear and ships a copy-ready prompt so they
 * don't have to write one themselves.
 */
export function AwaitingAuthHelper({ providerLabel, connectorId }: AwaitingAuthHelperProps) {
  const [copied, setCopied] = useState(false);
  const prompt = buildConnectorConnectPrompt({ connectorId, providerLabel });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copied", {
        description: "Paste it into your AI assistant chat to finish setup.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Couldn't copy", {
        description: "Select the prompt manually and copy it.",
      });
    }
  };

  return (
    <div className="mt-3 mb-3 rounded-md border border-warning/40 bg-warning/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-foreground">
            One last step — finish sign-in with your AI assistant
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            We've enabled {providerLabel} for your workspace. To complete the OAuth handshake, ask
            your AI assistant to link the connector. Copy the prompt below and paste it into chat.
          </p>
        </div>
      </div>
      <div className="rounded bg-background border border-border p-2 text-[11px] font-mono text-foreground/80 break-words leading-snug">
        {prompt}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy AI prompt"}
      </Button>
    </div>
  );
}
