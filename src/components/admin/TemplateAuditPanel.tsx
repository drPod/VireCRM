import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Loader2, ShieldAlert, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { TemplateAuditRow } from "@/types/admin";

export function TemplateAuditPanel() {
  const [rows, setRows] = useState<TemplateAuditRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "changed" | "denied">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_template_audit", { p_limit: 200 });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load audit log");
      return;
    }
    setRows((data ?? []) as unknown as TemplateAuditRow[]);
  };

  useEffect(() => {
    void load();
    // Realtime — any new audit row pops in for live security monitoring.
    const channel = supabase
      .channel("template_assignment_audit_log:all")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "template_assignment_audit_log" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.action !== filter) return false;
      if (!q) return true;
      return (
        (r.organization_name ?? "").toLowerCase().includes(q) ||
        (r.actor_email ?? "").toLowerCase().includes(q) ||
        (r.old_template ?? "").toLowerCase().includes(q) ||
        (r.new_template ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => {
    if (!rows) return { changed: 0, denied: 0 };
    return rows.reduce(
      (acc, r) => {
        if (r.action === "changed") acc.changed += 1;
        else if (r.action === "denied") acc.denied += 1;
        return acc;
      },
      { changed: 0, denied: 0 },
    );
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Template Assignment Audit
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Every successful template change and every denied attempt across all organizations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">{counts.changed} changed</Badge>
            <Badge variant="destructive">{counts.denied} denied</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by org, actor email, or template…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="changed">Changed only</SelectItem>
              <SelectItem value="denied">Denied only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && !rows ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No audit entries match your filters.
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">When</TableHead>
                  <TableHead className="w-[110px]">Action</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Template change</TableHead>
                  <TableHead className="w-[140px]">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className={r.action === "denied" ? "bg-destructive/5" : undefined}
                  >
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.action === "denied" ? "destructive" : "default"}>
                        {r.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{r.organization_name ?? "—"}</div>
                      {r.organization_id ? (
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {r.organization_id.slice(0, 8)}…
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        {r.actor_email ?? <span className="text-muted-foreground">unknown</span>}
                      </div>
                      {r.actor_is_platform_admin ? (
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          <Crown className="h-2.5 w-2.5 mr-1" /> platform admin
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono text-xs">{r.old_template ?? "—"}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="font-mono text-xs font-semibold">
                        {r.new_template ?? "—"}
                      </span>
                      {r.reason ? (
                        <div className="text-[11px] text-destructive mt-0.5">{r.reason}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.source ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
