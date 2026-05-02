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
Refactor: move the inline `haversineKm` into a single `src/lib/geo.ts`. **Confirmed via grep** — exactly 3 sites duplicate the function body:
- `src/pages/index.astro` (line 42)
- `src/components/RelatedActivities.astro` (line 8)
- `src/pages/day/[date].astro` (line 39)

All 3 import from `@/lib/geo` after the refactor. Then test:
- Salò → Sirmione (~25 km) ±1 km
- Salò → Verona (~52 km) ±2 km
- Same point → 0
- Symmetry: `haversine(A,B) === haversine(B,A)`
- Antipodal sanity (Salò → 45.6,−170): within 100 km of π × 6371 km

**`tests/unit/phase-boundary.test.ts`** — trip.phases derivation
- With `trip.yaml` as-is (phases array present): `phaseBoundary === '2026-07-20'`
- With `phases` stripped from a synthetic trip object: boundary falls back to `endDate`
- `inPhaseII` truth table: `'2026-07-19'` → false; `'2026-07-20'` → true; `'2026-07-26'` → true; `'2026-08-01'` → true

The boundary derivation has drifted across **4 sites** (confirmed via grep) — the spec previously named only 2:

1. `src/pages/index.astro:22` — full `trip.phases?.find(...)` pattern
2. `src/pages/day/[date].astro:32` — full pattern
3. `src/components/DayPillScroller.astro:18` — full pattern
4. `src/components/MapView.tsx:48` — **hardcoded `'2026-07-20'` literal** (`dayDateProp < '2026-07-20'`). This is a real drift bug — if `trip.yaml` ever shifts the Garda phase start, MapView won't notice.

Extract to `src/lib/phase.ts`:

```ts
import type { TripData } from '@/lib/content';  // or inline the relevant type
export function phaseBoundary(trip: TripData): string {
  return trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
}
export function isInPhaseII(trip: TripData, todayISO: string): boolean {
  return todayISO >= phaseBoundary(trip);
}
```

All 4 consumers import from there. MapView.tsx is a React island so it receives the boundary as a prop from `map.astro` (which can call `phaseBoundary(getTrip())` at SSR time). Verify the fix with: `grep -rn "2026-07-20\|trip.phases?.find" src/` → only matches in `src/lib/phase.ts` plus tests.

### Total
- Existing 27 → ~35 (after refresh)
- New: ~28 across 5 files
- Grand total ~63 unit assertions, runtime ~200ms

---

## 3. Integrity audit (`tests/integrity/links.test.ts`)

One file. Runs as a vitest test with a `beforeAll` that ensures `dist/` exists (calls `astro build` if missing — set timeout 60s). Uses `cheerio` to parse HTML.

Each invariant is its own `describe` block so failures show which class broke.

### 3.1 Internal-link resolution
For every `<a href="/...">` across every `dist/**/*.html`, **strip query string and fragment first** (so `/map?day=2026-07-16` and `/checklist#parking` both resolve to their underlying route), then assert the link resolves:
- `/` → `dist/index.html`
- `/foo` → `dist/foo/index.html`
- `/foo/bar` → `dist/foo/bar/index.html`

Excludes: `#fragment-only` (no path), `tel:`, `mailto:`, `http(s):`. Failure message: `<source-page> links to <broken-target>`.

```ts
// helper inside the test
function resolveTo(href: string): string {
  const path = href.split('?')[0].split('#')[0];
  return path;
}
```

### 3.2 Bottom-nav consistency
Every built page contains exactly 4 nav items with hrefs `/`, `/map`, `/activities`, `/more` (in that order). At most one has `aria-current="page"`. Active state matches the rule table from §1 of the nav-pass spec (Home for `/hike/*`/`/day/*`, Map for `/map`, Activities for `/activities/*`, More for `/checklist`/`/restaurants`/`/contingencies`/`/lodgings*`/`/photos`/`/customize`).

### 3.3 Header wordmark — property check, not hardcoded list

Refactor (folded into Phase 1): extract the wordmark logic from `src/layouts/BaseLayout.astro` into `src/lib/wordmark.ts`. The helper accepts a richer context so detail pages can use it too:

