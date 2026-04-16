import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import type { Lead } from "@/components/crm/LeadCard";
import { toast } from "sonner";

interface ExportLeadsButtonProps {
  leads: Lead[];
}

function leadsToRows(leads: Lead[]) {
  return leads.map((l) => ({
    Name: l.name,
    Email: l.email || "",
    Phone: l.phone || "",
    Company: l.company || "",
    Status: l.status,
    Score: l.score,
    "Next Action": l.nextAction || "",
    "Last Contact": l.lastContact
      ? new Date(l.lastContact).toLocaleDateString()
      : "",
  }));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCSV(leads: Lead[]) {
  if (leads.length === 0) {
    toast.error("No leads to export");
    return;
  }
  const rows = leadsToRows(leads);
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const val = String(r[h as keyof typeof r] ?? "");
          return val.includes(",") || val.includes('"') || val.includes("\n")
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(",")
    ),
  ].join("\n");

  downloadBlob(
    new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
    `leads-export-${new Date().toISOString().slice(0, 10)}.csv`
  );
  toast.success(`Exported ${leads.length} leads as CSV`);
}

async function exportXLSX(leads: Lead[]) {
  if (leads.length === 0) {
    toast.error("No leads to export");
    return;
  }

  try {
    const { utils, writeFile } = await import("xlsx");
    const rows = leadsToRows(leads);
    const ws = utils.json_to_sheet(rows);

    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map((key) => ({
      wch: Math.max(
        key.length,
        ...rows.map((r) => String(r[key as keyof typeof r] ?? "").length)
      ) + 2,
    }));
    ws["!cols"] = colWidths;

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Leads");
    writeFile(wb, `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Exported ${leads.length} leads as Excel`);
  } catch {
    toast.error("Failed to generate Excel file");
  }
}

export function ExportLeadsButton({ leads }: ExportLeadsButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportCSV(leads)}>
          Download as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportXLSX(leads)}>
          Download as Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
