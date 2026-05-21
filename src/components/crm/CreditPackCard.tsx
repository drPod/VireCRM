import { Sparkles, Zap } from "lucide-react";
import { type CreditPack, formatPackPrice, perCredit } from "@/lib/credit-packs";

interface CreditPackCardProps {
  pack: CreditPack;
  onBuy: (packKey: string) => void;
}

export function CreditPackCard({ pack, onBuy }: CreditPackCardProps) {
  return (
    <button
      type="button"
      onClick={() => onBuy(pack.key)}
      className={`group relative flex flex-col items-start rounded-lg border p-3 text-left transition hover:border-primary hover:bg-primary/5 ${
        pack.highlight ? "border-primary/60 bg-primary/5" : "border-border bg-background"
      }`}
    >
      {pack.highlight && (
        <span className="absolute -top-2 right-2 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
          <Sparkles className="h-2.5 w-2.5" />
          Best
        </span>
      )}
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Zap className="h-3 w-3" />
        {pack.label}
      </div>
      <div className="mt-1 text-lg font-semibold text-foreground">
        {pack.credits.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground">credits</div>
      <div className="mt-2 text-sm font-semibold text-foreground">
        {formatPackPrice(pack.priceCents)}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {perCredit(pack.priceCents, pack.credits)}
      </div>
    </button>
  );
}
