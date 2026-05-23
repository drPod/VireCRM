// Parses the leftmost label of a Host header. Returns null for apex or for
// any host outside ROOT_ZONES. Reserved labels (www / app / api / customers)
// ARE returned — caller must reject them via `isReservedSubdomain` before
// treating the value as a broker tenant. `customers.virecrm.com` is the
// end-customer portal and must NOT be treated as a broker tenant.

const ROOT_ZONES = ["virecrm.com", "majix.ai", "localhost"];
const RESERVED = new Set(["www", "app", "api", "customers"]);

export function extractSubdomain(host: string | undefined | null): string | null {
  if (!host) return null;
  const hostname = host.toLowerCase().split(":")[0]!.trim();
  if (!hostname) return null;

  for (const zone of ROOT_ZONES) {
    if (hostname === zone) return null;
    if (hostname.endsWith(`.${zone}`)) {
      const sub = hostname.slice(0, -zone.length - 1);
      const firstLabel = sub.split(".")[0]!;
      if (!firstLabel) return null;
      return firstLabel;
    }
  }
  return null;
}

export function isReservedSubdomain(sub: string): boolean {
  return RESERVED.has(sub);
}
