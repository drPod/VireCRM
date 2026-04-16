import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  MoreHorizontal,
  TrendingUp,
  CreditCard,
  FileText,
  Link as LinkIcon,
} from "lucide-react";

export const Route = createFileRoute("/_app/invoices")({
  component: InvoicesPage,
  head: () => ({
    meta: [
      { title: "Vireon — Invoices" },
      { name: "description", content: "Invoicing, payments, and billing management" },
    ],
  }),
});

const demoInvoices = [
  {
    id: "INV-001",
    client: "TechCorp Solutions",
    amount: "$3,500.00",
    status: "paid" as const,
    dueDate: "Apr 10, 2026",
    paidDate: "Apr 8, 2026",
    items: "CRM Setup + Growth Plan (3 months)",
  },
  {
    id: "INV-002",
    client: "Digital Growth Agency",
    amount: "$849.00",
    status: "paid" as const,
    dueDate: "Apr 1, 2026",
    paidDate: "Apr 1, 2026",
    items: "White-Label Lease — Professional (Monthly)",
  },
  {
    id: "INV-003",
    client: "ScaleUp Inc",
    amount: "$1,500.00",
    status: "pending" as const,
    dueDate: "Apr 20, 2026",
    paidDate: null,
    items: "Growth Plan Setup Fee",
  },
  {
    id: "INV-004",
    client: "Velocity Sales Co",
    amount: "$10,000.00",
    status: "pending" as const,
    dueDate: "Apr 25, 2026",
    paidDate: null,
    items: "Custom CRM Build — Phase 1",
  },
  {
    id: "INV-005",
    client: "Nexus Marketing",
    amount: "$197.00",
    status: "overdue" as const,
    dueDate: "Apr 5, 2026",
    paidDate: null,
    items: "Growth Plan (Monthly)",
  },
  {
    id: "INV-006",
    client: "Peak Performance Ltd",
    amount: "$497.00",
    status: "draft" as const,
    dueDate: "—",
    paidDate: null,
    items: "Pro Plan (Monthly)",
  },
];

const statusConfig = {
  paid: { variant: "default" as const, icon: CheckCircle2, color: "text-success" },
  pending: { variant: "secondary" as const, icon: Clock, color: "text-warning" },
  overdue: { variant: "destructive" as const, icon: AlertCircle, color: "text-destructive" },
  draft: { variant: "outline" as const, icon: FileText, color: "text-muted-foreground" },
};

function InvoicesPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invoices & Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create invoices, track payments, and send text-to-pay links
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Payment Link
            </Button>
            <Button variant="command" className="gap-2">
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Revenue (MTD)</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">$16,543</p>
            <div className="mt-1 flex items-center gap-1 text-xs text-success">
              <TrendingUp className="h-3 w-3" /> +23.5% vs last month
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-warning">$11,697</p>
            <p className="mt-1 text-xs text-muted-foreground">3 invoices pending</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-destructive">$197</p>
            <p className="mt-1 text-xs text-muted-foreground">1 invoice overdue</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Collected</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-success">$4,349</p>
            <p className="mt-1 text-xs text-muted-foreground">2 paid this month</p>
          </div>
        </div>

        {/* Invoice table */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">All Invoices</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="text-xs">All</Button>
              <Button variant="ghost" size="sm" className="text-xs">Pending</Button>
              <Button variant="ghost" size="sm" className="text-xs">Paid</Button>
              <Button variant="ghost" size="sm" className="text-xs">Overdue</Button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {demoInvoices.map((invoice) => {
              const config = statusConfig[invoice.status];
              const StatusIcon = config.icon;
              return (
                <div
                  key={invoice.id}
                  className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{invoice.id}</span>
                        <span className="font-medium text-foreground">{invoice.client}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{invoice.items}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{invoice.amount}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.status === "paid" ? `Paid ${invoice.paidDate}` : `Due ${invoice.dueDate}`}
                      </p>
                    </div>
                    <Badge variant={config.variant} className="gap-1 text-xs min-w-[80px] justify-center">
                      <StatusIcon className="h-3 w-3" />
                      {invoice.status}
                    </Badge>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      {invoice.status === "pending" && (
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <Send className="h-3 w-3" /> Remind
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
