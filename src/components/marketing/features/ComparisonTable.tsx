import { Check, Minus, X } from "lucide-react";

type Cell = "yes" | "partial" | "no" | string;

interface Row {
  label: string;
  majix: Cell;
  spreadsheet: Cell;
  generic: Cell;
  competitor: Cell;
}

const ROWS: Row[] = [
  { label: "AI lead scoring with explainable signals", majix: "yes", spreadsheet: "no", generic: "partial", competitor: "yes" },
  { label: "Multi-channel inbox (Email + SMS + WhatsApp + DMs)", majix: "yes", spreadsheet: "no", generic: "partial", competitor: "no" },
  { label: "Built-in calendar + round-robin booking", majix: "yes", spreadsheet: "no", generic: "yes", competitor: "partial" },
  { label: "Visual workflow builder with AI nodes", majix: "yes", spreadsheet: "no", generic: "partial", competitor: "no" },
  { label: "Industry verticals (Energy / Solar / Real Estate / Gym / Insurance)", majix: "yes", spreadsheet: "no", generic: "no", competitor: "no" },
  { label: "Set-up time", majix: "Days", spreadsheet: "Hours", generic: "Weeks", competitor: "Months" },
  { label: "White-label custom domain per tenant", majix: "yes", spreadsheet: "no", generic: "no", competitor: "partial" },
  { label: "Reseller-controlled pricing + billing", majix: "yes", spreadsheet: "no", generic: "no", competitor: "no" },
  { label: "AI sequence drafting + reply classification", majix: "yes", spreadsheet: "no", generic: "partial", competitor: "partial" },
  { label: "Per-org Stripe Connect for payouts", majix: "yes", spreadsheet: "no", generic: "no", competitor: "no" },
];

function CellIcon({ value }: { value: Cell }) {
  if (value === "yes") return <Check className="mx-auto h-4 w-4 text-success" strokeWidth={3} />;
  if (value === "no") return <X className="mx-auto h-4 w-4 text-muted-foreground/50" />;
  if (value === "partial")
    return <Minus className="mx-auto h-4 w-4 text-muted-foreground/70" strokeWidth={3} />;
  return <span className="text-xs font-medium text-muted-foreground">{value}</span>;
}

export function ComparisonTable() {
  return (
    <section
      id="compare"
      className="relative scroll-mt-32 border-t border-border/60 py-20 sm:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[420px] w-[860px] section-aurora-reverse opacity-35"
      />
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            How we stack up
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built like a CRM. Priced like software. Sold like your own product.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Every row reflects what we ship today — no roadmap weasel-words.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card/40 shadow-xl shadow-primary/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card/80 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-[40%] px-5 py-4 text-left font-semibold">Capability</th>
                <th className="w-[15%] px-3 py-4 text-center font-semibold text-primary">Majix</th>
                <th className="w-[15%] px-3 py-4 text-center font-semibold">Spreadsheet</th>
                <th className="w-[15%] px-3 py-4 text-center font-semibold">Generic CRM</th>
                <th className="w-[15%] px-3 py-4 text-center font-semibold">White-label rivals</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, idx) => (
                <tr
                  key={r.label}
                  className={`border-t border-border/60 ${idx % 2 ? "bg-card/30" : ""}`}
                >
                  <td className="px-5 py-3.5 text-foreground">{r.label}</td>
                  <td className="px-3 py-3.5 text-center">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                      <CellIcon value={r.majix} />
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center"><CellIcon value={r.spreadsheet} /></td>
                  <td className="px-3 py-3.5 text-center"><CellIcon value={r.generic} /></td>
                  <td className="px-3 py-3.5 text-center"><CellIcon value={r.competitor} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Comparison reflects published features on competitor sites as of {new Date().getFullYear()}.
          “Generic CRM” represents Pipedrive / HubSpot Starter-tier feature surface.
        </p>
      </div>
    </section>
  );
}
