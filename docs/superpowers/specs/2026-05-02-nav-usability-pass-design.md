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

| Path (matched against `Astro.url.pathname`, not `.search`) | Highlights tab |
|---|---|
| `/`, `/hike/*`, `/day/*` | Home |
| `/map` | Map (query strings like `?day=...` already match because `pathname` strips them) |
| `/activities`, `/activities/*` | Activities |
| `/more`, `/checklist`, `/restaurants`, `/contingencies`, `/lodgings`, `/lodgings/*`, `/photos`, `/customize` | More |

Implementation: replace `BottomNav.astro`'s single `path.startsWith(it.href + '/')` test with a per-tab matcher function.

### Header — unchanged

Logo → `/`, gear → `/customize`, customize-pill island as today.

### Map ribbon — new ubiquitous element

A new `MapRibbon.astro` component, ~80px tall, sepia-toned to match the existing map page filter (`sepia(0.35) saturate(0.85) hue-rotate(-10deg) contrast(0.95) brightness(1.02)`), rendered inline at the top of every detail page.

**Hydration posture: fully static (no MapLibre on detail pages).** The ribbon renders a single `<img>` raster tile, with absolutely-positioned `<span>` pins overlaid. Roughly 5–10 KB per ribbon vs ~120 KB+ for an idle MapLibre instance. The ribbon is non-interactive: pan/zoom/popup are not supported — the "⤢ Full map" control is the entry point to the interactive map. This decision favours fast paint on marginal 4G in the Dolomites over in-place interactivity.

