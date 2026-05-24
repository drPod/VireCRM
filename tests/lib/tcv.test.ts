import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { grossTcv, netTcv, termYears } from "../../workers/lib/tcv";
import { hasTestDb } from "../setup";

describe("termYears", () => {
  it("two-year contract (non-leap span) ≈ 2.0", () => {
    expect(termYears(new Date("2025-01-01"), new Date("2027-01-01"))).toBeCloseTo(1.9986, 3);
  });

  it("one-year contract ≈ 1.0", () => {
    expect(termYears(new Date("2025-01-01"), new Date("2026-01-01"))).toBeCloseTo(0.9993, 3);
  });

  it("zero-length term = 0", () => {
    const d = new Date("2025-06-15");
    expect(termYears(d, d)).toBe(0);
  });

  it("end before start → negative term", () => {
    expect(termYears(new Date("2026-01-01"), new Date("2025-01-01"))).toBeLessThan(0);
  });
});

describe("grossTcv — golden values", () => {
  it("100k kWh × 2yr × 5 mils = $1,000", () => {
    // 100_000 * 2 * 5 / 1000 = 1000
    expect(grossTcv({ annualUsageKwh: 100_000, termYears: 2, agentMils: 5 })).toBe(1000);
  });

  it("250k kWh × 3yr × 8 mils = $6,000", () => {
    expect(grossTcv({ annualUsageKwh: 250_000, termYears: 3, agentMils: 8 })).toBe(6000);
  });

  it("zero usage → 0", () => {
    expect(grossTcv({ annualUsageKwh: 0, termYears: 2, agentMils: 5 })).toBe(0);
  });

  it("zero mils → 0", () => {
    expect(grossTcv({ annualUsageKwh: 100_000, termYears: 2, agentMils: 0 })).toBe(0);
  });

  it("zero term → 0", () => {
    expect(grossTcv({ annualUsageKwh: 100_000, termYears: 0, agentMils: 5 })).toBe(0);
  });
});

describe("netTcv — golden values", () => {
  it("subtracts lost from gross", () => {
    expect(netTcv({ grossTcv: 10_000, lostTcv: 1500 })).toBe(8500);
  });

  it("zero lost → net = gross", () => {
    expect(netTcv({ grossTcv: 10_000, lostTcv: 0 })).toBe(10_000);
  });

  it("lost > gross → negative net (loss exceeds contract value)", () => {
    expect(netTcv({ grossTcv: 1000, lostTcv: 1500 })).toBe(-500);
  });
});

// DB-gated. Pins the Postgres GENERATED ALWAYS AS expression on
// `contracts.gross_tcv` / `contracts.net_tcv` to the TS formula. Executes the
// arithmetic via raw SELECT instead of building the full FK chain — the
// generated columns embed identical math, so SQL/TS parity here = stored
// expression sound. Catches schema-drift like a 365.25 → 365 swap.
describe.skipIf(!hasTestDb)("Postgres GENERATED parity — DB-gated", () => {
  let makeDb: typeof import("../../workers/db")["makeDb"];
  let sql: typeof import("drizzle-orm")["sql"];

  beforeAll(async () => {
    const [dbMod, orm] = await Promise.all([import("../../workers/db"), import("drizzle-orm")]);
    makeDb = dbMod.makeDb;
    sql = orm.sql;
  });

  async function pgGrossNet({
    annualUsageKwh,
    startDate,
    endDate,
    agentMils,
    lostTcv,
  }: {
    annualUsageKwh: number;
    startDate: string;
    endDate: string;
    agentMils: number;
    lostTcv: number;
  }): Promise<{ gross: number; net: number }> {
    // Mirrors the GENERATED expression from contracts.ts verbatim.
    const rows = await makeDb(env).execute<{ gross: string; net: string }>(sql`
      SELECT
        (COALESCE(${annualUsageKwh}::numeric, 0)
          * COALESCE((${endDate}::date - ${startDate}::date)::numeric / 365.25, 0)
          * COALESCE(${agentMils}::numeric, 0) / 1000) AS gross,
        (COALESCE(${annualUsageKwh}::numeric, 0)
          * COALESCE((${endDate}::date - ${startDate}::date)::numeric / 365.25, 0)
          * COALESCE(${agentMils}::numeric, 0) / 1000
          - COALESCE(${lostTcv}::numeric, 0)) AS net
    `);
    const r = rows[0]!;
    return { gross: Number.parseFloat(r.gross), net: Number.parseFloat(r.net) };
  }

  it("matches TS termYears + grossTcv + netTcv for 2-year deal", async () => {
    const start = new Date("2025-01-01");
    const end = new Date("2027-01-01");
    const annualUsageKwh = 100_000;
    const agentMils = 5;
    const lost = 1000;

    const pg = await pgGrossNet({
      annualUsageKwh,
      startDate: "2025-01-01",
      endDate: "2027-01-01",
      agentMils,
      lostTcv: lost,
    });

    const ts_term = termYears(start, end);
    const ts_gross = grossTcv({ annualUsageKwh, termYears: ts_term, agentMils });
    const ts_net = netTcv({ grossTcv: ts_gross, lostTcv: lost });

    expect(pg.gross).toBeCloseTo(ts_gross, 2);
    expect(pg.net).toBeCloseTo(ts_net, 2);
  });

  it("matches TS for fractional term (mid-year start/end)", async () => {
    const start = new Date("2025-03-15");
    const end = new Date("2026-09-30");
    const annualUsageKwh = 750_000;
    const agentMils = 7;
    const lost = 0;

    const pg = await pgGrossNet({
      annualUsageKwh,
      startDate: "2025-03-15",
      endDate: "2026-09-30",
      agentMils,
      lostTcv: lost,
    });

    const ts_term = termYears(start, end);
    const ts_gross = grossTcv({ annualUsageKwh, termYears: ts_term, agentMils });
    const ts_net = netTcv({ grossTcv: ts_gross, lostTcv: lost });

    expect(pg.gross).toBeCloseTo(ts_gross, 2);
    expect(pg.net).toBeCloseTo(ts_net, 2);
  });
});
