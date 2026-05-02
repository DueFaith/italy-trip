# Test Coverage Pass — Design Spec

**Date:** 2026-05-02
**Status:** Approved
**Goal:** Bring the test suite up to date with everything shipped in the Garda extension, nav/usability pass, post-deploy fixes, header wordmark, and map-link rewrites. Three layers: pure-logic unit tests, an integrity audit that walks the built `dist/`, and a refreshed Playwright e2e spec covering the customize/edit flow.

---

## Background

The repo already has vitest + Playwright wired (`npm test`, `npm run test:e2e`). 5 unit-test files + 1 e2e smoke spec exist. Several assertions in the e2e spec have gone **stale** — they assert the bottom-nav contains "Checklist" (replaced by Activities) and that the schedule lives on hike pages (we moved it back to day pages). Multiple new components and routes shipped without coverage: `tile-math`, `category-labels`, `RelatedActivities`, lodging detail pages, Garda day stubs, phase-aware home, header wordmark, /map query-param filtering.

A post-deploy review surfaced 30 issues including a real bug class — internal links pointing to wrong routes (day → `/lodgings` instead of `/lodgings/[slug]`) — that an integrity audit catches on every build, prevents recurrence forever.

---

## 1. Architecture & test categories

Three independent layers under `tests/`. Each runs without the others; failures isolate cleanly.

```
tests/
├── unit/         (vitest — pure logic, no DOM, no network)
├── integrity/    (vitest — runs against built dist/, no network, no DOM)
└── e2e/          (Playwright — runs against `npm run dev`, real browser)
```

**Wiring (`package.json` scripts):**
- `npm test` → `vitest run` (unit + integrity in one pass; integrity tests build dist/ on-demand if missing via a small `globalSetup`)
- `npm run test:e2e` → `playwright test` (existing)
- `npm run test:all` → `npm run build && npm test && npm run test:e2e` (sequential, one shot)

**Dependencies (dev-only):** add `cheerio` (~80 KB) for HTML parsing in integrity tests. Nothing else.

---

## 2. Unit tests

### Existing files — refresh

**`tests/unit/schemas.test.ts`** — add ActivitySchema:
- Import `ActivitySchema` (currently missing) from `@/content/config`
- 3 valid cases: featured + non-featured + with `bookingNote` + `url` set
- 3 invalid cases: missing required `name`, invalid `category` enum value, malformed `url`

**`tests/unit/migration.test.mjs`** — add Garda-day-stub + activities coverage. Requires a small refactor of `scripts/migrate-itinerary.mjs`: split each `emit*()` function into a `build*()` that returns the array of `{ relPath, content }` records, and a thin `emit*()` wrapper that writes them. Tests then assert on the pure data:
- `buildGardaDayStubs()` returns 7 records with paths `src/content/days/2026-07-2{1..7}-*.md`
- Day 27's record content contains the literal flight time `19:10` (derived from `trip.flights.return[0].depart`, single source of truth with `emitTrip`)
- `buildActivities()` returns 22 records with unique slugs
- Idempotency is now a property of `emitGardaDayStubs` only (the `fs.existsSync` skip lives there); test that it skips when target exists by stubbing `fs.existsSync` via vitest's `vi.spyOn`

### New files

**`tests/unit/tile-math.test.ts`** — projection math
- `lonToTileX(12.0, 10)`, `latToTileY(46.5, 10)` return Mercator-correct integers
- `buildRibbonSpec([])` returns `null`
- Single pin → `zoom === 13`, single tile, `projected[0].edge === null`, `fx === fy === 0.5`
- Tre Cime + Baita Fraina → at z=10 (lowest), one pin's `edge === 'bottom'` (overflow)
- Bbox-centre vs mean check: pins (1,1), (1,1), (3,3) — centre is (2,2) bbox-centre, NOT (1.67,1.67) mean
- Cross-region pins (Salò + VCE) bottom out at `MIN_ZOOM === 10` with both as edge markers

**`tests/unit/category-labels.test.ts`** — enum exhaustiveness
- Every key in `CATEGORY_LABELS` is a valid `ActivityCategory` (using the union type at compile time + runtime check)
- Every actual `category` value across the 22 activities has a label entry — guards against adding a new activity with a category we forgot to label
- Spot-check: `'culture-history'` → `'Culture & History'`; `'water-sports'` → `'Water Sports'` (humans, not slug-cased)