**Tile provider.** Ribbons use the same tile source as `MapView.tsx` to avoid visual divergence between detail-page ribbons and the full `/map`. Currently `MapView.tsx` uses raw OSM (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`); ribbons use the same URL pattern. Rationale: matching providers means the same tile cache works for both, and any future move to a keyed provider (MapTiler, Stadia, Cloudflare-cached proxy) lands in one place. Per OSM tile-usage policy, this volume (~one tile per detail-page view) sits well within personal-use bounds; if the site is ever publicly shared, switch both `MapView.tsx` and `MapRibbon.astro` to a keyed provider in the same change.

**Pin projection math.** Tile center comes from the bounding-box centre of the pin set (NOT the mean — bounding-box centre handles asymmetric spreads correctly). Zoom is selected as `Math.floor(Math.log2(360 / Math.max(latSpread, lonSpread)) - 1)` clamped to `[10, 13]`. If any pin would project outside the rendered tile rectangle after Web-Mercator projection, decrement zoom and retry; bottom out at zoom 10 and clip overflowing pins to edge markers (small triangle on the nearest edge instead of a circle). Single-pin ribbons use zoom 13 directly with the pin centred.

**Layering.** Tile `<img>` (z-index 0) carries the sepia filter; pin `<span>` overlays (z-index 1) are unfiltered so colour-coded categories (forest green for trailheads, red for lodging, gold for activities) remain legible. Caption pill and "⤢ Full map" control are z-index 2.

**View Transitions.** Ribbon root AND all descendants opt out via `.map-ribbon, .map-ribbon * { view-transition-name: none }` — without the descendant rule, child elements may inherit auto-named transitions from Astro's ClientRouter and animate independently of their parent.

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

**`phaseBoundary` is derived, not hardcoded.** Computed in the home-page frontmatter as `trip.phases?.find(p => p.id === 'garda')?.start ?? trip.endDate`. The fallback to `trip.endDate` means if `phases` is ever removed from `trip.yaml`, the boundary collapses to "after the trip ends" — safe degradation. `/customize` continues to be unable to shift trip dates (see Out of scope).

Four behaviour changes driven by date:

1. **Adaptive countdown copy.** The big number means different things by phase:
   - `today < startDate` → "X" + label "Days Until Departure" (current)
   - `startDate ≤ today ≤ endDate` → "X" + label "of N" (e.g. "07 of 13", where N = day count from `trip.startDate`/`endDate`)
   - `today > endDate` → "X" + label "Days Since"

2. **Today banner adapts to phase.**
   - Phase I day with hikes → today's first hike (current behaviour, `/hike/<slug>` href)
   - Phase II day (no hikeSlugs) → "Today: free at Salò" + a horizontal quick-row of 4 nearest activities. **Anchor**: haversine distance from `lodgings.find(l => l.data.slug === 'salo-airbnb').data.{lat, lon}` (NOT the `weatherFor` coordinates — the AirBnB and the lake bay coordinates may diverge).
   - Outside trip dates → banner hidden (current behaviour)

3. **Booking ring auto-collapses.** Two collapse triggers, OR'd:
   - `bookedCount === totalBookings` (everything booked), OR
   - `today >= phaseBoundary` (Phase II started — even if some non-critical bookings remain pending)

   Collapsed render: a small (~40 px) green-check badge with the `n/m` ratio underneath, linking to `/checklist`. Rationale: the ring's job is pre-trip booking pressure; once Phase II begins, that pressure is moot — outstanding bookings (e.g. an unconfirmed restaurant reservation) belong on the checklist itself, not the home hero.

4. **Section ordering swaps by phase.** Phase I default order: Hero → Today banner → Countdown → PARTE I → All Hikes → Booking Ring → PARTE II → Salò card → Activities CTA → Itinerary. Phase II reorders to: Hero → Today banner → Countdown → PARTE II → Salò card → Activities CTA → Booking Ring (collapsed) → **Past phase summary card** → Itinerary. The Past phase summary card replaces the full PARTE I + 6-poster grid: a single `.hike-poster`-styled card with the eyebrow "Past phase · Dolomites", title "6 hikes · Jul 15–20", a 3-stat strip (`{distanceKm sum} km · {elevationGainM sum} m · {nightsInDolomites} nights`), and a chevron link to `/hikes` for the full grid.

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
| `?focus=hike-<slug>` | Centre on that pin at zoom 14 with 80 px padding (`map.flyTo({ center, zoom: 14, padding: 80 })`); auto-open its popup |
| `?focus=activity-<slug>` | Same |
| `?focus=lodging-<slug>` | Same |
| (no param) | Current global behaviour unchanged |

**Precedence when both `day` and `focus` are present**: `focus` wins; `day` is ignored. Rationale: a focus is a more specific intent than a day filter.

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
| `src/components/MapRibbon.astro` | 80px sepia map. Props: `pins: Pin[]`, `expandHref: string`. **Static — no JS, no MapLibre.** Renders an `<img>` raster tile (provider matches `MapView.tsx`; currently OSM) plus absolutely-positioned `<span>` pins overlaid in the same colour scheme as MapView. Bounding-box centre for tile centre; zoom = `floor(log2(360 / max(latSpread, lonSpread)) − 1)` clamped to `[10, 13]`; edge-marker fallback if a pin overflows the tile rectangle at the lowest zoom. Sepia filter on tile only (z-index 0); pins unfiltered (z-index 1); caption + expand control z-index 2. `view-transition-name: none` on `.map-ribbon` AND descendants so children don't inherit auto-named transitions from ClientRouter. |
| `src/components/Breadcrumb.astro` | Mono-cap breadcrumb. Props: `crumbs: { label: string, href?: string }[]`. Last crumb has no link. |
| `src/components/RelatedActivities.astro` | Horizontal scroll-snap row of up-to-3 activity cards. Props: `current: CollectionEntry<'activities'>`. Computes haversine internally; **excludes activities lacking `location.lat`/`lon`** (logs a build-time `console.warn` if any are excluded — surfaces data-quality issues without failing the build). Edge cases: render whatever count is available (1, 2, or 3); if 0 candidates exist after exclusion, the entire section (heading + rail) does not render. Container uses `scroll-snap-type: x mandatory`; each card uses `scroll-snap-align: start` + `scroll-snap-stop: always` (prevents accidental two-card swipe past on mobile). |
| `src/pages/lodgings/index.astro` | Renamed from `lodgings.astro`. Grid of lodging cards, each linking to `/lodgings/<slug>`. |
| `src/pages/lodgings/[slug].astro` | Detail page: map ribbon, address, host, nights/dates, booking link, notes. Mirrors the `/activities/[slug]` rhythm. |

### Modified files

| Path | Change |
|---|---|
| `src/components/BottomNav.astro` | Per-tab active-state matcher per §1 rule table. Each match rule is explicit: e.g. More matches `path === '/lodgings' \|\| path.startsWith('/lodgings/')` (not a glob), preventing accidental matches against e.g. `/lodgings-guide`. |
| `src/components/DayPillScroller.astro` | After mount AND after `astro:after-swap`, **only re-centre the active pill if it is not currently visible inside the scroller's viewport** (compare `pill.getBoundingClientRect()` against `scroller.getBoundingClientRect()`). If the user has manually scrolled to peek at a future day, that scroll position is preserved across navigation. |
| `src/layouts/BaseLayout.astro` | Add `astro:after-swap` listener that calls `document.getElementById('main')?.focus()` (with `tabindex="-1"` on `#main` for programmatic focus). |
| `src/pages/index.astro` | Medium phase awareness — adaptive countdown copy, Phase II free-day banner with quick-row, ring auto-collapse, section ordering swap based on `inPhaseII`. **Decompose, don't inline-stack.** Extract sections into focused components (`Countdown.astro`, `TodayBanner.astro`, `BookingRingOrBadge.astro`, `PastPhaseSummary.astro`); `index.astro` becomes a composition of them per phase. Without this nudge, the file balloons past 600 lines and becomes hard to reason about. The Hero section can stay inline. |
| `src/pages/day/[date].astro` | `<MapRibbon>` at top after day pills. For Garda free-form days (`hikeSlugs.length === 0 && date >= phaseBoundary`), schedule section becomes a "Pick today's activities" CTA. Cross-link to `/contingencies` if `badWeatherOption` is set. |
| `src/pages/hike/[slug].astro` | `<MapRibbon>` at top with single trailhead pin. |
| `src/pages/activities/[slug].astro` | `<MapRibbon>` at top, `<Breadcrumb>` above hero (`Activities · {CATEGORY_LABELS[a.category]}`), `<RelatedActivities current={activity} />` above the back-to-catalog link. |
| `src/lib/category-labels.ts` *(new — small enough to inline here)* | `export const CATEGORY_LABELS: Record<ActivityCategory, string> = { 'water-sports': 'Water Sports', 'culture-history': 'Culture & History', 'mountain-cable-car': 'Mountain & Cable Car', 'scenic': 'Scenic', 'bike': 'Bike', 'wine': 'Wine', 'day-trip': 'Day Trip', 'aquatic-park': 'Aquatic Park', 'hiking': 'Hiking' } as const;`. Imported by Breadcrumb consumers + the catalog filter pills (replaces today's ad-hoc capitalisation). |
| `src/pages/map.astro` + `src/components/MapView.tsx` | Read `?day=` and `?focus=` query params. Filter / fit / open-popup as per §2. Existing global behaviour unchanged when no params. |
| `scripts/migrate-itinerary.mjs` | New `emitGardaDayStubs()` function — emits 7 day `.md` files for Jul 21-27. **Idempotency: skip emit if the target file already exists** (so a hand-edited `2026-07-22.md` survives a re-run). Day 27's airport drive-leg note derives departure time from the same hardcoded `trip.flights.return[0].depart` string used in `emitTrip()` — single source of truth. Wired into `runMigration()` after `for (const d of days) emitDay(d)`. |
| `public/sw.js` | Bump cache key `dolomites-v3` → `dolomites-v4`. **Activation strategy**: ensure `self.skipWaiting()` is called in the `install` handler and `self.clients.claim()` in the `activate` handler. Without these, users on a stale tab keep the v3 cache (no Garda day stubs, broken Phase II) until they fully close the PWA. With the day-stub data being new, this is a hard requirement, not a nice-to-have. |

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
- Extend `/map.astro` + `MapView.tsx` for `?day=` and `?focus=` query params (precedence: focus wins)
- Wire each ribbon's expand control to the right `/map?...` href
- Confirm ribbons paint without flicker on View Transitions (they opt out via `view-transition-name: none` per §1)

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
- Full clean build + smoke each route + Lighthouse on `/activities`, one new `/lodgings/[slug]`, one `/day/[date]`, and one `/hike/[slug]` — all carry the new static map-ribbon load; target ≥ 95 on all four. **`/map` is excluded from the ≥ 95 target** because MapLibre + raster tiles unavoidably hit performance — tracked separately if it falls below 80
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
- **Trip-date editing via /customize** — `/customize` does not shift `trip.startDate` / `trip.endDate` / `phases`, so deriving `phaseBoundary` from `trip.yaml` at build time is safe. If date editing is added later, the derivation in §1 still works (phases come from trip data); no spec rewrite needed

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Map ribbon JS bloat on slow connections | Ribbons are fully static (`<img>` tile + overlaid `<span>` pins); no MapLibre on detail pages — see §1 hydration posture |
| `?focus=<slug>` collides with existing pin labels | Prefix all focus values with type (`hike-`, `activity-`, `lodging-`) — already in §2 |
| Garda day stubs without scheduled activities feel empty | "Pick today's activities" CTA + 4-card quick row in Today banner address this — empty days are a feature, not a bug |
| Section reordering on home page during Phase II disorients returning users | Section labels (PARTE I / PARTE II) make ordering self-explanatory; both phases remain represented (PARTE I appears as a Past phase summary card linking to `/hikes` for the full grid) |
| Adding `tabindex="-1"` to `#main` could affect existing focus order | `-1` only allows programmatic focus; doesn't appear in tab order |
| OSM tile-server traffic from static ribbons | Each detail page hits one tile (already widely cached); user agents respect HTTP cache headers — no measurable load. If volume ever becomes a concern, switch to a Cloudflare-cached tile proxy |
| Day-pill auto-scroll yanks user's scroll on swap | Visibility check (§3) — only re-centre if active pill is off-screen, preserving manual scroll otherwise |
| Stale v3 service worker leaves users with broken Phase II | `skipWaiting()` + `clients.claim()` in v4 SW (§3) — first reload of any tab activates v4 immediately |
| Activities missing `location.lat`/`lon` break RelatedActivities | Excluded from haversine calc with build-time warning (§3); current 22 entries all have GPS so this is defensive |
| Tile-server load if site goes public | OSM is fine for personal use; `MapRibbon` and `MapView` share one tile-source constant so swapping to MapTiler/Stadia/Cloudflare-cached proxy is a single-file change. Track as a follow-up to revisit before any public sharing |
| `index.astro` becomes monolithic after Phase 4 | Spec §3 mandates extracting `Countdown.astro`, `TodayBanner.astro`, `BookingRingOrBadge.astro`, `PastPhaseSummary.astro` — index.astro composes per phase rather than inlining 200 more lines |
