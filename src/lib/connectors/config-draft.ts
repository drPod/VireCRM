import type { ConnectorMeta } from "./catalog";

/**
 * Seeds a draft object from a saved `status.config` for the fields declared
 * on `meta`. Values get cast to strings since `<input>`s only accept strings.
 */
export function seedDraftFromStatus(
  meta: ConnectorMeta,
  config: Record<string, string | number | boolean | null> | undefined,
): Record<string, string> {
  const seed: Record<string, string> = {};
  for (const f of meta.configFields ?? []) {
    const v = config?.[f.key];
    seed[f.key] = v == null ? "" : String(v);
  }
  return seed;
}
