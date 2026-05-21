import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AdminSubmissionRow } from "@/types/admin";

/**
 * Hook that owns the list state for `ContactSubmissionsPanel`: rows fetch,
 * search filtering, row expansion, and the per-row "mark replied / archive"
 * status mutation with optimistic patch. Extracted from the original 1.2k-line
 * panel so the container component can stay focused on layout.
 */
export function useContactSubmissions() {
  const [rows, setRows] = useState<AdminSubmissionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_submissions")
      .select(
        "id, name, email, company, phone, project_type, budget, message, status, origin, test_mode, sentiment, topic, intent_summary, priority_suggestion, metadata, created_at, replied_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Failed to load submissions");
      return;
    }
    setRows((data ?? []) as AdminSubmissionRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q) ||
        (r.project_type ?? "").toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const toggleRow = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setStatus = async (id: string, status: string) => {
    setSavingId(id);
    const patch: { status: string; replied_at?: string } = { status };
    if (status === "replied") patch.replied_at = new Date().toISOString();
    const { error } = await supabase.from("contact_submissions").update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error(error.message ?? "Failed to update");
      return;
    }
    toast.success(`Marked ${status}`);
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  replied_at: status === "replied" ? new Date().toISOString() : r.replied_at,
                }
              : r,
          )
        : prev,
    );
  };

  return {
    rows,
    loading,
    search,
    setSearch,
    expanded,
    savingId,
    filtered,
    load,
    toggleRow,
    setStatus,
  };
}
