import { createFileRoute } from "@tanstack/react-router";
import { LeadsPageContent } from "@/components/crm/LeadsPageContent";

type LeadsAction = "add" | "import" | "auto-find";
type LeadsSearch = { q?: string; action?: LeadsAction; ai_desc?: string; ai_industry?: string };

export const Route = createFileRoute("/_app/leads")({
  component: LeadsPage,
  validateSearch: (search: Record<string, unknown>): LeadsSearch => {
    const out: LeadsSearch = {};
    if (typeof search.q === "string" && search.q.length > 0) out.q = search.q;
    if (search.action === "add" || search.action === "import" || search.action === "auto-find") {
      out.action = search.action;
    }
    if (typeof search.ai_desc === "string" && search.ai_desc.length > 0) {
      out.ai_desc = search.ai_desc.slice(0, 1000);
    }
    if (typeof search.ai_industry === "string" && search.ai_industry.length > 0) {
      out.ai_industry = search.ai_industry.slice(0, 200);
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "VireCRM — Leads" },
      { name: "description", content: "Manage and score your leads" },
    ],
  }),
});

const statusFilters = [
  "all",
  "new",
  "contacted",
  "qualified",
  "negotiation",
  "won",
  "lost",
] as const;

function LeadsPage() {
  const search = Route.useSearch();
  return <LeadsPageContent statusFilters={statusFilters} search={search} />;
}