```ts
// src/lib/wordmark.ts
type WordmarkContext = {
  pathname: string;
  // Optional content context for detail pages:
  dayLodgingSlug?: string;  // /day/[date] — pass day.data.lodgingSlug
  lodgingId?: string;       // /lodgings/[slug] — pass lodging.id
  // /hike/[slug] always returns 'Dolomites' (every hike is in the Dolomites)
};
export function getWordmark(ctx: WordmarkContext): string { /* ... */ }
```

`BaseLayout.astro` calls `getWordmark({ pathname: Astro.url.pathname })`. Detail pages (day, hike, lodging) pass `headerTitle={getWordmark({ pathname, dayLodgingSlug: ... })}` — no more inline `lodging.id === 'salo-airbnb' ? ... : ...` ternaries.

The integrity test then asserts a **property** for every `dist/**/*.html`:

> The rendered wordmark in the header equals `getWordmark({ pathname, ...detailContext })` where `detailContext` is read from the corresponding content collection (day frontmatter for `/day/*`, lodging YAML for `/lodgings/<slug>`, etc.).

This scales automatically as routes are added; no hardcoded path → wordmark table to maintain.

Spot-check sanity (the test's first 8 cases, but the full assertion runs on all 56 pages):

| Path | Expected |
|---|---|
| `/` | `DOLOMITES + GARDA` |
| `/day/2026-07-17` | `DOLOMITES` (lodgingSlug=baita-fraina) |
| `/day/2026-07-22` | `LAGO DI GARDA` (lodgingSlug=salo-airbnb) |
| `/hike/tre-cime` | `DOLOMITES` |
| `/activities` | `LAGO DI GARDA` |
| `/lodgings/salo-airbnb` | `LAGO DI GARDA` |
| `/lodgings/baita-fraina` | `DOLOMITES` |
| `/map` | `MAP` |

### 3.4 Map-link format
- Every `https://www.google.com/maps...` includes `?api=1&query=` followed by URL-encoded text matching `/[A-Za-z]{3,}/` (i.e. contains at least 3 consecutive letters — catches regressions to coord-only `?q=lat,lon` and one-letter junk like `q=A`)
- Every `https://maps.apple.com...` has a `q=` parameter whose decoded value matches `/[A-Za-z]{3,}/`

### 3.5 Activity-card destinations
- Every `<a href="/activities/...">` ends with a slug present in `src/content/activities/`
- The grid on `/activities` has `data-activity-card` count **equal to `getActivities().length`** (no hardcoded 22 — assertions against the live collection scale automatically)
- Each card's `data-category` matches the entry's category in YAML

### 3.6 Day record consistency
For every day in `src/content/days/`:
- `lodgingSlug` references a real `src/content/lodgings/<slug>.yaml`
- Every entry in `hikeSlugs[]` references a real `src/content/hikes/<slug>.md`
- Day count equals trip span: `Math.floor((endDate - startDate) / 86400000) + 1` from `getTrip()` (currently 13, but no hardcoded literal)

### 3.7 Service-worker cache key
`dist/sw.js` first non-empty line includes a `dolomites-v` followed by a digit. Catches accidental rollbacks.

### 3.8 Image alt-text
On detail-page routes (`/hike/`, `/day/`, `/activities/`, `/lodgings/`), every `<img>` element has an `alt` attribute (empty `alt=""` is fine for decorative — that's a11y best practice for the map ribbons).

### 3.9 Schedule on day pages
For every day in `src/content/days/` whose `schedule` array is non-empty (Phase I days), the corresponding built page contains a `<h2>` whose text includes `Schedule` and an `<ol>` with at least one `<li>` containing an `HH:MM` time pattern. Catches the "schedule data exists but isn't rendered" regression.

### 3.10 Map ribbon presence
Every detail-page route (`/hike/[slug]`, `/day/[date]`, `/activities/[slug]`, `/lodgings/[slug]`) has exactly one `<div class="map-ribbon">` element, and that element contains an `<img>` with an OSM tile URL.

**Includes Garda free-form day pages** (Jul 21–27): they render a single-pin lodging-only ribbon (Salò AirBnB pin only, no hike pins). The test does not require multi-pin ribbons — single-pin ribbons are valid and should pass.

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
| `checklist renders bookings grouped by category` | Keep, but expect `getBookings().length` items (no hardcoded count) |
| `customize page renders` | Keep |
| `persistent day-pill scroller appears on day and hike pages` | Keep |
| `day-pill scroller is absent from home page` | Keep |
| `hike page prev/next walks trip order across day boundaries` | Keep |
| `today banner is absent outside trip dates (May 2026)` | Keep but **freeze the clock**: `await page.clock.install({ time: new Date('2026-05-02T10:00:00Z') })` before `page.goto('/')`. Otherwise this test silently changes meaning when run after Jul 15 |
| `home page renders core elements` | Update — assert "Days Until Departure" wording, not generic "Days to go" |

### 4.2 New navigation / render tests (~12)

- `/activities` renders `getActivities().length` cards (currently 22), `getActivities().filter(a => a.data.featured).length` featured cards (currently 4), and `1 + Object.keys(CATEGORY_LABELS).length` filter pills (currently 10)
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
| Integrity tests run against stale `dist/` | `globalSetup` always rebuilds (`astro build` is ~5s on this site — cheap). Mtime comparison was tempting but a 1-min window leaves the door open for false-pass on a slow filesystem. Always-rebuild is correct and trivially fast |
| Playwright drag-drop flakiness | Spec'd around — we test affordance + state actions, not the gesture |
| LocalStorage state pollutes between e2e tests | Playwright's default `storageState` is per-context; new context per test → empty localStorage. Add explicit `await page.context().clearCookies()` + `await page.evaluate(() => localStorage.clear())` in `beforeEach` for safety |
| Existing tests fail-on-extract | The haversine + phase-boundary refactors touch existing `index.astro` and `day/[date].astro`. Build+rerun unit tests after each refactor in the implementation plan |
| Future activity additions break category-labels exhaustiveness | That's the point — it's a guard, not a brittle test |

## 7. Implementation order

5 phases for the implementation plan to follow. Each phase ships a working subset.

1. **Phase 1 — Refactors.** Extract three helpers and verify all call sites converged via grep:
   - `src/lib/geo.ts` (`haversineKm`) — 3 import sites (index.astro, RelatedActivities.astro, day/[date].astro)
   - `src/lib/phase.ts` (`phaseBoundary`, `isInPhaseII`) — 4 sites (index.astro, day/[date].astro, DayPillScroller.astro, MapView.tsx — the last has a hardcoded `'2026-07-20'` literal that must derive from the helper too; pass via prop from map.astro at SSR)
   - `src/lib/wordmark.ts` (`getWordmark`) — 1 definition site (BaseLayout.astro) plus 3 detail-page overrides (day/[date].astro, hike/[slug].astro, lodgings/[slug].astro) which now call `getWordmark` instead of inline ternaries
   
   **Acceptance gates** (run before moving to Phase 2):
   - `grep -rn "haversine" src/` shows matches only in `src/lib/geo.ts` and import lines
   - `grep -rn "2026-07-20\|trip.phases?.find" src/` shows matches only in `src/lib/phase.ts` and import lines
   - `grep -rn "wordmarkForPath\|'Dolomites + Garda'" src/` shows matches only in `src/lib/wordmark.ts` and import lines
   - Existing 27 unit tests still pass
2. **Phase 2 — Unit additions** (5 new files + refresh schemas + migration). Runtime budget ≤ 200ms.
3. **Phase 3 — Integrity audit** (`tests/integrity/links.test.ts` + cheerio dep + globalSetup hook).
4. **Phase 4 — E2E refresh + new** (`smoke.spec.ts` rewritten with all 31 tests). Verify against local dev.
5. **Phase 5 — Wiring + docs** (add `npm run test:all` script in `package.json`; add a short `tests/README.md` documenting the three tiers and how to run each; ensure all three tiers exit non-zero on failure for CI).
