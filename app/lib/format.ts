// Postgres numerics arrive as strings ("5.0000"). Formatting trims noise but
// never substitutes values (display-verbatim rule covers stored text fields —
// those render untouched).

const EM_DASH = "—";

export function fmtNumeric(s: string | null | undefined): string {
  if (s == null || s === "") return EM_DASH;
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function fmtMoney(s: string | null | undefined, currency = "USD"): string {
  if (s == null || s === "") return EM_DASH;
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

// Per-kWh rates are fractions of a cent — keep more precision than fmtMoney.
export function fmtRate(s: string | null | undefined, currency = "USD"): string {
  if (s == null || s === "") return EM_DASH;
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  const money = n.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  });
  return `${money}/kWh`;
}

export function fmtKwh(s: string | null | undefined): string {
  if (s == null || s === "") return EM_DASH;
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} kWh`;
}

export function fmtMils(s: string | null | undefined): string {
  if (s == null || s === "") return EM_DASH;
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${n === 1 ? "mil" : "mils"}`;
}

// `date` columns are already "YYYY-MM-DD" — shown as-is (round-trip principle).
export function fmtDate(s: string | null | undefined): string {
  return s == null || s === "" ? EM_DASH : s;
}

export function fmtTimestamp(iso: string | null | undefined): string {
  if (iso == null || iso === "") return EM_DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtText(s: string | null | undefined): string {
  return s == null || s === "" ? EM_DASH : s;
}

export function oneLineAddress(a: {
  streetNo?: string | null;
  streetName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const street =
    [a.streetNo, a.streetName].filter(Boolean).join(" ") || a.addressLine1 || a.addressLine2;
  const parts = [street, a.city, [a.state, a.zip].filter(Boolean).join(" ")];
  const line = parts.filter(Boolean).join(", ");
  return line || EM_DASH;
}
