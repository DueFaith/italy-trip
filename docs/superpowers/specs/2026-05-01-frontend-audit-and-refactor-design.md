# Frontend Audit & Refactor — Design Spec

**Status:** Draft for approval
**Author:** Claude (with Kevin Sundberg)
**Date:** 2026-05-01
**Repo:** `/Users/kevinsundberg/code/italy/italy-trip`
**Live URL:** `https://italy-trip.github-mud285.workers.dev/`
**Predecessor specs:**
- `2026-04-29-dolomites-trip-website-design.md` (original build)
- (No prior accessibility / refactor specs)

---

## 1. Purpose

The trip site is built and deployed. After a vintage-poster design pass, the user identified that the site has rough edges in three areas:

- **Accessibility** — gold text fails WCAG 2.2 AA contrast in many places, touch targets are below the 44×44 minimum, no `:focus-visible`, mono-caps too small to read for many users.
- **Information architecture** — the same 6 hikes appear in three places, the schedule is canonical in two, the bottom-nav "Day" tab is a riddle outside trip dates, the More menu mixes power-user features with quick references.
- **Navigation logic** — multi-hike days (Day 4) make prev/next ambiguous; jumping between days requires going home; landing the app during the trip doesn't put "today" front and centre.

This spec covers a single coordinated pass to fix all three. Scope was scoped to **D** ("everything including polish") and **B** ("accessibility-first when conflicting with the vintage palette") in the brainstorming phase.

## 2. Scope

### In scope (this spec)

- All accessibility fixes graded "real" (items 1-5 in the audit + heading hierarchy from item 17)
- Information-architecture restructure (items 6-10)
- Navigation-logic improvements (trip-order prev/next, persistent day-pill scroller, today banner, slim breadcrumb)
- Readability/density improvements (items 11-13)
- Polish: View Transitions, PWA manifest, Lighthouse pass, booking-checklist + customize UX cleanup (items 14-17)

### Out of scope (deferred)

