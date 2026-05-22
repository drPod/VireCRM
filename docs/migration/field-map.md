# xlsx → Postgres field map

The canonical column-by-column mapping (xlsx col letter → target table.field) lives in
**[`docs/decisions/06-domain-schema.md` §1 — All 83 xlsx columns mapped](../decisions/06-domain-schema.md#1--all-83-xlsx-columns-mapped)**.
Don't restate it here — link, then edit Doc 06 §1 when the mapping changes.

This file holds Phase 0.5 inspection notes that supplement (or diverge from) Doc 06 §1, so
the Phase 2 migration script doesn't blindly trust §1 against the actual file.

## Inspection workflow

1. Run `bun scripts/inspect-xlsx.ts` against the current source xlsx (default:
   `Copy of NGP MASTER LIST - Copy.xlsx` at repo root).
2. Compare output to Doc 06 §1. Diffs go in **Findings vs Doc 06 §1** below.
3. Land schema changes in Doc 06 §1 *and* the Drizzle schema before Phase 2 runs.

## Source file

- Path: `Copy of NGP MASTER LIST - Copy.xlsx` (git-ignored; local-only)
- Snapshot date this file was last reconciled: **2026-05-23**
- Inspector: `scripts/inspect-xlsx.ts`

## Findings vs Doc 06 §1 (2026-05-23 run)

| Topic | Doc 06 §1 says | Inspector says | Action |
|---|---|---|---|
| Row count | 5,446 rows (range `A1:CE5446`) | `actualRowCount = 4792` | Reconcile before migration. Likely the xlsx was trimmed between §1 authoring and now, OR Doc 06 read xlsx range padding. Re-run inspect and pin row count in this file at lock-time. |
| Column count | 83 cols (`A:CE`) | 84 cols — column `CF` exists but is fully empty | Drop `CF` on import alongside `A` (constant `Company`) and `AJ` (duplicate `Customer Name`). |
| `Supply Type` (col F) | Single-select: `Electricity` / `Gas` (future) | 9 distinct values including 7 polluted entries like `Emailed Erica- 10.31.2023`, `Sent email to joseph - 11-1-2023`. Real values: `Non-HH`, `Gas`. | Migration must reject / quarantine non-enum values. Doc 06 §1 `Supply Type` enum widens to `Non-HH` + `Gas` for v1; `Electricity` not present in source. |
| `Sale Status` (col R) | Single-select: `Approved` / `Pending` / `Lost` | 6 distinct: `Approved`, `Lost`, `Completed`, `Meter Check`, `Declined`, `Objection` | Update schema enum to the 6 observed values OR coalesce `Completed`→`Approved`, `Meter Check`/`Declined`/`Objection`→`Pending`. Decide before Phase 2 locks. |
| `Resold Status` (col AV) | Single-select | 3 distinct: `-`, `Same Month`, `Future Month` | Normalize `-` → NULL. Enum: `same_month` / `future_month`. |
| `Lost Reason` (col V) | Single-select | 11 distinct (4,307 blank): `Complete loss`, `Agent Miss Sold`, `Meter Disconnected`, `Contract Override (Incombend)`, `COT`, `Contract Override (New)`, `Reissue`, `Termination Failure`, `Never went live with NGP Supplier`, `Others`, `Cancelled by Supplier` | Lock enum to these 11. Typo `Incombend` (likely `Incumbent`) — preserve verbatim on import, surface in Phase 2 review. |
| `Lost TCV` / `AQ Loss` / `AQ Gain` / `Net AQ` (cols N, Y, Z, AA) | Numeric reconciliation fields | All four columns currently `0` for every row | Either historical loss data was scrubbed or never populated. Confirm with Darsh before Phase 2 — if these stay zero, Doc 06 §1 still maps them (preserve schema), but migration adds no signal. |
| Normal AQ + COVID AQ (cols AB–AG) | Doc 06 marks as **NOT MAPPED — defer** (COVID/historical) | All `0` for every row in source | §1 verdict holds — defer. No need to revisit. |
| `Customer Category` (col AX) | Single-select | 2 distinct: `N/A`, `Micro Business` | Effectively a boolean. Map to enum or boolean `is_micro_business`. |
| `Source of Lead` (col BK) | Single-select | 1 distinct: `Be-Spoke` | Field carries no signal in current data. Preserve column on import (future-proof) but don't waste UI on filter. |
| `AQ Check` / `Billing AQ` / `Comms Paid` / `Comms Outstanding` / `Meter Consumption` (cols AT, AU, BE, BF, I) | First-class fields | Every row = `-` (literal dash, treated as blank) | Confirm with Darsh: is this CEO #1's actual data state, or were these stripped pre-export? §1's "commission paid against Billing AQ" hinge depends on this column being populated. If perma-blank in source, Phase 2 leaves the columns NULL and the per-contract reconciliation logic in Doc 06 §6 has no v1 data to drive it. |
| `Agg Comm %` (col BJ) | Numeric, percent | 2 distinct (4,554 blank): `20`, `1` | Schema can hold this as `numeric(5,2)`. Default NULL when broker isn't sub-broker. |
| Address columns (BY/BZ/CA/CB/CC/CD/CE) | Doc 06 §1 maps to `Service Addresses.{Address 1,Address 2,Street Name,Street No,City,State,ZIP}` | **`city` and `state` are swapped in many rows** (e.g. row 3: `city = MA`, `state = Canton`). `street_name` populated in only 2,609/4,792 rows. | Add a coercion step: detect 2-letter US state codes in the `city` col and swap. Spot-check after migration. |

## Updating this file

- Re-run `bun scripts/inspect-xlsx.ts` whenever the source xlsx is replaced.
- Add a new dated section under **Findings vs Doc 06 §1** for each refresh; don't overwrite prior runs unless the underlying xlsx hasn't changed.
- Push schema-level mapping edits into Doc 06 §1 — this file is a notebook for divergences, not a competing field map.
