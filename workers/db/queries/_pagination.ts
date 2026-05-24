import { and, eq, lt, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

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
    // Validate timestamp parseability so a malformed cursor doesn't produce a
    // `NaN` comparison that silently returns the whole table.
    if (Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

// Composite tiebreak `(created_at desc, id desc)`. Without `id` in the cursor
// simultaneous timestamps would skip rows or return duplicates across pages.
// Caller composes with `and(tenantPredicate, keysetWhere(cols, cursor))`.
export function keysetWhere(
  cols: { createdAt: AnyPgColumn; id: AnyPgColumn },
  cursor: Cursor,
): SQL {
  const ts = new Date(cursor.createdAt);
  // `or`/`and` return `SQL | undefined`; both args are present so the result is
  // never undefined — assert for the caller's type ergonomics.
  return or(lt(cols.createdAt, ts), and(eq(cols.createdAt, ts), lt(cols.id, cursor.id))) as SQL;
}

// Standard "fetch limit+1 then slice" pagination tail. Row type must expose
// `createdAt: Date` + `id: string` (the keyset columns). Returns the page items
// (limit-bounded) plus the next-page cursor when more rows exist.
export function buildNextCursor<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;
  return { items, nextCursor };
}
