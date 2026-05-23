# xlsx → Postgres field map

> **⚠ Agent-authored.** Drafted by AI agents from inspect-script output + conversation context. Verify against the live xlsx and Doc 06 §1 before treating any specific claim as load-bearing.


The canonical column-by-column mapping (xlsx col letter → target table.field) lives in
**[`docs/decisions/06-domain-schema.md` §1 — All 84 xlsx columns mapped](../decisions/06-domain-schema.md#1--all-84-xlsx-columns-mapped)**.
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
| Row count | (stale 5,446 in earlier draft — ignore) | `actualRowCount = 4792` | Inspector output is canonical. Doc 06 §1 now reads 4,792. Re-run inspect whenever source xlsx is replaced. |
| Column count | (stale 83 in earlier draft — ignore) | 84 cols — column `CF` exists but is fully empty | Drop `CF` on import alongside `A` (constant `Company`) and `AJ` (duplicate `Customer Name`). |
| `Supply Type` (col F) | Single-select: `Electricity` / `Gas` (future) | 9 distinct values including 7 polluted entries like `Emailed Erica- 10.31.2023`, `Sent email to joseph - 11-1-2023`. Real values: `Non-HH`, `Gas`. | Migration must reject / quarantine non-enum values. Doc 06 §1 `Supply Type` enum widens to `Non-HH` + `Gas` for v1; `Electricity` not present in source. |
| `Sale Status` (col R) | Single-select: `Approved` / `Pending` / `Lost` | 6 distinct: `Approved`, `Lost`, `Completed`, `Meter Check`, `Declined`, `Objection` | Update schema enum to the 6 observed values OR coalesce `Completed`→`Approved`, `Meter Check`/`Declined`/`Objection`→`Pending`. Decide before Phase 2 locks. |
| `Resold Status` (col AV) | Single-select | 3 distinct: `-`, `Same Month`, `Future Month` | Normalize `-` → NULL. Enum: `same_month` / `future_month`. |
| `Lost Reason` (col V) | Single-select | 11 distinct (4,307 blank): `Complete loss`, `Agent Miss Sold`, `Meter Disconnected`, `Contract Override (Incombend)`, `COT`, `Contract Override (New)`, `Reissue`, `Termination Failure`, `Never went live with NGP Supplier`, `Others`, `Cancelled by Supplier` | Lock enum to these 11. Typo `Incombend` (likely `Incumbent`) — preserve verbatim on import, surface in Phase 2 review. |
| `Lost TCV` / `AQ Loss` / `AQ Gain` / `Net AQ` (cols N, Y, Z, AA) | Numeric reconciliation fields | All four columns currently `0` for every row | Resolved 2026-05-23 (round 2) with Darsh: likely scrubbed pre-export. CRM must work with or without the data. Phase 2 imports `0` as-is; client populates via UI. Lost/gained dashboards must handle both populated + empty datasets without breaking. |
| Normal AQ + COVID AQ (cols AB–AG) | Doc 06 marks as **NOT MAPPED — defer** (COVID/historical) | All `0` for every row in source | §1 verdict holds — defer. No need to revisit. |
| `Customer Category` (col AX) | Single-select | 2 distinct: `N/A`, `Micro Business` | Effectively a boolean. Map to enum or boolean `is_micro_business`. |
| `Source of Lead` (col BK) | Single-select | 1 distinct: `Be-Spoke` | Field carries no signal in current data. Preserve column on import (future-proof) but don't waste UI on filter. |
| `AQ Check` / `Billing AQ` / `Comms Paid` / `Comms Outstanding` / `Meter Consumption` (cols AT, AU, BE, BF, I) | First-class fields | Every row = `-` (literal dash, treated as blank) | Resolved 2026-05-23 (round 2) with Darsh: data was likely stripped pre-export. Phase 2 coerces `-` → NULL; schema columns ship; client populates via UI / re-import / supplier ingest. Reconciliation in Doc 06 §6 operates per-row against whatever is populated. |
| `Agg Comm %` (col BJ) | Numeric, percent | 2 distinct (4,554 blank): `20`, `1` | Schema can hold this as `numeric(5,2)`. Default NULL when broker isn't sub-broker. |
| Address columns (BY/BZ/CA/CB/CC/CD/CE) | Doc 06 §1 maps to `Service Addresses.{Address 1,Address 2,Street Name,Street No,City,State,ZIP}` | **`city` and `state` are swapped in many rows** (e.g. row 3: `city = MA`, `state = Canton`). `street_name` populated in only 2,609/4,792 rows. | Add a coercion step: detect 2-letter US state codes in the `city` col and swap. Spot-check after migration. |

## Reconciliation log

### 2026-05-23 — findings landed in Doc 06

All rows in the **Findings vs Doc 06 §1** table above were applied to `docs/decisions/06-domain-schema.md`:

- **§1 prose (row + col count).** Updated from `5446 × 83` to `4792 × 84`. Earlier 5446 figure attributed to trailing empty-row padding in the raw XML range.
- **§1 row 6 (Supply Type).** Enum now documents `Non-HH` / `Gas` verbatim, with note that `Non-HH` is UK Non-Half-Hourly small-commercial electricity (preserved, not coerced to `Electricity`). Migration must quarantine 7 polluted free-text values.
- **§1 row 18 (Sale Status).** Enum expanded from 3 → 6: `Approved` / `Lost` / `Completed` / `Meter Check` / `Declined` / `Objection`. Round-trip principle — no coalesce.
- **§1 row 48 (Resold Status).** Enum locked to `same_month` / `future_month`; `-` coerced to NULL.
- **§1 rows 9, 14, 25, 26, 27, 46, 47, 57, 58 (blank/zero columns).** Per-row notes added flagging v1 source state (`-` or `0` in every row). Schema columns preserved; migration writes NULL/0 and reconciliation logic stays dormant.
- **§1 row 63 (Source of Lead).** Note added that v1 source carries 1 distinct value (`Be-Spoke`); column preserved, no UI filter wired.
- **§1 rows 81-82 (city/state).** Coercion note added — migration must detect 2-letter US state codes in `city` and swap.
- **§1 row 84 (NEW — CF).** Empty column added to map as dropped on import.
- **§1 Summary line.** Updated to `75/84` round-trip with the 3 drops + 6 deferred breakdown.
- **§6 (Commission accounting depth).** Appended a "v1 data gap" paragraph noting the reconciliation hinge has no driver data until supplier-fed Billing AQ arrives.

`CLAUDE.md` "Round-trip 83 xlsx cols" line also updated to 84 / 4792 / 75-round-trip.

### 2026-05-23 (round 2) — open questions closed

All three "still open" items from the first round were resolved with Darsh:

- **Billing AQ family blank** (cols AT / AU / BE / BF / I) → likely stripped pre-export. Schema ships designed; Phase 2 NULLs the missing values; client populates via UI form, re-import with corrected xlsx, or supplier-statement ingest. Reconciliation logic operates per-row; rows missing Billing AQ skip the expected-vs-received computation and surface "awaiting data" in UI. CRM must work with and without the data.
- **Lost TCV / AQ Loss/Gain/Net** (cols N / Y / Z / AA) → likely scrubbed. Same handling: import zeros, client backfills via UI, dashboards must render gracefully against empty + populated datasets.
- **Non-HH display** → display verbatim. Every label needing context gets a hover tooltip with the definition (UK origin / TX equivalent / source-of-truth pointer). UI convention added to `CLAUDE.md` § UI. Doc 06 §3 cross-references.
- **Row-count gap (4,792 vs earlier 5,446)** → inspector output is canonical. Speculation about XML range padding / file replacement removed from Doc 06 §1 prose and README. `scripts/inspect-xlsx.ts` is the source of truth; re-run when source xlsx is replaced.

Doc 06 edits applied this round:

- §Verdict prose — row count phrased as canonical inspect output, no parenthetical caveat about earlier-draft figures.
- §1 prose — Initial-authoring-read-X / later-inspect-reports-Y reconciliation removed. Single statement: 4,792 × 84 per inspector.
- §1 row notes for cols I / N / Y / Z / AA / AT / AU / BE / BF — reframed from "broker doesn't track" / "dormant" → "likely stripped pre-export, client-fillable, CRM operates with or without."
- §6 — "no data to drive in v1" / "dormant until supplier ingest" / "CEO #1 confirmation TODO" stripped. Reconciliation logic ships and operates per-row; missing-data UX = "awaiting data" not blocking.
- §3 — UI convention added: display verbatim, tooltips on labels needing context. Cross-references CLAUDE.md.

Across-repo edits:

- README.md `master list` paragraph — speculation removed; counts canonical from inspect script.
- CLAUDE.md — schema-conventions line trimmed; new § UI added (display-verbatim + tooltip required-labels list).
- AGENTS.md — 83-col → 84-col reference fixed.
- All docs (README, CLAUDE, AGENTS, docs/decisions/01-10, docs/migration/field-map) — agent-authored disclaimer banner added at top.

No open questions block Phase 2 migration script start.

## Updating this file

- Re-run `bun scripts/inspect-xlsx.ts` whenever the source xlsx is replaced.
- Add a new dated section under **Findings vs Doc 06 §1** for each refresh; don't overwrite prior runs unless the underlying xlsx hasn't changed.
- When findings land in Doc 06, add a dated entry under **Reconciliation log** summarizing what was applied.
- Push schema-level mapping edits into Doc 06 §1 — this file is a notebook for divergences, not a competing field map.
