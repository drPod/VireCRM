import type { ConnectorStatus } from "@/functions/connectors.functions";
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type ConnectorMeta,
  type ConnectorCategory,
} from "@/lib/connectors/catalog";
import { ConnectorCard } from "./ConnectorCard";
import type { TestResult } from "./TestResultPanel";

interface ConnectorCategorySectionProps {
  category: ConnectorCategory;
  connectors: ConnectorMeta[];
  statuses: Record<string, ConnectorStatus>;
  loading: boolean;
  organizationId: string | null;
  onEnable: (provider: string) => Promise<void>;
  onDisable: (provider: string, name: string) => Promise<void>;
  onTest: (provider: string, name: string) => Promise<TestResult>;
  onSaveConfig: (provider: string, config: Record<string, string>) => Promise<void>;
}

export function ConnectorCategorySection({
  category,
  connectors,
  statuses,
  loading,
  organizationId,
  onEnable,
  onDisable,
  onTest,
  onSaveConfig,
}: ConnectorCategorySectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[category]}</h4>
        <p className="text-xs text-muted-foreground">{CATEGORY_DESCRIPTIONS[category]}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {connectors.map((meta) => (
          <ConnectorCard
            key={meta.id}
            meta={meta}
            status={statuses[meta.id]}
            loading={loading}
            onEnable={() => onEnable(meta.id)}
            onDisable={() => onDisable(meta.id, meta.name)}
            onTest={() => onTest(meta.id, meta.name)}
            onSaveConfig={(config) => onSaveConfig(meta.id, config)}
            organizationId={organizationId}
          />
        ))}
      </div>
    </div>
  );
}
