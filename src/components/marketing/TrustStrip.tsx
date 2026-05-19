import { Database, CreditCard, Lock, ShieldCheck } from "lucide-react";

const signals = [
  { icon: Database, label: "Postgres on Supabase" },
  { icon: CreditCard, label: "Stripe-handled payments" },
  { icon: Lock, label: "256-bit encryption in transit" },
  { icon: ShieldCheck, label: "SOC 2 Type II in progress" },
];

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-6 py-5 sm:flex-row sm:gap-10">
        {signals.map((signal) => (
          <div key={signal.label} className="flex items-center gap-2 text-sm text-muted-foreground">
            <signal.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="font-medium">{signal.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
