// Shared keyset-pagination cursor for domain-table list queries.
//
// Every list endpoint paginates by `(created_at desc, id desc)`. `id` is in
// the cursor (not just `created_at`) so simultaneous timestamps don't skip
// rows or return duplicates across pages — the composite tiebreak matches
// the `(tenant_id, created_at desc, id desc)` index on each domain table.
//
// `decodeCursor` validates that `createdAt` is a parseable timestamp; a
// malformed cursor must NOT silently produce a `NaN` comparison that returns
// the whole table.

export interface Cursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return btoa(JSON.stringify(c));
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(atob(raw)) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string") return null;
    if (typeof parsed.id !== "string") return null;
    if (Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
