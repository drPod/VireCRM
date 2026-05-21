import { Sparkles } from "lucide-react";

export interface ProviderSetupStepsProps {
  providerName: string;
  steps: string[];
}

/**
 * Step-by-step "How to get your key" panel — the headline accessibility win
 * for non-technical users. Always visible on first setup; hidden by default
 * when editing an existing connection.
 */
export function ProviderSetupSteps({ providerName, steps }: ProviderSetupStepsProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            How to set up {providerName} (takes 2 minutes)
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Follow these steps in order. The link opens {providerName} in a new browser tab.
          </p>
        </div>
      </div>
      <ol className="space-y-2 ml-1">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-xs text-foreground">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
