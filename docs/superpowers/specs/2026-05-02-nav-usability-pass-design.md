# Navigation & Usability Pass — Design Spec

**Date:** 2026-05-02
**Status:** Approved
**Goal:** A "big pass" navigation & usability uplift for the Italy trip site, drawing patterns from AllTrails, Wanderlog, TripIt, Polarsteps, Roadtrippers, Atlas Obscura, Komoot, and Lonely Planet. Focus areas: map↔content co-presence, phase-aware home page, lodging detail pages, related-activity discovery, and small a11y/consistency wins.

---

## Background

The Italy trip site shipped a Lake Garda extension on 2026-05-01 (Phase II), doubling the content surface. A nav audit surfaced eight friction points; this spec addresses all of them within a single coherent pass. The visual aesthetic (vintage Italian alpine poster — Fraunces serif, Inter Tight, JetBrains Mono, ink #0E3B43, gold #D4A24C, paper #F1E9D2) is preserved throughout.

### Friction points being addressed

1. Lodging dead-end (flat list, no detail pages, asymmetric with hikes/activities)
2. View Transitions don't restore focus (a11y gap)
3. Day-pill scroller doesn't auto-scroll the active pill into view
4. No breadcrumb on activity detail pages
5. Restaurants/Contingencies isolated — only reachable from `/more`
6. Map pin → lodging lands on flat list, not detail
7. Bottom-nav active state not set for `/hike/*`, `/day/*`, `/lodgings/*`, etc.
8. Phase II content sits below 6 hike posters even when at Lake Garda

### Patterns borrowed from real apps

1. **Map + list as co-present views** (Wanderlog, AllTrails, Roadtrippers) → embedded map ribbon on every detail page
2. **"Nearby / related" tail on every detail page** (Atlas Obscura) → 3 closest activities by GPS at the bottom of activity detail
3. **Sticky day picker with auto-scroll** (Wanderlog, TripIt) → active day pill auto-scrolls into view
4. **Mode-aware layouts** (Polarsteps plan/track) → phase-aware home page that reorders by date
5. **Stage as first-class card with stats baked in** (Komoot) → already in place via the existing day pill + ticket list

---

## 1. Information Architecture & Navigation

### Bottom nav — stays at 4 tabs

Home / Map / Activities / More (no change in count, no relabelling).

### Bottom nav — extended active-state rules

Today only `/activities/*` highlights its tab; `/hike/...`, `/day/...`, `/lodgings/...` highlight nothing. New rules:

| Path | Highlights tab |
|---|---|
| `/`, `/hike/*`, `/day/*` | Home |
| `/map`, `/map?...` | Map |
| `/activities`, `/activities/*` | Activities |
| `/more`, `/checklist`, `/restaurants`, `/contingencies`, `/lodgings*`, `/photos`, `/customize` | More |

Implementation: replace `BottomNav.astro`'s single `path.startsWith(it.href + '/')` test with a per-tab matcher function.

### Header — unchanged

Logo → `/`, gear → `/customize`, customize-pill island as today.

### Map ribbon — new ubiquitous element

A new `MapRibbon.astro` component, ~80px tall, sepia-toned to match the existing map page filter (`sepia(0.35) saturate(0.85) hue-rotate(-10deg) contrast(0.95) brightness(1.02)`), rendered inline at the top of every detail page.

| Page | Pins |
|---|---|
| `/day/[date]` | Each `hikeSlug`'s trailhead + the day's lodging |
| `/hike/[slug]` | Single trailhead pin |
| `/activities/[slug]` | Single activity pin |
| `/lodgings/[slug]` | Single lodging pin |

Each ribbon has a "⤢ Full map" control (bottom-right) linking to:
- Day ribbons → `/map?day=YYYY-MM-DD` (pre-filtered + bounds-fit)
- Hike ribbons → `/map?focus=hike-<slug>` (popup auto-opens)
- Activity ribbons → `/map?focus=activity-<slug>`
- Lodging ribbons → `/map?focus=lodging-<slug>`

### Phase-aware home page (medium awareness)

`phaseBoundary = '2026-07-20'` already exists in `index.astro`. Three behaviour changes driven by date:

1. **Adaptive countdown copy.** The big number means different things by phase:
   - `today < startDate` → "X" + label "Days Until Departure" (current)
   - `startDate ≤ today ≤ endDate` → "X" + label "of 13" (e.g. "07 of 13")
   - `today > endDate` → "X" + label "Days Since"

2. **Today banner adapts to phase.**
   - Phase I day with hikes → today's first hike (current behaviour, `/hike/<slug>` href)
   - Phase II day (no hikeSlugs) → "Today: free at Salò" + a horizontal quick-row of 4 nearest activities (computed by haversine from Salò)
   - Outside trip dates → banner hidden (current behaviour)

3. **Booking ring auto-collapses.** When `bookedCount === totalBookings`, render a small green checkmark badge instead of the 168×168 ring. Frees vertical space during the trip when no further bookings are pending.

4. **Section ordering swaps by phase.** Currently the home page is: Hero → Today banner → Countdown → PARTE I → All Hikes → Booking Ring → PARTE II → Salò card → Activities CTA → Itinerary. Phase II reorders to: Hero → Today banner → Countdown → PARTE II → Salò card → Activities CTA → Booking Ring (collapsed) → PARTE I (now collapsed to a "Past phase" summary card linking to /hikes) → Itinerary.

---

## 2. Schema & Data

### No new Zod schemas

All changes use existing types.

### 7 new Garda day records

Generated by extending `scripts/migrate-itinerary.mjs` with an `emitGardaDayStubs()` function. Each is a `DaySchema`-conformant `.md` file (frontmatter only):

```yaml
---
date: 2026-07-21
theme: Free day at Lake Garda
driving:
  legs: []
schedule: []
hikeSlugs: []
lodgingSlug: salo-airbnb
weatherFor:
  lat: 45.6063
  lon: 10.5237
  label: Salò
---
```

Repeated for Jul 21, 22, 23, 24, 25, 26. Day 13 (Jul 27) is special:

```yaml
---
date: 2026-07-27
theme: Departure — drive to VCE
driving:
  legs:
    - from: Salò
      to: Venice Marco Polo Airport (VCE)
      distanceKm: 175
      durationMin: 130
      notes: Aim to arrive by 16:00 for the 19:10 flight; allow buffer for traffic
schedule: []
hikeSlugs: []
lodgingSlug: salo-airbnb
weatherFor:
  lat: 45.6063
  lon: 10.5237
  label: Salò
---
```

### Activity proximity — computed at build time, not stored

`/activities/[slug].astro` computes haversine distance from the current activity to all others, sorts ascending, takes top 3. ~10 lines of plain JS. No schema field, no extra build artifact, automatically stays current as the catalog changes.

### Map ribbon pin sourcing

Each consumer derives its own pins from existing data; no new fields:
- Day ribbon: `day.hikeSlugs.map(slug => hike.trailhead)` + `lodging.{lat,lon}` for `day.lodgingSlug`
- Hike ribbon: `hike.trailhead`
- Activity ribbon: `activity.location`
- Lodging ribbon: `lodging.{lat,lon}`

### `/map` query params

New, optional, additive — no impact on existing `/map` behaviour:

| Param | Effect |
|---|---|
| `?day=YYYY-MM-DD` | Filter pins to that day's hikes + lodging; fit bounds to those pins; default Phase I/II layer toggle to Phase I only |
| `?focus=hike-<slug>` | Centre + zoom on that pin; auto-open its popup |
| `?focus=activity-<slug>` | Same |
| `?focus=lodging-<slug>` | Same |
| (no param) | Current global behaviour unchanged |

### `/lodgings` path restructure

Astro doesn't allow both `src/pages/lodgings.astro` and `src/pages/lodgings/[slug].astro`. The flat file gets moved:

- `src/pages/lodgings.astro` → `src/pages/lodgings/index.astro`
- New: `src/pages/lodgings/[slug].astro`

Public URLs are unchanged (`/lodgings` still works; `/lodgings/baita-fraina` is new).

---

## 3. Components & Pages

### New files

| Path | Responsibility |
|---|---|
| `src/components/MapRibbon.astro` | 80px sepia map. Props: `pins: Pin[]`, `expandHref: string`. Internally renders MapView with `client:visible` so off-screen ribbons don't load maplibre eagerly. |
| `src/components/Breadcrumb.astro` | Mono-cap breadcrumb. Props: `crumbs: { label: string, href?: string }[]`. Last crumb has no link. |
| `src/components/RelatedActivities.astro` | Horizontal scroll of 3 activity cards. Props: `current: CollectionEntry<'activities'>`. Computes haversine and sorts internally. |
| `src/pages/lodgings/index.astro` | Renamed from `lodgings.astro`. Grid of lodging cards, each linking to `/lodgings/<slug>`. |
| `src/pages/lodgings/[slug].astro` | Detail page: map ribbon, address, host, nights/dates, booking link, notes. Mirrors the `/activities/[slug]` rhythm. |

### Modified files

| Path | Change |
|---|---|
| `src/components/BottomNav.astro` | Per-tab active-state matcher per §1 rule table. |
| `src/components/DayPillScroller.astro` | After mount, scroll `.is-active` pill into centre. Re-run on `astro:after-swap` for View Transitions. |
| `src/layouts/BaseLayout.astro` | Add `astro:after-swap` listener that calls `document.getElementById('main')?.focus()` (with `tabindex="-1"` on `#main` for programmatic focus). |
| `src/pages/index.astro` | Medium phase awareness — adaptive countdown copy, Phase II free-day banner with quick-row, ring auto-collapse, section ordering swap based on `inPhaseII`. |
| `src/pages/day/[date].astro` | `<MapRibbon>` at top after day pills. For Garda free-form days (`hikeSlugs.length === 0 && date >= phaseBoundary`), schedule section becomes a "Pick today's activities" CTA. Cross-link to `/contingencies` if `badWeatherOption` is set. |
| `src/pages/hike/[slug].astro` | `<MapRibbon>` at top with single trailhead pin. |
| `src/pages/activities/[slug].astro` | `<MapRibbon>` at top, `<Breadcrumb>` above hero (`Activities · {category-label}`), `<RelatedActivities current={activity} />` above the back-to-catalog link. |
| `src/pages/map.astro` + `src/components/MapView.tsx` | Read `?day=` and `?focus=` query params. Filter / fit / open-popup as per §2. Existing global behaviour unchanged when no params. |
| `scripts/migrate-itinerary.mjs` | New `emitGardaDayStubs()` function — emits 7 day `.md` files for Jul 21-27. Wired into `runMigration()` after `for (const d of days) emitDay(d)`. |
| `public/sw.js` | Bump cache key `dolomites-v3` → `dolomites-v4`. |

### Untouched

- `Header.astro`, `RegisterServiceWorker.astro`, `WeatherWidget.tsx`, `BookingChecklist.tsx`, `customize/*`, `ShareLinkButton.tsx`, `CustomizedPill.tsx`, `DriveLegs.astro`
- All hike, restaurant, booking, trip YAML/MD files
- `/checklist`, `/restaurants`, `/contingencies`, `/photos`, `/customize`, `/hikes`, `/custom-day`, `/more` (Garda extension reorg already shipped)

---

## 4. Implementation Order

### Phase 1 — Foundation (data + reusable components)

- Extend `migrate-itinerary.mjs` with `emitGardaDayStubs()`; run migration; verify 7 new files in `src/content/days/`
- Build `MapRibbon.astro` (props + internal layout + sepia filter + expand control)
- Build `Breadcrumb.astro`
- Bump SW cache `v3` → `v4`

### Phase 2 — Map embed everywhere

- Add `<MapRibbon>` to `/day/[date]`, `/hike/[slug]`, `/activities/[slug]`
- Extend `/map.astro` + `MapView.tsx` for `?day=` and `?focus=` query params
- Wire each ribbon's expand control to the right `/map?...` href
- Verify each ribbon stays under the View Transitions transition envelope (no jank on swap)

### Phase 3 — Lodging detail pages + nav consistency

- Rename `src/pages/lodgings.astro` → `src/pages/lodgings/index.astro`
- Build `src/pages/lodgings/[slug].astro` with map ribbon + full lodging info
- Update map page lodging pins to link to `/lodgings/<slug>` instead of `/lodgings`
- Extend `BottomNav.astro` active-state matching
- Add `<Breadcrumb>` to `/activities/[slug]`

### Phase 4 — Phase-aware home + related activities

- Rebuild home page sections per the medium-phase-awareness rules (adaptive countdown, Phase II free-day banner, ring auto-collapse, section ordering swap)
- Build `RelatedActivities.astro` (haversine + sort + top-3 row); mount on `/activities/[slug]`
- Garda free-form day pages get the "Pick today's activities" CTA where `hikeSlugs.length === 0 && date >= phaseBoundary`
- Cross-link `/day/[date]` → `/contingencies` when `badWeatherOption` is set

### Phase 5 — Polish & deploy

- DayPillScroller auto-scrolls active pill into view (mount + after-swap)
- BaseLayout adds `astro:after-swap` focus-restoration to `#main` (with `tabindex="-1"` on the main element)
- Full clean build + smoke each route + Lighthouse on `/activities` and one new `/lodgings/[slug]` (target ≥ 95)
- Push to main → Cloudflare auto-deploys

---

## Out of scope

- New content (no new hikes / activities / restaurants)
- Restaurant or parking content for Garda (still excluded per Garda extension spec)
- AirBnB-side changes (Salò address & URL already filled in 2026-05-02)
- Visual redesign — vintage poster aesthetic preserved as-is
- Multi-language / i18n
- Authentication / multi-user features (customize panel stays localStorage)
- Server-side state — site remains static + service-worker offline-first

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Map ribbon × 4 maplibre instances per detail page balloons JS | `client:visible` directive defers ribbon hydration until scrolled into view; each ribbon is small (one tile zoom) |
| `?focus=<slug>` collides with existing pin labels | Prefix all focus values with type (`hike-`, `activity-`, `lodging-`) — already in §2 |
| Garda day stubs without scheduled activities feel empty | "Pick today's activities" CTA + 4-card quick row in Today banner address this — empty days are a feature, not a bug |
| Section reordering on home page during Phase II disorients returning users | Section labels (PARTE I / PARTE II) make ordering self-explanatory; both sections always present, just reordered |
| Adding `tabindex="-1"` to `#main` could affect existing focus order | `-1` only allows programmatic focus; doesn't appear in tab order |