**`tests/unit/related-activities.test.ts`** — `sharedSlugPrefix` filter rule
Extract the helper from `RelatedActivities.astro` to a small utility (`src/lib/related.ts`) so it's testable in isolation. Then:
- `sharedSlugPrefix('garda-rent-boat-jetski', 'garda-rent-boat-rental')` → 3 (filter excludes — same business)
- `sharedSlugPrefix('sirmione-grotte-di-catullo', 'sirmione-scaligero-castle')` → 1 (filter includes — same town)
- `sharedSlugPrefix('a', 'b')` → 0
- Identical slugs return their token count

**`tests/unit/haversine.test.ts`** — extract + test
Refactor: move the inline `haversineKm` from `src/pages/index.astro`, `src/components/RelatedActivities.astro`, `src/pages/day/[date].astro` into a single `src/lib/geo.ts`. Three import sites change. Then:
- Salò → Sirmione (~25 km) ±1 km
- Salò → Verona (~52 km) ±2 km
- Same point → 0
- Symmetry: `haversine(A,B) === haversine(B,A)`
- Antipodal sanity (Salò → 45.6,−170): within 100 km of π × 6371 km

**`tests/unit/phase-boundary.test.ts`** — trip.phases derivation
- With `trip.yaml` as-is (phases array present): `phaseBoundary === '2026-07-20'`
- With `phases` stripped from a synthetic trip object: boundary falls back to `endDate`
- `inPhaseII` truth table: `'2026-07-19'` → false; `'2026-07-20'` → true; `'2026-07-26'` → true; `'2026-08-01'` → true

The boundary derivation is currently duplicated in `index.astro` and `day/[date].astro`. As part of this work, extract to `src/lib/phase.ts`:

```ts
export function phaseBoundary(trip: ReturnType<typeof getTrip>): string {
  return trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
}
export function isInPhaseII(trip: ReturnType<typeof getTrip>, todayISO: string): boolean {
  return todayISO >= phaseBoundary(trip);
}
```

Both consumers import from there.

### Total
- Existing 27 → ~35 (after refresh)
- New: ~28 across 5 files
- Grand total ~63 unit assertions, runtime ~200ms

---

## 3. Integrity audit (`tests/integrity/links.test.ts`)

One file. Runs as a vitest test with a `beforeAll` that ensures `dist/` exists (calls `astro build` if missing — set timeout 60s). Uses `cheerio` to parse HTML.

Each invariant is its own `describe` block so failures show which class broke.

### 3.1 Internal-link resolution
For every `<a href="/...">` across every `dist/**/*.html`, assert the link resolves:
- `/` → `dist/index.html`
- `/foo` → `dist/foo/index.html`
- `/foo/bar` → `dist/foo/bar/index.html`

Excludes: `#fragment-only`, `tel:`, `mailto:`, `http(s):`. Failure message: `<source-page> links to <broken-target>`.

### 3.2 Bottom-nav consistency
Every built page contains exactly 4 nav items with hrefs `/`, `/map`, `/activities`, `/more` (in that order). At most one has `aria-current="page"`. Active state matches the rule table from §1 of the nav-pass spec (Home for `/hike/*`/`/day/*`, Map for `/map`, Activities for `/activities/*`, More for `/checklist`/`/restaurants`/`/contingencies`/`/lodgings*`/`/photos`/`/customize`).

### 3.3 Header wordmark
Spot-check 8 representative pages:

| Path | Expected wordmark |
|---|---|
| `/` | `DOLOMITES + GARDA` |
| `/day/2026-07-17` | `DOLOMITES` |
| `/day/2026-07-22` | `LAGO DI GARDA` |
| `/hike/tre-cime` | `DOLOMITES` |
| `/activities` | `LAGO DI GARDA` |
| `/lodgings/salo-airbnb` | `LAGO DI GARDA` |
| `/lodgings/baita-fraina` | `DOLOMITES` |
| `/map` | `MAP` |

### 3.4 Map-link format
- Every `https://www.google.com/maps...` includes `?api=1&query=` followed by URL-encoded text matching `/[A-Za-z]/` (i.e. contains at least one letter — catches regressions to coord-only `?q=lat,lon`)
- Every `https://maps.apple.com...` has a `q=` parameter whose decoded value matches `/[A-Za-z]/`

