import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { apiFetch } from "~/lib/api";
import type { CustomerListItem, ListPage } from "~/lib/types";

// Search-as-you-type customer selector backed by GET /api/customers?q=.
export function CustomerPicker({
  value,
  onChange,
}: {
  value: CustomerListItem | null;
  onChange: (c: CustomerListItem | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const mySeq = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q, limit: "10" });
        const page: ListPage<CustomerListItem> = await apiFetch(`/api/customers?${qs}`);
        if (seq.current === mySeq) setResults(page.items);
      } catch {
        if (seq.current === mySeq) setResults([]);
      } finally {
        if (seq.current === mySeq) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
        <span className="truncate text-sm">{value.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0"
          onClick={() => onChange(null)}
          title="Clear customer"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        placeholder="Search customers by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() ? (
        <div className="max-h-48 overflow-y-auto rounded-md border">
          {searching && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(c);
                  setQuery("");
                }}
              >
                {c.name}
                {c.primaryContactName ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.primaryContactName}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
