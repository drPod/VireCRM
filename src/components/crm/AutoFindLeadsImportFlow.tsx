import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Building2, Loader2, Sparkles, UserPlus } from "lucide-react";
import type { UseAutoFindLeadsReturn } from "@/hooks/useAutoFindLeads";

interface AutoFindLeadsImportFlowProps {
  flow: UseAutoFindLeadsReturn;
  outreachEnabled: boolean;
  onOutreachEnabledChange: (v: boolean) => void;
}

export function AutoFindLeadsImportFlow({
  flow,
  outreachEnabled,
  onOutreachEnabledChange,
}: AutoFindLeadsImportFlowProps) {
  const {
    suggestions,
    selected,
    importing,
    toggleSelect,
    toggleAll,
    reset,
    handleImport,
  } = flow;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Checkbox checked={selected.size === suggestions.length} onCheckedChange={toggleAll} />
          Select all ({suggestions.length})
        </label>
        <Badge variant="info">{selected.size} selected</Badge>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {suggestions.map((lead, i) => (
          <div
            key={i}
            onClick={() => toggleSelect(i)}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
              selected.has(i)
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card hover:border-border/80"
            }`}
          >
            <Checkbox
              checked={selected.has(i)}
              onCheckedChange={() => toggleSelect(i)}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground truncate">{lead.name}</span>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  Score: {lead.score}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{lead.company}</span>
                <span className="mx-1">·</span>
                <span className="truncate">{lead.role}</span>
              </div>
              <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">{lead.reason}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
        <label
          htmlFor="auto-outreach-find"
          className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI auto-outreach
          <span className="font-normal text-muted-foreground">
            — email selected leads after import
          </span>
        </label>
        <Switch
          id="auto-outreach-find"
          checked={outreachEnabled}
          onCheckedChange={onOutreachEnabledChange}
        />
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={reset}>
          Start Over
        </Button>
        <Button
          variant="command"
          size="sm"
          onClick={handleImport}
          disabled={importing || selected.size === 0}
        >
          {importing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Import {selected.size} Lead{selected.size !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
