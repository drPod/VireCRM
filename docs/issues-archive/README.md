# Issues archive

Cold log of resolved sessions. Append-only. Live state lives in root `ISSUES.md`.

## Files

| Month | File | Lines | Span | Highlights |
|---|---|---|---|---|
| 2026-05 | [`2026-05.md`](./2026-05.md) | ~1700 | 2026-05-17 → 2026-05-18 | Initial vibe-coded audit, Phase 1 Lovable migration (Anthropic + Resend swap), workflow engine build-out, Vercel → Cloudflare host migration, CF for SaaS reseller wiring, `/features` + `/preview` rebuild |

## How items get here

1. Item lands in root `ISSUES.md` `## Open` when discovered.
2. When shipped, item gets a `### Shipped` entry under `## Recent` in root `ISSUES.md` (with commit sha + verification). Open entry deleted.
3. When the entire `## Recent` section is resolved (every entry strikethrough or shipped) AND >14 days cold, append it verbatim to the matching `YYYY-MM.md` here. Newest at top of that file's session list.
4. Update this README's table when a new month file is created.

## How to query

### Grep across all months

```bash
# All security work this year
grep -nE '\[security\]' docs/issues-archive/*.md

# Every cf-saas mention with line numbers (paste cf_hostname_id, hostname, route binding work, etc)
grep -nE '\[cf-saas\]' docs/issues-archive/*.md

# All resolved bugs touching DomainHealthPanel
grep -nE 'DomainHealthPanel' docs/issues-archive/*.md

# Find the session that touched a specific commit sha
grep -n '2444041' docs/issues-archive/*.md
```

### Grep by tag

Every archive entry tagged via inline `[tag]` markers. Tag glossary lives in `2026-05.md` (will move to this README if it survives multi-month edits without drifting). Common combos:

- `[security] [supabase]` — RLS hardening, SECURITY DEFINER lockdowns
- `[lovable-migration]` — Phase 1 + Phase 2 cleanup
- `[cf-saas] [reseller]` — custom hostname wire, white-label, DomainHealthPanel
- `[audit] [browser]` — agent-browser-verified findings
- `[bug] [frontend]` — UI fixes only

### Grep by file or symbol

File paths preserved verbatim in archive entries. To find every prior touch on a given file:

```bash
grep -nE 'src/components/crm/DomainHealthPanel\.tsx' docs/issues-archive/*.md ../../ISSUES.md
```

### Find prior decision rationale

Each session entry includes a `### Verification` block (what was actually run) and often `### Manual follow-up (user)`. Useful for "why did we do X" questions — search for `Why:`, `Decided`, `Rationale`, `Trade-off`, or the specific feature name.

## Conventions for future months

- One file per calendar month: `YYYY-MM.md`.
- Each file: brief header + ToC + reverse-chrono session entries.
- Reverse-chrono within the file (newest 2026-06-30 at top, oldest 2026-06-01 at bottom).
- Section-header anchor format `## YYYY-MM-DD — short title` so cross-links from root `ISSUES.md` work via GitHub auto-anchors.
- Tag inline at section level: `**Tags:** [foo] [bar]` on the line below the date header (the 2026-05 archive uses a ToC table instead since it was bulk-imported; both shapes are fine, tags are the load-bearing part).
- Never edit a section once archived. To correct a prior claim, write a new entry in current root `ISSUES.md` referencing the archive entry by date + section title.
- When adding a new month file, update this README's table.

## Anti-conventions (don't do)

- Don't fold archive sections back into root `ISSUES.md` to "re-litigate". If the topic resurfaces, write a new entry with a back-reference to the archive.
- Don't strip tags. Even sparse tagging keeps `grep -E '\[…\]'` useful.
- Don't lose commit shas. Every shipped entry should cite the sha. Grep across years works via that.
- Don't rewrite history (literally — don't `git push --force` over archive commits). Archive is the durable audit trail.
