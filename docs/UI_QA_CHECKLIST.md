# Customer-Facing UI QA Checklist

Run before every release. Covers public + reseller + post-login surfaces that
end customers actually see. Pair with `bun run test:visual` for automated
screenshot diffs (see `tests/visual/`).

## Scope

| Surface | Routes |
|---|---|
| Marketing | `/`, `/pricing`, `/about`, `/contact` |
| Auth | `/auth`, `/reset-password`, `/accept-invite`, `/unsubscribe` |
| Public booking | `/book/:slug` |
| Reseller white-label | `/r/:slug`, `/r/:slug/signup`, `/r/:slug/checkout/:planSlug` |
| Post-login shell | `/dashboard`, sidebar, loading shell |

## Manual Checklist

### 1. Layout & Spacing
- [ ] No horizontal scroll at 320, 375, 768, 1024, 1440 px
- [ ] Page has consistent outer padding (`px-4 sm:px-6 lg:px-8`)
- [ ] Cards/sections share a vertical rhythm (no random gaps)
- [ ] Footer sits at bottom on short pages (no floating mid-screen)
- [ ] Long content doesn't overflow containers (`min-w-0`, `truncate`, `break-words`)

### 2. Typography
- [ ] One `<h1>` per page, semantic heading order
- [ ] Body copy ≥ 14px, line-height ≥ 1.5
- [ ] No orphaned single words on narrow viewports
- [ ] Inter font loaded (no FOUT flash to system serif)

### 3. Color & Contrast
- [ ] No raw `text-white` / `bg-black` — only design tokens
- [ ] WCAG AA contrast on body text and buttons
- [ ] Status colors (success/warning/destructive) used consistently
- [ ] Active nav state visible in sidebar

### 4. Forms
- [ ] Every input has a visible `<Label>`
- [ ] Required fields marked, inline error shown on blur/submit
- [ ] Email/password validated client-side before submit
- [ ] Submit button shows spinner + disabled state during request
- [ ] Server errors surfaced in a toast or inline message (not console)
- [ ] Success state clears form or navigates

### 5. Loading & Empty States
- [ ] Skeletons (not raw spinners) for list/table loads
- [ ] Branded loading shell on auth-gated routes
- [ ] Empty states have icon + message + primary action
- [ ] Errors offer a "Retry" affordance

### 6. Interactions
- [ ] Buttons have hover + focus-visible rings
- [ ] Keyboard tab order is logical, no traps
- [ ] Modals/dialogs close on Esc and overlay click
- [ ] Mobile drawer locks body scroll while open

### 7. Responsive
- [ ] Test 320 / 375 / 414 / 768 / 1024 / 1440
- [ ] Tap targets ≥ 44px on mobile
- [ ] Tables scroll horizontally inside their container
- [ ] Images use `aspect-ratio` or fixed dims (no layout shift)

### 8. SEO & Meta (public pages only)
- [ ] Unique `<title>` < 60 chars
- [ ] Meta description < 160 chars
- [ ] `og:title`, `og:description`, `og:image` set
- [ ] Single canonical link

### 9. Booking Page Specific (`/book/:slug`)
- [ ] Times shown in visitor's local timezone
- [ ] Day strip scrolls horizontally on mobile
- [ ] "Change" button returns to slot picker
- [ ] Confirmation page is shareable / refresh-safe

### 10. Reseller Pages Specific (`/r/:slug/*`)
- [ ] Reseller branding (logo, primary color) applies everywhere
- [ ] Checkout shows price, plan, and what's included
- [ ] Signup → checkout flow has no broken back-button

## Sign-off

- Manual pass: ___ (name, date)
- Visual diff pass: `bun run test:visual` green
- Lighthouse mobile ≥ 90 perf / 100 a11y on `/`, `/pricing`, `/book/demo`
