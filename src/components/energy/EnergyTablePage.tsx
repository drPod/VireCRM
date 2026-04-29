/**
 * Generic table-based CRUD page for the Energy modules. The schema for
 * LOA / Usage / Pricing / Contract / Supplier / Renewal tables differs
 * but the *shape* of the UI (list + create dialog + status filter +
 * delete) is identical, so we drive everything from a config object.
 *
 * Why this design:
 *   - Avoids 6 near-duplicate route files
 *   - All RLS is enforced server-side; the client just renders rows it can read
 *   - Adding a new column = edit the `columns` array in the route file
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type EnergyTableName =
  | "loa_requests"
  | "usage_requests"
  | "pricing_requests"
  | "contract_requests"
  | "energy_suppliers"
  | "renewals";

export interface EnergyColumn {
  key: string;
  label: string;
  /** Render a row's cell. Falls back to String(value). */
  render?: (row: Record<string, unknown>) => ReactNode;
  /** Treat as a status pill. */
  status?: boolean;
}

export interface EnergyField {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "email" | "tel";
  required?: boolean;
  placeholder?: string;
}

export interface EnergyTableConfig {
  table: EnergyTableName;
  title: string;
  description: string;
  columns: EnergyColumn[];
  /** Fields shown in the "New" dialog. */
  createFields: EnergyField[];
  /** Defaults applied alongside org_id + form values on insert. */
  defaults?: Record<string, unknown>;
  /** Status values to filter by, if the table has a `status` column. */
  statusOptions?: string[];
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning border-warning/30",
  requested: "bg-warning/15 text-warning border-warning/30",
  received: "bg-primary/15 text-primary border-primary/30",
  signed: "bg-success/15 text-success border-success/30",
  enrolled: "bg-success/15 text-success border-success/30",
  active: "bg-success/15 text-success border-success/30",
  completed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-destructive/15 text-destructive border-destructive/30",
};

function StatusPill({ value }: { value: unknown }) {
  const v = String(value ?? "—").toLowerCase();
  const cls = STATUS_COLOR[v] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {v}
    </span>
  );
}

export function EnergyTablePage({ config }: { config: EnergyTableConfig }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    // Cast through unknown — supabase-js infers the union of all six table
    // shapes, which makes `.eq("status", …)` invalid for tables without a
    // status column (e.g. energy_suppliers). Status filtering is opt-in via
    // config.statusOptions, so the runtime is always safe.
    let q = supabase.from(config.table).select("*").order("created_at", { ascending: false }).limit(200) as unknown as {
      eq: (col: string, val: string) => typeof q;
      then: PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>["then"];
    };
    if (filter !== "all" && config.statusOptions) {
      q = q.eq("status", filter);
    }
    const { data, error } = (await (q as unknown as Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>));
    if (error) {
      toast.error(`Failed to load ${config.title}: ${error.message}`);
    } else {
      setRows((data as Record<string, unknown>[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.table, filter]);

  const handleCreate = async () => {
    if (!profile?.organization_id) {
      toast.error("Missing organization context");
      return;
    }
    // Required fields check
    for (const f of config.createFields) {
      if (f.required && !form[f.key]?.trim()) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      organization_id: profile.organization_id,
      ...config.defaults,
      ...Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== "" && v !== undefined),
      ),
    };
    // Coerce numbers/dates if the field declared the type
    for (const f of config.createFields) {
      const raw = form[f.key];
      if (raw === undefined || raw === "") continue;
      if (f.type === "number") payload[f.key] = Number(raw);
    }
    const { error } = await supabase.from(config.table).insert(payload as never);
    setSaving(false);
    if (error) {
      toast.error(`Could not create: ${error.message}`);
      return;
    }
    toast.success(`${config.title.replace(/s$/, "")} created`);
    setOpen(false);
    setForm({});
    void load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    const { error } = await supabase.from(config.table).delete().eq("id", id);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return;
    }
    toast.success("Deleted");
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const visibleRows = useMemo(() => rows, [rows]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create {config.title.replace(/s$/, "")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {config.createFields.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key}>
                      {f.label}
                      {f.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    <Input
                      id={f.key}
                      type={f.type ?? "text"}
                      placeholder={f.placeholder}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {config.statusOptions && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          {config.statusOptions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No {config.title.toLowerCase()} yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "New" to create your first record.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {config.columns.map((c) => (
                    <th key={c.key} className="px-4 py-2.5 text-left font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-muted/30">
                    {config.columns.map((c) => {
                      const val = row[c.key];
                      return (
                        <td key={c.key} className="px-4 py-2.5 text-foreground/90">
                          {c.render
                            ? c.render(row)
                            : c.status
                              ? <StatusPill value={val} />
                              : val == null || val === ""
                                ? <span className="text-muted-foreground">—</span>
                                : String(val)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(String(row.id))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">
          {visibleRows.length} {visibleRows.length === 1 ? "record" : "records"}
        </Badge>
        <span>Showing what your role allows under organization isolation rules.</span>
      </div>
    </div>
  );
}
