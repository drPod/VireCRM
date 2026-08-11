import { ApiError, apiFetch } from "./api";
import type { AgentListItem, CustomerListItem, EsiListItem, ListPage } from "./types";

// Deals/contracts carry bare UUIDs; these module-level caches resolve them to
// display names without refetching per row. Customers and agents are created
// out-of-band (xlsx migration), so staleness within a session is a non-issue.

const customerCache = new Map<string, Promise<CustomerListItem | null>>();

export function getCustomer(id: string): Promise<CustomerListItem | null> {
  let p = customerCache.get(id);
  if (!p) {
    p = apiFetch<CustomerListItem>(`/api/customers/${id}`).catch((e) => {
      customerCache.delete(id);
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    });
    customerCache.set(id, p);
  }
  return p;
}

export async function resolveCustomers(
  ids: Iterable<string>,
): Promise<Map<string, CustomerListItem>> {
  const unique = [...new Set(ids)];
  const rows = await Promise.all(unique.map((id) => getCustomer(id)));
  const map = new Map<string, CustomerListItem>();
  rows.forEach((row, i) => {
    if (row) map.set(unique[i]!, row);
  });
  return map;
}

const esiCache = new Map<string, Promise<EsiListItem | null>>();

// Contracts store the ESI row UUID; this resolves it to the ERCOT ESI ID text.
export function getEsi(id: string): Promise<EsiListItem | null> {
  let p = esiCache.get(id);
  if (!p) {
    p = apiFetch<EsiListItem>(`/api/esis/${id}`).catch((e) => {
      esiCache.delete(id);
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    });
    esiCache.set(id, p);
  }
  return p;
}

export async function resolveEsis(ids: Iterable<string>): Promise<Map<string, EsiListItem>> {
  const unique = [...new Set(ids)];
  const rows = await Promise.all(unique.map((id) => getEsi(id)));
  const map = new Map<string, EsiListItem>();
  rows.forEach((row, i) => {
    if (row) map.set(unique[i]!, row);
  });
  return map;
}

let agentsPromise: Promise<AgentListItem[]> | null = null;

// Agents are a handful of people — fetch the full list once per session.
export function allAgents(): Promise<AgentListItem[]> {
  if (!agentsPromise) {
    agentsPromise = (async () => {
      const items: AgentListItem[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 20; page++) {
        const qs = new URLSearchParams({ limit: "100" });
        if (cursor) qs.set("cursor", cursor);
        const res: ListPage<AgentListItem> = await apiFetch(`/api/agents?${qs}`);
        items.push(...res.items);
        cursor = res.nextCursor;
        if (!cursor) break;
      }
      return items;
    })().catch((e) => {
      agentsPromise = null;
      throw e;
    });
  }
  return agentsPromise;
}

export async function agentsById(): Promise<Map<string, AgentListItem>> {
  const list = await allAgents();
  return new Map(list.map((a) => [a.id, a]));
}
