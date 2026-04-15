import { Sparkles, Terminal } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Give a Command",
    description: "Type what you want in plain English. 'Run outreach on 200 SaaS leads' or 'Follow up with cold leads'.",
    visual: (
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <span>Command</span>
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">
          Run outreach on 200 SaaS leads with score above 70
        </p>
      </div>
    ),
  },
  {
    step: "02",
    title: "AI Plans the Workflow",
    description: "AI converts your command into structured tasks: score leads, generate messages, schedule sends, track replies.",
    visual: (
      <div className="space-y-2">
        {["Score 200 leads", "Generate personalized emails", "Send outreach batch", "Monitor replies"].map((task, i) => (
          <div key={task} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
              {i + 1}
            </div>
            <span className="text-foreground">{task}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    step: "03",
    title: "System Executes Automatically",
    description: "Workflows run end-to-end. Messages sent, replies classified, meetings booked, CRM updated — zero manual work.",
    visual: (
      <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
        <Sparkles className="h-5 w-5 text-success" />
        <div>
          <p className="text-sm font-medium text-foreground">Outreach Complete</p>
          <p className="text-xs text-muted-foreground">200 leads contacted · 47 replies · 12 meetings booked</p>
        </div>
      </div>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground">How It Works</h2>
          <p className="mt-3 text-muted-foreground">
            Three steps. One command. Full automation.
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-3">
          {steps.map((step) => (
            <div key={step.step}>
              <span className="text-xs font-bold text-primary">{step.step}</span>
              <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              <div className="mt-4">{step.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