- Photo-gallery UX (empty until post-trip)
- Lake Garda extension (deferred from original spec)
- Vector-tile vintage map style (current sepia-filter is fine for v1)
- Internationalization (Italian/German labels)
- Trip-recap / post-trip mode
- Customize-mode form re-design (it's already React; visual containers updated, leave the forms)

## 3. Decisions made (settled in brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Scope of refactor | **D** — everything | User wants a holistic pass |
| Aesthetic vs. accessibility tradeoff | **B** — accessibility-first | Gold becomes a non-text token; small captions move to slate-teal |
| `/hikes` index in bottom nav | **Drop from nav** | Redundant with home; route stays accessible from /more |
| `/day/[date]` schedule | **Remove from day page** | Hike-page Part II is now the canonical schedule |
| Customize placement | **Header gear icon + still in /more** | Header gives instant access; /more keeps it discoverable |
| Day-tab redirect | **Remove entirely** | Replaced by home itinerary + persistent day-pill scroller |
| Hike-page prev/next | **Trip-order, not day-order** | Solves multi-hike-day ambiguity |
| Today banner | **Home page, only during trip dates** | Predictable nav > clever nav |

## 4. Information architecture (final)

### Bottom navigation (4 slots)

```
[ Home ]   [ Map ]   [ Checklist ]   [ More ]
```

- **Home** — `/`, the trip overview
- **Map** — `/map`, full-screen interactive map
- **Checklist** — `/checklist`, booking checklist (high pre-trip importance)
- **More** — `/more`, expanded menu

Each item: **min 44px tall**, custom inline-SVG glyph + 11px mono-cap label. Active item gets a sliding gold underline (already implemented). `aria-current="page"` on the active link.

### Header (every page)

```
[ ⛰ DOLOMITES · '26 ]                              [ ⚙ ]
```

- Wordmark on the left (existing) — tap returns to home
- **Customize gear icon** on the right — replaces the "Customize" text link, opens `/customize`
- Customized-state pill (existing) appears between the wordmark and the gear when local edits are present

### Routes & their roles

| Route | Role | Source of truth for |
|---|---|---|
| `/` | Trip overview | Countdown, the 6 hikes (poster cards), booking ring, day list (itinerary at the bottom) |
| `/day/[date]` | Day at-a-glance | Theme, hikes-of-the-day, driving snapshot, lodging snapshot, bad-weather backup, prev/next day |
| `/hike/[slug]` | Route detail + day context | Route facts (Part I) AND the canonical day schedule + driving + lodging + "also today" + day-level bad-weather (Part II) |
| `/map` | Full-screen map | Trailheads, lodgings, parking pins |
| `/checklist` | Booking checklist | Status of all 11 booking items |
| `/lodgings` | Lodging reference | Hotel cards with addresses, phones, booking URLs |
| `/restaurants` | Restaurant reference | Per-area lists |
| `/contingencies` | Weather backups | Forecast sources, decision rules, rainy-day activities |
| `/photos` | Photo gallery scaffold | Empty in v1 |
| `/customize` | Local-edit mode | Drag-and-drop, edit forms, share-link |
| `/more` | Menu page | Lodgings, restaurants, contingencies, photos, hikes, customize |
| `/hikes` | Hikes index | Power-user list view; reachable from /more, not in bottom nav |

### Removed

- `/day` root redirect (no longer needed)

### Day page slimming, concretely

- **Keep**: hero (Day NN/NN stamp + theme + EditDayButton), hikes-of-the-day cards (full `.hike-poster` style), driving snapshot card, lodging snapshot card, bad-weather backup, prev/next day nav.
- **Remove**: full schedule timeline (now lives only on hike page Part II).
- **Add**: small mono-cap "View full schedule →" link on each hike card pointing at `/hike/[slug]#schedule`.

## 5. Navigation logic

### Trip-order prev/next on hike pages

Currently the hike page footer chevrons walk by *day* (and skip same-day siblings). Replace with **trip-order** prev/next:

```ts
const allHikes: Array<{ hike, day }> = [];
for (const day of days) {
  for (const slug of day.data.hikeSlugs) {
    allHikes.push({ hike: getHike(slug), day });
  }
}
const idx = allHikes.findIndex((x) => x.hike.slug === hike.slug);
const prev = allHikes[idx - 1];
const next = allHikes[idx + 1];
```

Render at the bottom of every hike page:

```
←  TRE CIME DI LAVAREDO            CADINI DI MISURINA →
   THU 16 JUL                       SAT 18 JUL
```

Labels are hike names (display), dates are mono-cap secondary. Same-day next reads naturally (`Lago di Braies → Cadini di Misurina`, both Sat 18 Jul).

### Persistent day-pill scroller on day + hike pages

Add a sticky scroller below the page header on `/day/[date]` and `/hike/[slug]`:

```
┌──────────────────────────────────────────┐
│ [15 JUL][16 JUL][17 JUL]●[18 JUL][19][20]│   ← active = current page's day
└──────────────────────────────────────────┘
```

Implementation:
- Reuse the home-page `.day-pill-scroll` component
- Rendered in BaseLayout via an optional `dayPillsActiveDate` prop, only shown on routes that pass it
- Sticky-position below header; height ~52px; backdrop-blur same as nav
- Active pill marked with `aria-current="true"` and the existing gold border + outward-pulse

### "Today" banner — home page, trip dates only

Above the countdown, between the hero and the countdown sections:

```html
{ todayInTrip && (
  <a href={`/hike/${todayHike.slug}`} class="today-banner">
    <span class="eyebrow">Today · Day 03</span>
    <span class="title">Lake Sorapis</span>
    <span class="meta">12.7 km · 600 m · 4–5h</span>
  </a>
)}
```

- Visible only when `today >= trip.startDate && today <= trip.endDate`
- Tap → today's hike page (or first hike if multiple, or day page if no hike that day)
- Style: postcard-rotated -1deg with `--moss` left-border accent (success/active green) so it reads distinctly from the gold-accented hikes
- Outside trip dates: completely absent (no DOM)

### Slim breadcrumb on hike pages

Replace the existing eyebrow row with a leading breadcrumb:

```
←  DAY 04 · SAT 18 JUL                              [VENETO · LOOP]
Lago di Braies lake loop
```

The arrow + "Day NN · weekday DD MMM" links to `/day/[date]`. The right-aligned "VENETO · LOOP" stays as informational eyebrow.

Drop the existing footer "See Day NN On Its Own" link — the breadcrumb replaces it.

### Booking checklist deep-links

For booking items in the `parking` and `cable-car` categories, add a `relatedHikeSlug` field to the booking shape so checklist rows can link directly to the relevant hike page:

```yaml
- id: b-7
  label: Tre Cime parking — Thu Jul 16, 07:00 slot
  category: parking
  status: pending-window
  bookingOpens: 2026-06-16
  bookingUrl: https://pass.auronzo.info
  relatedHikeSlug: tre-cime          # NEW
```

The checklist row gets a small `View hike →` mono-cap link when `relatedHikeSlug` is present.

### Customize page enhancements

- **Empty-state hint** when `isCustomized(state) === false`: a subtle paper card at the top: *"Drag a hike between days to rearrange. Tap any hike or day to edit details."*
- **Promote share-link button** from the bottom of `/customize` to a sticky bottom bar that's always visible while you're on the page.

## 6. Accessibility

### Color & contrast

| Token | Old role | New role |
|---|---|---|
| `--gold` (`#D4A24C`) | Used for both decorative accents and small text | **Non-text only** — rules, dashed borders, decorative SVG, large display numbers (≥24px), focus outline |
| `--ink-soft` (`#2C5359`) | Already in use for muted body | Now also handles **all small text that was gold** (eyebrows, "Day NN/NN", small ordinals, mono-cap captions) |

Specific replacements:

| Element | Before | After |
|---|---|---|
| Section eyebrows (`.eyebrow`) | `color: var(--gold)` | `color: var(--ink-soft)` |
| Mono-cap captions (`.mono-cap`) | Mix; many were gold | `color: var(--ink-soft)` by default; pages can opt into gold via `.mono-cap.accent` for non-text contexts (e.g. a label sitting on a gold rule, where the rule is the "color") |
| Dashed underlines | `border-bottom: 1px dashed var(--gold)` | Unchanged (border, not text) |
| Stamp inner text | `color: var(--ink)` | Unchanged (was already correct) |
| Stat-num gold middots in hike posters | `color: var(--gold)` between numbers | `color: var(--ink-soft)` opacity 0.6 (decorative) |
| Footer / view-all links | Gold mono-cap | `--ink-soft` mono-cap with gold dashed underline (the underline carries the accent) |

The `.eyebrow.signal` variant (signal red) stays unchanged — it passes contrast.

The `.eyebrow.with-rule::after` underline stays gold — it's a 1px decorative rule, not text.

### Touch targets

- Day pills: `min-height: 44px` (was 38px). Padding adjusts; visual size grows ~6px.
- Header customize gear: `width: 44px; height: 44px` hit area; visual icon stays 22px.
- All icon-only buttons audited for 44×44 hit area; pad with invisible padding where needed.
- Map pins: visual stays 14px; hit area 32×32 via the marker element padding (MapLibre supports this).

### Focus visibility

Add to `global.css`:

```css
:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}
*:focus:not(:focus-visible) {
  outline: none;
}
```

Plus a skip link as the first DOM element of every page:

```astro
<a href="#main" class="skip-link">Skip to main content</a>
```

```css
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
}
.skip-link:focus-visible {
  left: var(--page-x);
  top: 8px;
  background: var(--ink);
  color: var(--bg);
  padding: 10px 14px;
  border-radius: var(--r-sm);
}
```

### Type scale floor

| Element | Before | After |
|---|---|---|
| Mono-cap labels (default) | 9.5–10px in many places | **11px minimum** (a few legitimate decorative uses can stay 10px if rule-adjacent) |
| Body text (cards, schedule rows, hazards) | 13–13.5px | **14.5px minimum** |
| Bottom-nav labels | 9.5px | **11px** |
| `.ticket-label` ("Day" inside ticket-stub rail) | 9px | **10px** (decorative, sub-element of bigger ticket-num) |

### Semantic markup

- `aria-label` added to every icon-only `<button>` and icon-rich `<a>`:
  - Header customize gear → `aria-label="Customize"`
  - Header logo → `aria-label="Home"`
  - ShareLinkButton → `aria-label="Copy share link"`
  - EditHikeButton → `aria-label="Edit hike details"`
  - EditDayButton → `aria-label="Edit day"`
  - Map markers (already have popups; ensure they have an `alt` equivalent on the marker element)
- `aria-current="page"` on active bottom-nav item (matches existing day-pill pattern)
- `<main id="main">` for the skip link target on every page (BaseLayout)
- `<aside aria-label="Day navigation">` wrapping the persistent day-pill scroller
- Heading hierarchy normalized:
  - H1 = page title (1 per page)
  - H2 = top-level section ("Schedule", "Hikes", "Driving", "Where You Sleep", "Part II — The Day", etc.)
  - H3 = items inside sections (individual hike names on day pages, individual rifugios in food-on-trail, etc.)
- Current home page has 6 H3s under one H2 ("The 6 Hikes") — that's fine. The H1+H2+H3 chain is correct.
- Hike page currently has an H2 inside Part II ("The Day theme") — fine. But Part I has no H2; the section structure is "h1 → h2 (stat block? no)" — needs review per page.

### Reduced motion (reaffirmed)

`prefers-reduced-motion: reduce` already disables: contour drift, count-up, ring fill, stat pop-in, eyebrow rule draw, stamp wobble, day-pill pulse, postcard-arrow nudge, ticket transitions. Confirmed list still complete after Phase B + C additions.

## 7. Readability & density

- 4-stat hike-poster grid stays 4-column at ≥360px viewport, **collapses to 2×2 below 360px** (iPhone SE).
- Schedule timeline (only on hike-page Part II now): subtle alternating background tint every 4 rows for visual rhythm on 13+ row days.
- Postcard rotation capped at **±0.5deg** (was -1deg in places); easier on the eyes for long content.
- Mono-caps used **only for true labels** (eyebrows, stat captions, badges); regular sans for in-flow text. The current overuse on whole rows like "View All →" gets toned to regular weight + dashed underline.

## 8. Polish

### View Transitions (Astro 5)

```astro
<!-- BaseLayout.astro <head> -->
import { ClientRouter } from 'astro:transitions';
<ClientRouter />
```

- Adds ~2 KB JS site-wide
- Crossfades between pages instead of full reload
- Header + bottom-nav stay sticky during transition (set `transition:persist` on those)
- Honours `prefers-reduced-motion` automatically

### PWA install prompt

Create `public/manifest.webmanifest`:

```json
{
  "name": "Dolomites Trip · Jul 2026",
  "short_name": "Dolomites",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F1E9D2",
  "theme_color": "#F1E9D2",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-mask-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Plus icons (192×192, 512×512, 512×512 maskable) in `public/icons/` — generated from a simple gold-mountain glyph on the warm-bone palette to match the rest of the site.

`<link rel="manifest" href="/manifest.webmanifest">` added to BaseLayout `<head>`.

### Service worker refresh

`public/sw.js` cache list updated to include the new manifest, the day-pill scroller assets, and the new icons. Bump the cache key from `dolomites-v1` to `dolomites-v2` to force-refresh on existing devices.

### Lighthouse audit

After Phase B + C land, run a Lighthouse mobile audit on the deployed Cloudflare Workers URL. Targets:

- Performance ≥ 95
- Accessibility = 100 (this spec is designed to hit this)
- Best practices = 100
- SEO ≥ 95

Anticipated findings to budget for:
- LCP image / web-font preload tuning
- Heading-order warnings (this spec addresses them)
- `aria-*` warnings (this spec addresses them)

### Booking checklist UX

- Confirmation # input: collapsed by default, expanded via tap/click on a small "Add #" affordance under the label.
- Once item is checked: hide booking URL row (you're done with it); show confirmation # if present.
- Add a `relatedHikeSlug` field to booking schema; checklist row deep-links via "View hike →" when present.
- Group categories already implemented; just visual cleanup.

### Customize page UX

- **Empty-state hint paper-card** at the top of `/customize` when no edits exist:
  > Drag a hike between days to rearrange. Tap any hike or day to edit details.
- **Sticky share button** at the bottom of `/customize` (instead of inline at the page bottom) so it's reachable while you're scrolling through your edits.

## 9. Implementation order

### Phase A — Accessibility foundation (~half day)

Ships independently; does not depend on B or C. Each step purely additive — no behavioural changes.

A1. Update `src/styles/tokens.css` and `tailwind.config.ts`: gold-as-text-token replacements; new `--gold` semantic confined to non-text uses.
A2. Update `src/styles/global.css`: `:focus-visible` rule, `.skip-link` styles, type-scale floor (mono-caps 11px, body 14.5px, nav labels 11px), `.eyebrow.accent` opt-in for non-text gold contexts.
A3. Update `src/components/BottomNav.astro`: bump label sizes, add `aria-current="page"` (already half-present), increase tap targets if not already 56px.
A4. Update `src/components/Header.astro`: 44×44 hit area on logo + customize gear; add `aria-label`s.
A5. Update home/day/hike/lodgings/restaurants/contingencies/checklist/photos/customize/hikes-index/more pages: replace `var(--gold)` text uses with `var(--ink-soft)`; bump small mono-caps to 11px minimum.
A6. Update `src/layouts/BaseLayout.astro`: add `.skip-link` as first DOM element; add `<main id="main">` wrapper.
A7. Update `BookingChecklist.tsx`, `ShareLinkButton.tsx`, `EditHikeButton.tsx`, `EditDayButton.tsx`, `CustomizedPill.tsx`: add `aria-label` to icon-only buttons; ensure 44×44 hit areas.
A8. Heading-hierarchy pass per page: ensure exactly one `<h1>`, sections use `<h2>`, items use `<h3>`. Update each page accordingly.

**Done when:** Lighthouse Accessibility = 100 on home, day, and hike pages; manual keyboard tab walk shows clear focus rings everywhere; manual screen-reader walkthrough on home + day + hike pages is coherent.

### Phase B — IA + navigation logic (~1.5 days)

Depends on A's primitives (focus, contrast, hit areas).

B1. `src/components/BottomNav.astro`: 5 → 4 items. Drop "Hikes". Order: Home / Map / Checklist / More. Update sliding-underline width from 20% to 25%.
B2. `src/components/Header.astro`: replace "Customize" text link with a 44×44 ⚙ gear button with `aria-label="Customize"`.
B3. Delete `src/pages/day/index.astro` (the redirect). Update `/more` and any other consumers to link directly to `/day/[date]` for specific days.
B4. `src/pages/day/[date].astro`: remove the schedule timeline; keep theme + hikes (full `.hike-poster` cards) + driving + lodging + bad-weather + prev/next. Add a small mono-cap "View full schedule →" inside each hike card pointing at `/hike/[slug]#schedule`.
B5. Add a new component `src/components/DayPillScroller.astro`: encapsulates the day-pill scroller. Accepts `activeDate` prop; renders sticky below header.
B6. `src/layouts/BaseLayout.astro`: accept optional `activeDayDate` prop; renders `<DayPillScroller activeDate={...}>` as `<aside>` between header and `<main>` when provided.
B7. `src/pages/day/[date].astro` and `src/pages/hike/[slug].astro`: pass `activeDayDate` to BaseLayout.
B8. `src/pages/hike/[slug].astro`:
  - Compute `allHikesInTripOrder` once
  - Render trip-order prev/next at the bottom of Part II
  - Replace the existing "See Day NN On Its Own" footer with the breadcrumb at the top of the page
B9. `src/pages/index.astro`: add the today-banner block conditional on `today` being inside trip dates; render between hero and countdown.
B10. `src/content/config.ts` + `src/content/bookings.yaml`: add `relatedHikeSlug?: string` to BookingSchema; populate parking + cable-car items via `scripts/migrate-itinerary.mjs`.
B11. `src/components/BookingChecklist.tsx`: collapsible confirmation # field; deep-link "View hike →" when `relatedHikeSlug` present; hide booking URL when checked.
B12. `src/components/customize/CustomizePanel.tsx`: empty-state hint card; promote share button to a sticky bottom bar inside the customize page.
B13. Audit all "Customize" / "Settings" anchors site-wide; ensure they all point to `/customize`.

**Done when:** Bottom nav has 4 items; day page has no schedule; hike page has trip-order prev/next + breadcrumb; today banner appears during trip dates; day-pill scroller appears below header on day and hike pages; checklist has collapsible confirmation field and deep-links.

### Phase C — Polish (~half day)

Depends on B.

C1. `src/layouts/BaseLayout.astro`: import and render Astro's `<ClientRouter />` in `<head>`; add `transition:persist="header"` on Header and `transition:persist="bottom-nav"` on BottomNav.
C2. Create `public/manifest.webmanifest` with the JSON above; create `public/icons/icon-192.png`, `icon-512.png`, `icon-mask-512.png` (one-time SVG-to-PNG generation).
C3. Add `<link rel="manifest" href="/manifest.webmanifest">` to BaseLayout `<head>`.
C4. Update `public/sw.js`: cache key bump to `dolomites-v2`; include manifest + new icons in pre-cache list.
C5. Run Lighthouse mobile audit on https://italy-trip.github-mud285.workers.dev/. Capture scores. Address any finding under 90 in performance / accessibility / best-practices.
C6. Final pass: confirm `prefers-reduced-motion` still disables all new motion (today-banner if it has any motion, day-pill-scroller transitions, View Transitions itself).

**Done when:** Lighthouse Accessibility = 100, others ≥ 90; PWA install prompt works on iOS Safari and Android Chrome; cross-page transitions feel smooth without layout shift.

## 10. Definition of done

- All audit items 1-17 either resolved or explicitly deferred to a follow-up spec.
- Lighthouse mobile: Accessibility = 100, Performance ≥ 95, Best Practices = 100, SEO ≥ 95 on home, day, and hike pages.
- Bottom nav has exactly 4 items: Home / Map / Checklist / More.
- The same hike never appears as canonical in two places.
- Schedule lives only on the hike-page Part II; day pages reference it via "View full schedule →" links.
- Trip-order prev/next walks `Sorapis → Lago di Braies → Cadini → Seceda Firenze` correctly across day boundaries (test specifically with multi-hike Day 4).
- Day-pill scroller appears sticky below the header on day and hike pages with `aria-current="true"` on the matching pill.
- Today banner appears on the home page during trip dates (Jul 15–20, 2026) and is absent outside those dates.
- All small text passes WCAG 2.2 AA contrast (4.5:1 minimum for body); large text passes 3:1.
- All interactive elements have ≥44×44 hit area, visible `:focus-visible` outline, and a meaningful accessible name.
- Skip link works for keyboard users on every page.
- View Transitions crossfade between pages without flashing the static HTML; reduced-motion users get instant transitions.
- PWA installs from iOS Safari "Add to Home Screen" and Android Chrome "Install app" with the right name, icon, and theme color.
- All 20 unit tests pass; 6 Playwright smoke tests pass; no new TypeScript errors.

## 11. Non-goals (explicitly)

- This spec does not introduce a backend, auth, or any kind of multi-device sync.
- This spec does not change the content model or schema (other than the additive `relatedHikeSlug` field on booking items).
- This spec does not rebrand. The vintage poster aesthetic stays; gold is preserved everywhere it isn't a contrast issue.
- This spec does not touch the customize-mode form internals — only its surrounding container UI.
- This spec does not address Lake Garda content; that stays deferred.

## 12. Open flags

| Flag | Note |
|---|---|
| **Lighthouse target may be aggressive.** | If MapLibre's heavy bundle pushes the map page below the 95 performance target, that page can be exempted (it's a tool, not a content page). Other pages should still hit it. |
| **PWA icon assets** | Need to be generated as PNGs; SVG-to-PNG conversion can be done with `sharp` at build time or hand-exported. Either approach is fine; defer the choice to implementation. |
| **`relatedHikeSlug` data** | The migration script will need to map booking-item labels to hike slugs. Easy heuristic: if label contains "Tre Cime" → `tre-cime`; if "Cadini" → `cadini`; if "Seceda" → `seceda-firenze`. Works for the 11 current items; documented in the migration script. |
| **Trip-order prev/next on first/last hike** | First hike has no prev (chevron is hidden); last hike has no next. Behavior already established in day-page nav. |
| **Today banner on transfer days** | Days 1 (arrival) and 6 (departure) and Day 4 (Braies + Cadini) — what does the banner link to? Spec: link to the day page (`/day/[date]`) on transfer/multi-hike days; link to the hike page on single-hike days. Confirm during implementation. |