### 3.5 Activity-card destinations
- Every `<a href="/activities/...">` ends with a slug present in `src/content/activities/`
- The grid on `/activities` has `data-activity-card` count equal to the activity-collection size
- Each card's `data-category` matches the entry's category in YAML

### 3.6 Day record consistency
For every day in `src/content/days/`:
- `lodgingSlug` references a real `src/content/lodgings/<slug>.yaml`
- Every entry in `hikeSlugs[]` references a real `src/content/hikes/<slug>.md`
- Total day count is exactly 13

### 3.7 Service-worker cache key
`dist/sw.js` first non-empty line includes a `dolomites-v` followed by a digit. Catches accidental rollbacks.

### 3.8 Image alt-text
On detail-page routes (`/hike/`, `/day/`, `/activities/`, `/lodgings/`), every `<img>` element has an `alt` attribute (empty `alt=""` is fine for decorative — that's a11y best practice for the map ribbons).

### 3.9 Schedule on day pages
For every day in `src/content/days/` whose `schedule` array is non-empty (Phase I days), the corresponding built page contains a `<h2>` whose text includes `Schedule` and an `<ol>` with at least one `<li>` containing an `HH:MM` time pattern. Catches the "schedule data exists but isn't rendered" regression.

### 3.10 Map ribbon presence
Every detail-page route (`/hike/[slug]`, `/day/[date]`, `/activities/[slug]`, `/lodgings/[slug]`) has exactly one `<div class="map-ribbon">` element, and that element contains an `<img>` with an OSM tile URL.

### Coverage summary
~10 invariants, ~150 individual assertions across the 56 built pages. Runtime under 1s after `dist/` exists.

---

## 4. E2E smoke (`tests/e2e/smoke.spec.ts`)

Refresh existing 11 tests + add ~20 new. Single file (matches existing convention). All run against `npm run dev`.

### 4.1 Refresh existing tests

Mostly small edits — keep the test names, fix the assertions:

| Existing test | Update |
|---|---|
| `bottom nav has 4 items` | Replace `Checklist` with `Activities` in expected list |
| `day page renders hikes and driving (schedule lives on hike page now)` | Rename to `day page renders schedule, hikes, and driving` and assert schedule IS visible |
| `hike page renders stats` | Keep |
| `map page mounts` | Keep |
| `checklist renders bookings grouped by category` | Keep, but expect 11 items not "any number" |
| `customize page renders` | Keep |
| `persistent day-pill scroller appears on day and hike pages` | Keep |
| `day-pill scroller is absent from home page` | Keep |
| `hike page prev/next walks trip order across day boundaries` | Keep |
| `today banner is absent outside trip dates (May 2026)` | Keep |
| `home page renders core elements` | Update — assert "Days Until Departure" wording, not generic "Days to go" |

### 4.2 New navigation / render tests (~12)

- `/activities` renders 22 cards, 4 featured cards, 10 filter pills
- Filter-pill click: tap "Water Sports" → catalog grid only shows water-sports cards, URL updates to `?category=water-sports`, "More" heading toggles to "All matching"
- `/activities/solferino-red-cross-memorial` renders breadcrumb (`Activities / Culture & History`), ribbon, stat block, nearby rail with 3 cards, back link
- `/lodgings/baita-fraina` renders ribbon, address, 4 contact buttons (phone, booking, Apple Maps, Google Maps), back link
- `/lodgings` renders 3 cards in chronological order (Baita Fraina → Pension Kircher Sepp → Salò AirBnB)
- Day pill scroller on `/day/2026-07-22` contains a `.day-pill-phase-divider` element between Jul 19 pill and Jul 20 pill
- Day-pill auto-scroll: visit `/day/2026-07-25`, assert the active pill is in viewport (`bbox.left >= scrollerBbox.left && bbox.right <= scrollerBbox.right`)
- Header wordmark spot-check across 4 pages (matches §3.3 list, viewed via DOM)
- Bottom-nav active state on `/hike/tre-cime` highlights Home; on `/lodgings/baita-fraina` highlights More
- `/map?focus=hike-tre-cime` opens the popup automatically (selector: `.maplibregl-popup` visible after page load + 500ms settle)
- Phase II free-day banner on `/day/2026-07-22`: assert text "Today · Free at Salò" and at least 1 of the 4 nearest-activity cards is visible
- Schedule renders on `/day/2026-07-17` with at least 5 `<li>` rows and times formatted as `HH:MM`

### 4.3 Customize / edit flow tests (8)

- `/customize` renders: "How To Customize" banner is **visible** (no edits yet on a fresh playwright session — localStorage starts empty); Hikes section lists 6; Days section lists 13
- "+ New" Hike button opens `<HikeForm>`; the form has a Save button which is disabled when required fields are empty; filling the required fields enables Save; clicking Save adds the hike to the Hikes list and the section count increments to 7
- "+ New" Day button opens the inline date+theme form; Save adds a new entry to the Days list
- Custom hike entries render a "Delete" button that removes them from the list when clicked; canonical hikes do not have a Delete button
- After the first edit, the header `CustomizedPill` island becomes visible (selector by aria-label or distinctive class)
- Share-link button (assuming present in `/customize`): clicking generates a URL containing `?s=...` parameter; the encoded payload deserialises back to the current state via `decodeState` (assert via `page.evaluate`)

**Note on drag-drop:** Playwright's `dragAndDrop` doesn't reliably trigger `@dnd-kit`'s pointer-event listeners on chrome-headless. We assert the **affordance** in the DOM (chip has `cursor-grab` class and a `⋮⋮` grip glyph) and rely on the unit-test coverage of `state.moveHikeToDay` for the actual state transition. This trades 2 hours of flaky-test debugging for equivalent confidence.

### 4.4 Total
- Refreshed 11 + new 20 = ~31 e2e tests
- Runtime: ~30-60s against dev server

---

## 5. Out of scope

- **Visual regression testing** (Percy/Chromatic). The vintage-poster aesthetic is stable enough; visual diffs would catch every minor padding tweak and bury real signal.
- **Lighthouse CI**. Performance is monitored manually post-deploy; no need to gate every commit.
- **Cross-browser e2e**. Chromium-only matches the existing playwright.config.ts. Mobile Safari testing happens manually on the actual phone.
- **Network mocking** for the OSM tile server. The map ribbon uses a static `<img>` and the integrity test only checks the URL pattern, not that the tile loads.
- **Accessibility-tree assertions** (axe-core). `aria-label` and `aria-current` are spot-checked in integrity §3.2 + 3.8; deeper a11y testing is a separate effort.
- **API testing**. The site has no backend.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cheerio parsing differs from real browser | Cheerio is HTML-spec-compliant for static analysis; for the 10 invariants we assert (link resolution, attribute presence, text content), browser parity isn't a concern |
| Integrity tests run against stale `dist/` | `globalSetup` checks for `dist/index.html` mtime older than 1 min and rebuilds; alternatively `npm run test:all` always builds first |
| Playwright drag-drop flakiness | Spec'd around — we test affordance + state actions, not the gesture |
| LocalStorage state pollutes between e2e tests | Playwright's default `storageState` is per-context; new context per test → empty localStorage. Add explicit `await page.context().clearCookies()` + `await page.evaluate(() => localStorage.clear())` in `beforeEach` for safety |
| Existing tests fail-on-extract | The haversine + phase-boundary refactors touch existing `index.astro` and `day/[date].astro`. Build+rerun unit tests after each refactor in the implementation plan |
| Future activity additions break category-labels exhaustiveness | That's the point — it's a guard, not a brittle test |

## 7. Implementation order

5 phases for the implementation plan to follow. Each phase ships a working subset.

1. **Phase 1 — Refactors** (extract `haversine` and `phase` helpers; update 3+2 import sites). Existing 27 unit tests still pass after.
2. **Phase 2 — Unit additions** (5 new files + refresh schemas + migration). Runtime budget ≤ 200ms.
3. **Phase 3 — Integrity audit** (`tests/integrity/links.test.ts` + cheerio dep + globalSetup hook).
4. **Phase 4 — E2E refresh + new** (`smoke.spec.ts` rewritten with all 31 tests). Verify against local dev.
5. **Phase 5 — Wiring + docs** (add `npm run test:all` script in `package.json`; add a short `tests/README.md` documenting the three tiers and how to run each; ensure all three tiers exit non-zero on failure for CI).
