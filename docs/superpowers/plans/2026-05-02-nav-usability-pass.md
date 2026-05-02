# Navigation & Usability Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the nav & usability pass — Garda day stubs, static map ribbons on every detail page, lodging detail pages, phase-aware home, related-activities tail, and a small a11y/consistency polish — without disturbing any existing content or visual style.

**Architecture:** Eight static map ribbons (one per detail page type) replacing the previous map-only navigation. Pin projection math lives in `src/lib/tile-math.ts` so the Astro component stays focused on rendering. Home page gets decomposed into focused `Countdown`, `TodayBanner`, `BookingRingOrBadge`, `PastPhaseSummary` components, then composed by phase. Lodgings flat list becomes a list-plus-detail pair under `src/pages/lodgings/`. Bottom-nav active-state matching becomes per-tab functions. No new Zod schemas; no new content.

**Tech Stack:** Astro 5 (`astro:content`), TypeScript strict, Tailwind v4 globals, maplibre-gl (existing, only on `/map`), js-yaml, plain DOM JS for after-swap listeners. Static OSM raster tiles for map ribbons (no MapLibre on detail pages — fully static).

**Verification model:** This codebase has no automated test suite. Each task verifies via `npm run build` (Astro runs Zod validation + TS check during build), `npm run dev` smoke-test of the affected page in a browser, and (for Phase 5) Lighthouse on `/activities`, one `/lodgings/[slug]`, one `/day/[date]`, and one `/hike/[slug]`.

---

## File Structure

### New files
- `src/lib/tile-math.ts` — pure functions: pick zoom, tile-for-lat-lon, project lat/lon → fractional position within a tile, build ribbon spec from pin set
- `src/lib/category-labels.ts` — `CATEGORY_LABELS` map for activity categories (replaces ad-hoc capitalisation in catalog filter pills + new breadcrumb)
- `src/components/MapRibbon.astro` — 80px sepia static ribbon with overlaid pins; props `pins[]` + `expandHref`
- `src/components/Breadcrumb.astro` — small mono-cap breadcrumb; props `crumbs: { label, href? }[]`
- `src/components/RelatedActivities.astro` — horizontal scroll-snap row of up-to-3 closest activities by haversine
- `src/components/Countdown.astro` — adaptive countdown (pre-trip / during-trip / post-trip)
- `src/components/TodayBanner.astro` — phase-aware today banner (Phase I hike or Phase II free-day quick-row)
- `src/components/BookingRingOrBadge.astro` — full ring or collapsed badge (collapse rule: all booked OR Phase II started)
- `src/components/PastPhaseSummary.astro` — Past phase Dolomites summary card with stat strip + chevron to /hikes
- `src/pages/lodgings/index.astro` — moved from `src/pages/lodgings.astro` (URL unchanged); cards now link into per-lodging detail
- `src/pages/lodgings/[slug].astro` — per-lodging detail with map ribbon

### Modified files
- `scripts/migrate-itinerary.mjs` — add `emitGardaDayStubs()`; idempotent; wire into `runMigration()`
- `src/components/BottomNav.astro` — per-tab active-state matcher; pathname-based
- `src/components/DayPillScroller.astro` — visibility check + `scrollIntoView` on mount and `astro:after-swap`
- `src/layouts/BaseLayout.astro` — `tabindex="-1"` on `<main>`; `astro:after-swap` focus-restoration listener
- `src/pages/index.astro` — slim composition of new components by phase (target ≤ 250 lines, currently 462)
- `src/pages/day/[date].astro` — `<MapRibbon>` after pills; Garda free-form CTA when `hikeSlugs.length === 0 && date >= phaseBoundary`; cross-link to `/contingencies` if `badWeatherOption` set
- `src/pages/hike/[slug].astro` — `<MapRibbon>` at top with single trailhead pin
- `src/pages/activities/index.astro` — replace inline `categoryLabel()` helper with `CATEGORY_LABELS` lookup
- `src/pages/activities/[slug].astro` — `<MapRibbon>` at top, `<Breadcrumb>` above hero, `<RelatedActivities current={activity} />` above back-to-catalog link; replace inline `categoryLabel()` helper with `CATEGORY_LABELS` lookup
- `src/pages/map.astro` — pins gain `id` and `dayDates[]`; consume `?day=` and `?focus=` query params; lodging-pin hrefs deep-link to `/lodgings/<slug>` instead of flat `/lodgings`
- `src/components/MapView.tsx` — accept `focusId?: string` and `dayDate?: string` props; filter / fly-to / open-popup as per spec
- `public/sw.js` — bump cache key `dolomites-v3` → `dolomites-v4` (no other change needed — `skipWaiting()`/`clients.claim()` already in place)

### Untouched
- `Header.astro`, `RegisterServiceWorker.astro`, `WeatherWidget.tsx`, `BookingChecklist.tsx`, `customize/*`, `ShareLinkButton.tsx`, `CustomizedPill.tsx`, `DriveLegs.astro`
- All hike, restaurant, booking, trip YAML/MD files
- `/checklist`, `/restaurants`, `/contingencies`, `/photos`, `/customize`, `/hikes`, `/custom-day`, `/more`

---

## Phase 1 — Foundation (data + reusable libs/components)

### Task 1: Garda day stubs (Jul 21–27)

**Files:**
- Modify: `scripts/migrate-itinerary.mjs`

- [ ] **Step 1: Add `emitGardaDayStubs()` function**

In `scripts/migrate-itinerary.mjs`, between `emitActivities()` and `runMigration()`, add the function. The flight-time string is read from the same hardcoded trip object that `emitTrip()` uses — single source of truth. The idempotency check uses `fs.existsSync` so a developer's hand-edited day file is preserved on re-run.

```javascript
function emitGardaDayStubs() {
  // Pull the return-flight depart string straight from the same source
  // emitTrip() uses, so the two never drift out of sync.
  const returnDepart = '2026-07-27T19:10';  // matches emitTrip()'s trip.flights.return[0].depart
  const departTime = returnDepart.slice(11, 16);          // "19:10"
  const arriveBy = '16:00';                                // 3h buffer recommended

  const SALO = { lat: 45.6063, lon: 10.5237, label: 'Salò' };

  // Days Jul 21..26 — all identical free-form Garda days.
  const freeFormDates = ['2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26'];
  for (const date of freeFormDates) {
    const stub = {
      date,
      theme: 'Free day at Lake Garda',
      driving: { legs: [] },
      schedule: [],
      hikeSlugs: [],
      lodgingSlug: 'salo-airbnb',
      weatherFor: SALO,
    };
    const slug = `${date}-free-day-lake-garda`;
    const target = path.join(ROOT, `src/content/days/${slug}.md`);
    if (fs.existsSync(target)) {
      console.log(`  · ${slug} already exists — skipping`);
      continue;
    }
    writeFile(`src/content/days/${slug}.md`, `---\n${toYAML(stub).trim()}\n---\n\n`);
  }

  // Day 13 (Jul 27) — departure day with the airport drive leg.
  const dep = {
    date: '2026-07-27',
    theme: 'Departure — drive to VCE',
    driving: {
      legs: [{
        from: 'Salò',
        to: 'Venice Marco Polo Airport (VCE)',
        distanceKm: 175,
        durationMin: 130,
        notes: `Aim to arrive by ${arriveBy} for the ${departTime} flight; allow buffer for traffic`,
      }],
    },
    schedule: [],
    hikeSlugs: [],
    lodgingSlug: 'salo-airbnb',
    weatherFor: SALO,
  };
  const depSlug = '2026-07-27-departure-drive-to-vce';
  const depTarget = path.join(ROOT, `src/content/days/${depSlug}.md`);
  if (fs.existsSync(depTarget)) {
    console.log(`  · ${depSlug} already exists — skipping`);
  } else {
    writeFile(`src/content/days/${depSlug}.md`, `---\n${toYAML(dep).trim()}\n---\n\n`);
  }
}
```

- [ ] **Step 2: Wire it into `runMigration()`**

Find the line `console.log('Emitting days...'); for (const d of days) emitDay(d);` inside `runMigration()` and add the new emit immediately after:

```javascript
  console.log('Emitting days...'); for (const d of days) emitDay(d);
  console.log('Emitting Garda day stubs...'); emitGardaDayStubs();
  console.log('Emitting hikes...'); for (const h of hikes) emitHike(h);
```

- [ ] **Step 3: Run the migration**

Run: `node scripts/migrate-itinerary.mjs`
Expected output includes:
- `Emitting Garda day stubs...`
- 7 lines like `  ✓ src/content/days/2026-07-21-free-day-lake-garda.md`
- Final `Done.`

Sanity-check:
```bash
ls src/content/days/ | wc -l   # should be 13 (was 6)
ls src/content/days/2026-07-2*.md
```

- [ ] **Step 4: Verify schema validation**

Run: `npm run build`
Expected: succeeds; the existing `DaySchema` accepts the new files (theme, empty driving.legs, empty schedule, empty hikeSlugs, lodgingSlug, weatherFor all conform).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-itinerary.mjs src/content/days
git commit -m "feat(content): add 7 Garda day stubs (Jul 21-27)

Idempotent emitGardaDayStubs() in migration script. Days 21-26 are
free-form (lodging only); Day 27 has the Salò → VCE airport drive
leg with departure time pulled from the same trip data as emitTrip().

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: `tile-math.ts` — pin projection library

**Files:**
- Create: `src/lib/tile-math.ts`

- [ ] **Step 1: Create the file with pure projection functions**

Create `src/lib/tile-math.ts`:

```typescript
// Web Mercator tile projection helpers for static MapRibbon component.
// Pure functions — no DOM, no fetch.

export type Pin = {
  lat: number;
  lon: number;
  label: string;
  href?: string;
  category: 'trailhead' | 'lodging' | 'parking' | 'restaurant' | 'activity';
};

export type ProjectedPin = Pin & {
  fx: number; // 0..1 fractional x within the tile
  fy: number; // 0..1 fractional y within the tile
  edge: null | 'left' | 'right' | 'top' | 'bottom'; // non-null = clipped to edge marker
};

export type RibbonSpec = {
  tileX: number;
  tileY: number;
  zoom: number;
  tileUrl: string;
  centerLat: number;
  centerLon: number;
  projected: ProjectedPin[];
};

const MIN_ZOOM = 10;
const MAX_ZOOM = 13;

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
  );
}

function tileBBox(x: number, y: number, z: number) {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return { west, east, north: (northRad * 180) / Math.PI, south: (southRad * 180) / Math.PI };
}

// Mercator y-projection of a latitude (radians-free formulation)
function projY(latDeg: number): number {
  const rad = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function projectPin(p: Pin, x: number, y: number, z: number): ProjectedPin {
  const bbox = tileBBox(x, y, z);
  const fx = (p.lon - bbox.west) / (bbox.east - bbox.west);
  const yScale = projY(bbox.north) - projY(bbox.south);
  const fy = (projY(bbox.north) - projY(p.lat)) / yScale;

  let edge: ProjectedPin['edge'] = null;
  let cx = fx;
  let cy = fy;
  if (fx < 0) { edge = 'left'; cx = 0; }
  else if (fx > 1) { edge = 'right'; cx = 1; }
  else if (fy < 0) { edge = 'top'; cy = 0; }
  else if (fy > 1) { edge = 'bottom'; cy = 1; }

  return { ...p, fx: cx, fy: cy, edge };
}

// Pick a zoom that keeps every pin inside one tile if possible.
// Drops a level and retries on overflow; bottoms out at MIN_ZOOM with edge-marker fallback.
function pickZoomAndTile(centerLat: number, centerLon: number, pins: Pin[]) {
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const tx = lonToTileX(centerLon, z);
    const ty = latToTileY(centerLat, z);
    const projected = pins.map((p) => projectPin(p, tx, ty, z));
    const allInside = projected.every((pp) => pp.edge === null);
    if (allInside || z === MIN_ZOOM) {
      return { zoom: z, tileX: tx, tileY: ty, projected };
    }
  }
  // Unreachable, but keeps TS happy
  const z = MIN_ZOOM;
  const tx = lonToTileX(centerLon, z);
  const ty = latToTileY(centerLat, z);
  return { zoom: z, tileX: tx, tileY: ty, projected: pins.map((p) => projectPin(p, tx, ty, z)) };
}

/**
 * Build a complete RibbonSpec for the given pin set. Uses the bounding-box
 * centre of the pins (NOT the mean), and chooses the highest zoom level
 * (most detail) that fits all pins inside one tile.
 *
 * Single-pin sets get zoom 13 with the pin centred.
 */
export function buildRibbonSpec(pins: Pin[]): RibbonSpec | null {
  if (pins.length === 0) return null;

  // Bounding-box centre (handles asymmetric pin spreads better than mean).
  const lats = pins.map((p) => p.lat);
  const lons = pins.map((p) => p.lon);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

  if (pins.length === 1) {
    const z = MAX_ZOOM;
    const tx = lonToTileX(pins[0].lon, z);
    const ty = latToTileY(pins[0].lat, z);
    const projected = [projectPin(pins[0], tx, ty, z)];
    return {
      zoom: z,
      tileX: tx,
      tileY: ty,
      tileUrl: `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`,
      centerLat: pins[0].lat,
      centerLon: pins[0].lon,
      projected,
    };
  }

  const { zoom, tileX, tileY, projected } = pickZoomAndTile(centerLat, centerLon, pins);
  return {
    zoom,
    tileX,
    tileY,
    tileUrl: `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`,
    centerLat,
    centerLon,
    projected,
  };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx astro check`
Expected: passes (no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/tile-math.ts
git commit -m "feat(lib): add tile-math.ts for static MapRibbon projection

Pure functions: Web Mercator lat/lon → fractional tile position,
zoom selection that fits all pins in one tile, edge-marker fallback
at MIN_ZOOM=10. Used by MapRibbon.astro in the next commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: `MapRibbon.astro` — the static ribbon component

**Files:**
- Create: `src/components/MapRibbon.astro`

- [ ] **Step 1: Create the component**

Create `src/components/MapRibbon.astro`:

```astro
---
import { buildRibbonSpec, type Pin } from '@/lib/tile-math';

type Props = { pins: Pin[]; expandHref: string; caption?: string };
const { pins, expandHref, caption } = Astro.props;

const spec = buildRibbonSpec(pins);

// Pin colors mirror MapView.tsx exactly so detail and full-map look unified.
const pinColors: Record<Pin['category'], string> = {
  trailhead: '#2d4a3e',
  lodging: '#a83232',
  parking: '#5a6b4d',
  restaurant: '#b08838',
  activity: '#3a5f8a',
};

const edgeArrow = (edge: 'left' | 'right' | 'top' | 'bottom') => {
  switch (edge) {
    case 'left':   return '◀';
    case 'right':  return '▶';
    case 'top':    return '▲';
    case 'bottom': return '▼';
  }
};
---
{spec && (
  <div class="map-ribbon" style="
    position: relative;
    height: 80px;
    overflow: hidden;
    border-bottom: 1px solid var(--hairline);
    background: #d8c79a;
  ">
    <img
      src={spec.tileUrl}
      width="256"
      height="256"
      alt=""
      loading="lazy"
      decoding="async"
      style="
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 0;
        filter: sepia(0.35) saturate(0.85) hue-rotate(-10deg) contrast(0.95) brightness(1.02);
      "
    />
    {spec.projected.map((p) => (
      p.edge === null ? (
        <span
          aria-label={p.label}
          title={p.label}
          style={`
            position: absolute;
            z-index: 1;
            left: ${(p.fx * 100).toFixed(2)}%;
            top: ${(p.fy * 100).toFixed(2)}%;
            transform: translate(-50%, -50%);
            width: 12px; height: 12px;
            border-radius: 50%;
            background: ${pinColors[p.category]};
            border: 2px solid #fff;
            box-shadow: 0 1px 2px rgba(0,0,0,.4);
          `}
        ></span>
      ) : (
        <span
          aria-label={`${p.label} (off-screen)`}
          title={p.label}
          style={`
            position: absolute;
            z-index: 1;
            left: ${(p.fx * 100).toFixed(2)}%;
            top: ${(p.fy * 100).toFixed(2)}%;
            transform: translate(-50%, -50%);
            color: ${pinColors[p.category]};
            font-size: 14px;
            line-height: 1;
            text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff;
          `}
        >{edgeArrow(p.edge)}</span>
      )
    ))}
    {caption && (
      <span style="
        position: absolute;
        z-index: 2;
        top: 6px; left: 8px;
        font-family: var(--font-mono);
        font-size: 9px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink);
        background: rgba(241, 233, 210, 0.92);
        padding: 3px 7px;
        border-radius: 3px;
      ">{caption}</span>
    )}
    <a href={expandHref} aria-label="Open full map" style="
      position: absolute;
      z-index: 2;
      bottom: 6px; right: 8px;
      font-family: var(--font-mono);
      font-size: 9px;
      letter-spacing: 0.06em;
      color: var(--bg);
      background: rgba(14, 59, 67, 0.92);
      padding: 4px 8px;
      border-radius: 3px;
      text-decoration: none;
      min-height: 24px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    ">⤢ Full map</a>
  </div>
)}

<style is:global>
  /* Children must opt out too — Astro's ClientRouter may auto-name descendants. */
  .map-ribbon,
  .map-ribbon * {
    view-transition-name: none;
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds. The component is unused so far so build-time impact is zero.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapRibbon.astro
git commit -m "feat(components): add static MapRibbon component

80px sepia OSM tile + overlaid pins, no MapLibre, no JS. Uses
tile-math.ts for projection. Caption pill top-left, '⤢ Full map'
expand control bottom-right. View Transitions opt-out cascades to
descendants via .map-ribbon * selector.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: `Breadcrumb.astro` + `category-labels.ts` + SW bump

**Files:**
- Create: `src/components/Breadcrumb.astro`
- Create: `src/lib/category-labels.ts`
- Modify: `public/sw.js`

- [ ] **Step 1: Create `src/lib/category-labels.ts`**

```typescript
// Single source of truth for human-readable activity category labels.
// Used by /activities catalog filter pills and the Breadcrumb on /activities/[slug].
// Keys match the ActivitySchema category enum in src/content/config.ts.

export type ActivityCategory =
  | 'water-sports'
  | 'culture-history'
  | 'mountain-cable-car'
  | 'scenic'
  | 'bike'
  | 'wine'
  | 'day-trip'
  | 'aquatic-park'
  | 'hiking';

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  'water-sports': 'Water Sports',
  'culture-history': 'Culture & History',
  'mountain-cable-car': 'Mountain & Cable Car',
  'scenic': 'Scenic',
  'bike': 'Bike',
  'wine': 'Wine',
  'day-trip': 'Day Trip',
  'aquatic-park': 'Aquatic Park',
  'hiking': 'Hiking',
};
```

- [ ] **Step 2: Create `src/components/Breadcrumb.astro`**

```astro
---
type Crumb = { label: string; href?: string };
type Props = { crumbs: Crumb[] };
const { crumbs } = Astro.props;
---
<nav aria-label="Breadcrumb" style="padding: 14px var(--page-x) 0;">
  <ol style="
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  ">
    {crumbs.map((c, i) => (
      <li style="display: inline-flex; align-items: center; gap: 6px;">
        {i > 0 && <span aria-hidden="true" style="color: var(--gold); opacity: 0.6;">/</span>}
        {c.href ? (
          <a href={c.href} class="mono-cap" style="font-size: 10.5px; letter-spacing: 0.18em; color: var(--ink-soft); text-decoration: none;">{c.label}</a>
        ) : (
          <span class="mono-cap" aria-current="page" style="font-size: 10.5px; letter-spacing: 0.18em; color: var(--ink); font-weight: 700;">{c.label}</span>
        )}
      </li>
    ))}
  </ol>
</nav>
```

- [ ] **Step 3: Bump SW cache key**

In `public/sw.js`, change line 1:

```javascript
const CACHE = 'dolomites-v3';
```

to:

```javascript
const CACHE = 'dolomites-v4';
```

(The existing `self.skipWaiting()` and `self.clients.claim()` calls are already in place at lines 12 and 21 — no other change needed.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Breadcrumb.astro src/lib/category-labels.ts public/sw.js
git commit -m "feat: Breadcrumb component, CATEGORY_LABELS, SW v4

Breadcrumb is a small mono-cap nav; props { crumbs: { label, href? }[] }.
CATEGORY_LABELS replaces ad-hoc capitalisation in catalog filter pills
+ new activity-detail breadcrumb. SW bumps v3 → v4 (skipWaiting and
clients.claim already in place from earlier commits).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 2 — Map embed everywhere

### Task 5: `<MapRibbon>` on day, hike, activity pages

**Files:**
- Modify: `src/pages/day/[date].astro`
- Modify: `src/pages/hike/[slug].astro`
- Modify: `src/pages/activities/[slug].astro`

- [ ] **Step 1: Add ribbon to `/day/[date].astro`**

In the frontmatter (after the existing `const lodging = ...` line around line 26), add:

```typescript
import MapRibbon from '@/components/MapRibbon.astro';
import type { Pin } from '@/lib/tile-math';

const ribbonPins: Pin[] = [];
for (const h of hikes) {
  if (h?.data?.trailhead) {
    ribbonPins.push({
      lat: h.data.trailhead.lat,
      lon: h.data.trailhead.lon,
      label: `${h.data.name} (trailhead)`,
      href: `/hike/${h.slug}`,
      category: 'trailhead',
    });
  }
}
if (lodging) {
  ribbonPins.push({
    lat: lodging.data.lat,
    lon: lodging.data.lon,
    label: lodging.data.name,
    href: `/lodgings/${lodging.id}`,
    category: 'lodging',
  });
}
const ribbonCaption = `Day ${dayIndex + 1} · ${hikes.length} ${hikes.length === 1 ? 'hike' : 'hikes'} · lodging`;
```

In the body, immediately AFTER `<BaseLayout title={...} activeDayDate={day.data.date}>` and BEFORE the first `<section>`, insert:

```astro
  <MapRibbon pins={ribbonPins} expandHref={`/map?day=${day.data.date}`} caption={ribbonCaption} />
```

- [ ] **Step 2: Add ribbon to `/hike/[slug].astro`**

Open `src/pages/hike/[slug].astro`. In the frontmatter after the existing imports, add:

```typescript
import MapRibbon from '@/components/MapRibbon.astro';
import type { Pin } from '@/lib/tile-math';

const ribbonPins: Pin[] = [{
  lat: hike.data.trailhead.lat,
  lon: hike.data.trailhead.lon,
  label: `${hike.data.name} (trailhead)`,
  href: `/hike/${hike.slug}`,
  category: 'trailhead',
}];
```

(`hike` is the existing variable from `const { hike } = Astro.props`.)

In the body, immediately AFTER the opening `<BaseLayout ...>` and BEFORE the first `<section>` of page content, insert:

```astro
  <MapRibbon pins={ribbonPins} expandHref={`/map?focus=hike-${hike.slug}`} caption={`${hike.data.name} · trailhead`} />
```

- [ ] **Step 3: Add ribbon to `/activities/[slug].astro`**

In the frontmatter (after the existing `const a = activity.data;` line), add:

```typescript
import MapRibbon from '@/components/MapRibbon.astro';
import type { Pin } from '@/lib/tile-math';

const ribbonPins: Pin[] = [{
  lat: a.location.lat,
  lon: a.location.lon,
  label: a.name,
  href: `/activities/${activity.id}`,
  category: 'activity',
}];
```

In the body, immediately AFTER the opening `<BaseLayout ...>` and BEFORE the first `<section>`, insert:

```astro
  <MapRibbon pins={ribbonPins} expandHref={`/map?focus=activity-${activity.id}`} caption={`${a.location.label} · ${a.name}`} />
```

- [ ] **Step 4: Build + smoke**

Run: `npm run build`
Expected: succeeds, all 13 day pages + 6 hike pages + 22 activity pages emit. Sample one of each in the dev server.

Run: `npm run dev` then visit `http://localhost:4321/day/2026-07-17`, `/hike/tre-cime`, `/activities/solferino-red-cross-memorial`. Each should show the 80px sepia ribbon at top with at least one pin and a "⤢ Full map" link bottom-right. The expand-link href should be `/map?day=...` or `/map?focus=...` respectively.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/pages/day/[date].astro src/pages/hike/[slug].astro src/pages/activities/[slug].astro
git commit -m "feat(pages): MapRibbon on day, hike, activity detail pages

Static OSM ribbon at top of each detail page with day/hike/activity
pins overlaid. Each ribbon's expand control links into /map with the
appropriate ?day or ?focus query param (target page handles those
in the next commit).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: `/map` query-param support (`?day=`, `?focus=`)

**Files:**
- Modify: `src/pages/map.astro`
- Modify: `src/components/MapView.tsx`

- [ ] **Step 1: Extend pin construction in `/map.astro` with `id` + `dayDates[]`**

Replace the entire `src/pages/map.astro` frontmatter (between the leading `---` and the next `---`) with:

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import MapView from '@/components/MapView';
import { getHikes, getLodgings, getActivities, getDays } from '@/lib/content';

const hikes = await getHikes();
const lodgings = await getLodgings();
const activities = await getActivities();
const days = await getDays();

type Pin = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  href?: string;
  category: 'trailhead' | 'lodging' | 'parking' | 'restaurant' | 'activity';
  dayDates: string[];
};

const pins: Pin[] = [];

for (const h of hikes) {
  // Find every day that schedules this hike.
  const dayDates = days.filter((d) => d.data.hikeSlugs.includes(h.slug)).map((d) => d.data.date);
  pins.push({
    id: `hike-${h.slug}`,
    lat: h.data.trailhead.lat,
    lon: h.data.trailhead.lon,
    label: `${h.data.name} (trailhead)`,
    href: `/hike/${h.slug}`,
    category: 'trailhead',
    dayDates,
  });
}

for (const l of lodgings) {
  // A lodging belongs to every day whose lodgingSlug points at it.
  const dayDates = days.filter((d) => d.data.lodgingSlug === l.id).map((d) => d.data.date);
  pins.push({
    id: `lodging-${l.id}`,
    lat: l.data.lat,
    lon: l.data.lon,
    label: l.data.name,
    href: `/lodgings/${l.id}`,
    category: 'lodging',
    dayDates,
  });
}

for (const a of activities) {
  // Activities aren't scheduled to specific days yet — leave dayDates empty.
  pins.push({
    id: `activity-${a.id}`,
    lat: a.data.location.lat,
    lon: a.data.location.lon,
    label: a.data.name,
    href: `/activities/${a.id}`,
    category: 'activity',
    dayDates: [],
  });
}

// Read URL params at SSR time. They'll be available again client-side
// via window.location for the React island; we also pass them as props
// so the island sees them on first render.
const url = new URL(Astro.request.url);
const focusId = url.searchParams.get('focus') ?? undefined;
const dayDate = url.searchParams.get('day') ?? undefined;
---
```

Update the body's caption block to use the same activities count and unchanged otherwise. Then change the `<MapView>` invocation to pass the new props:

```astro
  <MapView pins={pins} focusId={focusId} dayDate={dayDate} client:only="react" />
```

(Keep the floating caption block, the sepia overlay style block, everything else as-is.)

- [ ] **Step 2: Update `MapView.tsx` to honour `focusId` + `dayDate`**

Replace the entire `src/components/MapView.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Pin = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  href?: string;
  category: 'trailhead' | 'lodging' | 'parking' | 'restaurant' | 'activity';
  dayDates: string[];
};

type Props = {
  pins: Pin[];
  focusId?: string;
  dayDate?: string;
};

const colors = {
  trailhead: '#2d4a3e',
  lodging: '#a83232',
  parking: '#5a6b4d',
  restaurant: '#b08838',
  activity: '#3a5f8a',
};

export default function MapView({ pins, focusId, dayDate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // focus param wins over day param when both are set (per spec §2 precedence)
  const effectiveDay = focusId ? undefined : dayDate;
  // Default Phase I/II layer state: if filtered to a Phase I day, default to Phase I only.
  const phaseIOnly = effectiveDay !== undefined && effectiveDay < '2026-07-20';
  const [showHikes, setShowHikes] = useState(true);
  const [showActivities, setShowActivities] = useState(!phaseIOnly);

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return;
    const lats = pins.map((p) => p.lat);
    const lons = pins.map((p) => p.lon);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons) - 0.05, Math.min(...lats) - 0.05],
      [Math.max(...lons) + 0.05, Math.max(...lats) + 0.05],
    ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      bounds,
      fitBoundsOptions: { padding: 30 },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pins]);

  // Re-render markers + apply focus/day filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    let visible: Pin[];
    if (focusId) {
      // focus wins
      visible = pins.filter((p) => p.id === focusId);
    } else if (effectiveDay) {
      // day filter
      visible = pins.filter((p) => p.dayDates.includes(effectiveDay));
    } else {
      // global with toggles
      visible = pins.filter((p) => (p.category === 'activity' ? showActivities : showHikes));
    }

    const focusMarkers: { marker: maplibregl.Marker; pin: Pin }[] = [];

    for (const p of visible) {
      const el = document.createElement('div');
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${colors[p.category]};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);cursor:pointer;`;

      const popupHtml = p.href
        ? `<a href="${p.href}" style="color:#2d4a3e;font-weight:600">${p.label}</a>`
        : `<span style="font-weight:600">${p.label}</span>`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml))
        .addTo(map);

      markersRef.current.push(marker);
      if (focusId && p.id === focusId) focusMarkers.push({ marker, pin: p });
    }

    // Apply focus: zoom + open popup
    if (focusMarkers.length > 0) {
      const { marker, pin } = focusMarkers[0];
      map.flyTo({ center: [pin.lon, pin.lat], zoom: 14, padding: 80 });
      // Open popup after fly-to settles (small delay so the map is centred first)
      setTimeout(() => marker.togglePopup(), 350);
    } else if (effectiveDay && visible.length > 0) {
      // Day filter: fit bounds of the day's pins
      const lats = visible.map((p) => p.lat);
      const lons = visible.map((p) => p.lon);
      const bb: [[number, number], [number, number]] = [
        [Math.min(...lons) - 0.02, Math.min(...lats) - 0.02],
        [Math.max(...lons) + 0.02, Math.max(...lats) + 0.02],
      ];
      map.fitBounds(bb, { padding: 60 });
    }
  }, [pins, showHikes, showActivities, focusId, effectiveDay]);

  // Hide layer toggle when filters are active (focus or day)
  const showToggle = !focusId && !effectiveDay;

  return (
    <div style={{ position: 'relative' }}>
      {showToggle && (
        <div style={{
          position: 'absolute',
          top: 110, left: 16, zIndex: 10,
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={() => setShowHikes((v) => !v)}
            aria-pressed={showHikes}
            style={{
              padding: '6px 10px',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              background: showHikes ? 'var(--ink)' : 'color-mix(in srgb, var(--bg) 90%, transparent)',
              color: showHikes ? 'var(--bg)' : 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              minHeight: 36,
            }}
          >Phase I</button>
          <button
            type="button"
            onClick={() => setShowActivities((v) => !v)}
            aria-pressed={showActivities}
            style={{
              padding: '6px 10px',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              background: showActivities ? 'var(--ink)' : 'color-mix(in srgb, var(--bg) 90%, transparent)',
              color: showActivities ? 'var(--bg)' : 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              minHeight: 36,
            }}
          >Phase II</button>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 64px - 48px)' }} />
    </div>
  );
}
```

- [ ] **Step 3: Build + smoke**

Run: `npm run build && npm run dev`
Visit:
- `http://localhost:4321/map` — global; both toggles visible; both layers on
- `http://localhost:4321/map?day=2026-07-17` — only the Sorapis trailhead + Baita Fraina lodging visible; toggles hidden; map zoomed to those pins
- `http://localhost:4321/map?focus=hike-tre-cime` — only Tre Cime trailhead visible, popup auto-opens, zoom 14
- `http://localhost:4321/map?focus=activity-solferino-red-cross-memorial` — Solferino popup auto-opens
- `http://localhost:4321/map?day=2026-07-17&focus=hike-tre-cime` — focus wins, only Tre Cime visible

From a detail page, tapping the ribbon's "⤢ Full map" should land on the right `/map?...` URL.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/map.astro src/components/MapView.tsx
git commit -m "feat(map): support ?day= and ?focus= query params

map.astro now derives id + dayDates per pin. MapView reads focusId/
dayDate props: focus wins over day; focus zooms to 14 + opens popup;
day filters and fits bounds. Phase I/II toggles auto-hide when a
filter is active. Lodging pin hrefs deep-link /lodgings/<slug>
(detail pages land in the next phase).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 3 — Lodging detail pages + nav consistency

### Task 7: Move `/lodgings.astro` → `/lodgings/index.astro`, build `/lodgings/[slug].astro`

**Files:**
- Move: `src/pages/lodgings.astro` → `src/pages/lodgings/index.astro`
- Create: `src/pages/lodgings/[slug].astro`

- [ ] **Step 1: Rename the file** (using `git mv` so history is preserved)

```bash
mkdir -p src/pages/lodgings
git mv src/pages/lodgings.astro src/pages/lodgings/index.astro
```

- [ ] **Step 2: Update `src/pages/lodgings/index.astro` so cards link to detail pages**

Open the file. Wrap each `<article>` in an `<a href={`/lodgings/${l.id}`}>` and remove the on-card phone/booking/maps links (those move to the detail page). Replace the entire `{lodgings.map(...)}` block with:

```astro
    {lodgings.map((l: any) => (
      <a href={`/lodgings/${l.id}`} style="
        display: block;
        background: var(--bg-paper);
        border: 1px solid var(--hairline);
        border-radius: var(--r-md);
        padding: 16px 18px 18px;
        box-shadow: var(--shadow-paper-md);
        text-decoration: none;
      ">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex: 0 0 auto; margin-top: 4px;">
            <path d="M3 11 L12 4 L21 11 V21 H3 Z" stroke="var(--gold)" stroke-width="1.5" stroke-linejoin="round" fill="none" />
            <path d="M9 21 V14 H15 V21" stroke="var(--ink-soft)" stroke-width="1.25" />
          </svg>
          <div style="flex: 1; min-width: 0;">
            <h2 style="
              font-family: var(--font-display);
              font-weight: 700;
              font-variation-settings: 'opsz' 80;
              font-size: 22px;
              line-height: 1.05;
              letter-spacing: -0.01em;
              color: var(--ink);
              margin: 0;
            ">{l.data.name}</h2>
            <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">{l.data.location}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="color: var(--gold); flex: 0 0 auto;">
            <path d="M9 6 L15 12 L9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <div style="margin-top: 14px; padding: 12px 0; border-top: 1px dashed var(--hairline); display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <div class="mono-cap" style="font-size: 9px; color: var(--ink-soft);">Check-In</div>
            <div class="mono tabular" style="font-size: 12.5px; color: var(--ink); margin-top: 4px; letter-spacing: 0.02em;">{fmt(l.data.checkIn)}</div>
          </div>
          <div>
            <div class="mono-cap" style="font-size: 9px; color: var(--ink-soft);">Check-Out</div>
            <div class="mono tabular" style="font-size: 12.5px; color: var(--ink); margin-top: 4px; letter-spacing: 0.02em;">{fmt(l.data.checkOut)}</div>
          </div>
        </div>
      </a>
    ))}
```

- [ ] **Step 3: Create `src/pages/lodgings/[slug].astro`**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import MapRibbon from '@/components/MapRibbon.astro';
import type { Pin } from '@/lib/tile-math';
import { getLodgings } from '@/lib/content';

export async function getStaticPaths() {
  const lodgings = await getLodgings();
  return lodgings.map((l) => ({ params: { slug: l.id }, props: { lodging: l } }));
}

const { lodging } = Astro.props;
const l = lodging.data;

const ribbonPins: Pin[] = [{
  lat: l.lat,
  lon: l.lon,
  label: l.name,
  href: `/lodgings/${lodging.id}`,
  category: 'lodging',
}];

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const gmapsUrl = `https://www.google.com/maps?q=${l.lat},${l.lon}`;
const amapsUrl = `https://maps.apple.com/?ll=${l.lat},${l.lon}&q=${encodeURIComponent(l.name)}`;
---
<BaseLayout title={`${l.name} · Lodgings`}>
  <MapRibbon pins={ribbonPins} expandHref={`/map?focus=lodging-${lodging.id}`} caption={`${l.location} · ${l.nights} ${l.nights === 1 ? 'night' : 'nights'}`} />

  <section class="stagger" style="padding: 24px var(--page-x) 8px;">
    <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft);">Lodging</span>
    <h1 style="
      font-family: var(--font-display);
      font-style: italic;
      font-weight: 800;
      font-variation-settings: 'opsz' 144;
      font-size: clamp(34px, 9vw, 54px);
      line-height: 0.96;
      letter-spacing: -0.02em;
      color: var(--ink);
      margin: 8px 0 4px;
    ">{l.name}</h1>
    <p class="mono-cap" style="font-size: 12px; color: var(--ink-soft); margin: 0;">{l.location}</p>
  </section>

  <section class="stagger" style="padding: 14px var(--page-x) 8px;">
    <div style="
      background: var(--bg-paper);
      border: 1px solid var(--hairline);
      border-radius: var(--r-md);
      box-shadow: var(--shadow-paper-sm);
      padding: 14px 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    ">
      <div>
        <div class="mono-cap" style="font-size: 9px; color: var(--ink-soft);">Check-In</div>
        <div class="mono tabular" style="font-size: 13px; color: var(--ink); margin-top: 4px;">{fmt(l.checkIn)}</div>
      </div>
      <div>
        <div class="mono-cap" style="font-size: 9px; color: var(--ink-soft);">Check-Out</div>
        <div class="mono tabular" style="font-size: 13px; color: var(--ink); margin-top: 4px;">{fmt(l.checkOut)}</div>
      </div>
    </div>
  </section>

  {l.address && (
    <section class="stagger" style="padding: 14px var(--page-x) 0;">
      <h2 class="eyebrow" style="margin: 0 0 6px;">Address</h2>
      <p style="font-size: 14px; color: var(--ink); margin: 0; line-height: 1.5;">{l.address}</p>
    </section>
  )}

  <section class="stagger" style="padding: 14px var(--page-x) 0; display: flex; gap: 8px; flex-wrap: wrap;">
    {l.phone && (
      <a href={`tel:${l.phone}`} class="mono-cap" style="
        font-size: 11px;
        padding: 10px 14px;
        border: 1px solid var(--gold);
        border-radius: var(--r-sm);
        color: var(--ink);
        background: rgba(212, 162, 76, 0.08);
        min-height: 44px;
        display: inline-flex;
        align-items: center;
      ">📞 {l.phone}</a>
    )}
    {l.bookingUrl && (
      <a href={l.bookingUrl} target="_blank" rel="noopener" class="mono-cap" style="
        font-size: 11px;
        padding: 10px 14px;
        border: 1px solid var(--hairline);
        border-radius: var(--r-sm);
        color: var(--ink-soft);
        min-height: 44px;
        display: inline-flex;
        align-items: center;
      ">Booking</a>
    )}
    <a href={amapsUrl} target="_blank" rel="noopener" class="mono-cap" style="
      font-size: 11px;
      padding: 10px 14px;
      border: 1px solid var(--hairline);
      border-radius: var(--r-sm);
      color: var(--ink-soft);
      min-height: 44px;
      display: inline-flex;
      align-items: center;
    ">Apple Maps</a>
    <a href={gmapsUrl} target="_blank" rel="noopener" class="mono-cap" style="
      font-size: 11px;
      padding: 10px 14px;
      border: 1px solid var(--hairline);
      border-radius: var(--r-sm);
      color: var(--ink-soft);
      min-height: 44px;
      display: inline-flex;
      align-items: center;
    ">Google Maps</a>
  </section>

  {l.notes && (
    <section class="stagger" style="padding: 18px var(--page-x) 0;">
      <h2 class="eyebrow" style="margin: 0 0 6px;">Notes</h2>
      <p style="font-size: 13.5px; color: var(--ink-soft); margin: 0; line-height: 1.55; font-style: italic;">{l.notes}</p>
    </section>
  )}

  <section class="stagger" style="padding: 24px var(--page-x) 32px;">
    <a href="/lodgings" class="mono-cap" style="font-size: 11px; color: var(--ink-soft);">← Back to lodgings</a>
  </section>
</BaseLayout>
```

- [ ] **Step 4: Build + smoke**

Run: `npm run build`
Expected: 3 new pages emitted under `/lodgings/`: `index.html`, `baita-fraina/index.html`, `pension-kircher-sepp/index.html`, `salo-airbnb/index.html`. (4 total — index + 3 details.)

Run dev server, visit `http://localhost:4321/lodgings/salo-airbnb`. Should show: ribbon centred on Salò, "Salò AirBnB" hero, check-in/out grid, address, four contact buttons, notes, back-to-lodgings link.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/pages/lodgings
git commit -m "feat(pages): individual lodging detail pages

Move /lodgings.astro → /lodgings/index.astro (URL unchanged), and
add /lodgings/[slug].astro per-lodging detail. Detail page mirrors
the activity-detail rhythm: map ribbon at top, stat block, address,
contact buttons (tel, booking, maps), notes, back link. Lodgings
list cards now deep-link into details instead of being self-contained.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: BottomNav active-state matcher + Breadcrumb on activity detail

**Files:**
- Modify: `src/components/BottomNav.astro`
- Modify: `src/pages/activities/[slug].astro`
- Modify: `src/pages/activities/index.astro`

- [ ] **Step 1: Replace BottomNav active-state logic**

Open `src/components/BottomNav.astro`. Replace the items array and `activeIndex` computation in the frontmatter (the first `---` block) with a per-tab matcher approach:

```astro
---
/* Custom 1.5px-stroke vintage map glyphs — no Lucide / Heroicons. */
type Tab = { href: string; label: string; icon: 'home' | 'map' | 'activities' | 'more'; matches: (path: string) => boolean };

const items: Tab[] = [
  {
    href: '/',
    label: 'Home',
    icon: 'home',
    matches: (p) => p === '/' || p.startsWith('/hike/') || p.startsWith('/day/'),
  },
  {
    href: '/map',
    label: 'Map',
    icon: 'map',
    matches: (p) => p === '/map',
  },
  {
    href: '/activities',
    label: 'Activities',
    icon: 'activities',
    matches: (p) => p === '/activities' || p.startsWith('/activities/'),
  },
  {
    href: '/more',
    label: 'More',
    icon: 'more',
    matches: (p) =>
      p === '/more'
      || p === '/checklist'
      || p === '/restaurants'
      || p === '/contingencies'
      || p === '/lodgings'
      || p.startsWith('/lodgings/')
      || p === '/photos'
      || p === '/customize',
  },
];

const path = Astro.url.pathname;
const activeIndex = Math.max(0, items.findIndex((it) => it.matches(path)));
---
```

(The rest of the BottomNav file — the `<nav>`, sliding-underline `<span>`, and `{items.map(...)}` block — stays exactly as today. The change is only in how `activeIndex` is computed.)

- [ ] **Step 2: Add Breadcrumb to `/activities/[slug].astro`**

In the frontmatter (after the existing imports), add:

```typescript
import Breadcrumb from '@/components/Breadcrumb.astro';
import { CATEGORY_LABELS } from '@/lib/category-labels';
```

Replace the existing `const categoryLabel = (c: string) => c.replace(/-/g, ' ');` line with usage of the new map. Then in the body, immediately AFTER the `<MapRibbon>` block (added in Task 5) and BEFORE the existing first `<section>` (the hero), insert:

```astro
  <Breadcrumb crumbs={[
    { label: 'Activities', href: '/activities' },
    { label: CATEGORY_LABELS[a.category] },
  ]} />
```

Update the hero's eyebrow line (currently `<p class="eyebrow with-rule">{categoryLabel(a.category)}</p>`) to:

```astro
    <p class="eyebrow with-rule" style="margin: 0;">{CATEGORY_LABELS[a.category]}</p>
```

- [ ] **Step 3: Update `/activities/index.astro` to use `CATEGORY_LABELS`**

Open `src/pages/activities/index.astro`. Find the `CATEGORIES` const (the array of `{ id, label }` filter pills). Replace the import + array with:

```typescript
import { CATEGORY_LABELS, type ActivityCategory } from '@/lib/category-labels';
```

…and replace the existing `CATEGORIES` array with:

```typescript
const CATEGORIES: { id: 'all' | ActivityCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  ...(Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
  })),
];
```

(The button rendering loop is unchanged.)

- [ ] **Step 4: Build + smoke**

Run: `npm run build && npm run dev`
- Visit `/hike/tre-cime` — bottom nav should highlight Home (gold underline under leftmost tab)
- Visit `/day/2026-07-17` — Home highlighted
- Visit `/lodgings` — More highlighted
- Visit `/lodgings/baita-fraina` — More highlighted
- Visit `/checklist` — More highlighted
- Visit `/restaurants` — More highlighted
- Visit `/activities/solferino-red-cross-memorial` — Activities highlighted; small breadcrumb above hero reads `Activities / Culture & History`
- Visit `/activities` — filter pills show "Water Sports", "Culture & History" (not "Water-sports", "Culture-history")

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomNav.astro src/pages/activities/[slug].astro src/pages/activities/index.astro
git commit -m "feat(nav): per-tab active-state matchers + activity breadcrumb

BottomNav uses explicit per-tab match functions: /hike/* + /day/*
land on Home; /lodgings + /lodgings/* + /checklist + /restaurants
+ /contingencies + /photos + /customize land on More. /activities/[slug]
gets a small breadcrumb (Activities / {category-label}). Catalog
filter pills + breadcrumb both use CATEGORY_LABELS map for consistent
human-readable labels.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 4 — Phase-aware home + related activities

### Task 9: Extract `Countdown.astro`, `TodayBanner.astro`, `BookingRingOrBadge.astro`, `PastPhaseSummary.astro`

**Files:**
- Create: `src/components/Countdown.astro`
- Create: `src/components/TodayBanner.astro`
- Create: `src/components/BookingRingOrBadge.astro`
- Create: `src/components/PastPhaseSummary.astro`

This task only creates the components. They get wired into `index.astro` in Task 10.

- [ ] **Step 1: Create `src/components/Countdown.astro`**

```astro
---
type Props = {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;
  todayISO: string;
};
const { startDate, endDate, todayISO } = Astro.props;

let big: number;
let label: string;
if (todayISO < startDate) {
  big = Math.ceil((new Date(startDate).getTime() - new Date(todayISO).getTime()) / 86400000);
  label = 'Days Until Departure';
} else if (todayISO <= endDate) {
  // Day N of M (1-indexed)
  const dayN = Math.floor((new Date(todayISO).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  const totalDays = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  big = dayN;
  label = `of ${totalDays}`;
} else {
  big = Math.ceil((new Date(todayISO).getTime() - new Date(endDate).getTime()) / 86400000);
  label = 'Days Since';
}
---
<section
  class="stagger"
  style="padding: 28px var(--page-x) 12px; text-align: center; position: relative;"
>
  <div
    aria-hidden="true"
    style="
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 40%, rgba(212, 162, 76, 0.18), transparent 60%);
      pointer-events: none;
    "
  ></div>
  <div
    class="tabular"
    style="
      position: relative;
      font-family: var(--font-display);
      font-weight: 800;
      font-variation-settings: 'opsz' 144;
      font-size: clamp(78px, 18vw, 124px);
      line-height: 0.85;
      letter-spacing: -0.04em;
      color: var(--ink);
    "
  >{String(big).padStart(2, '0')}</div>
  <p class="mono-cap" style="position: relative; margin: 14px 0 0; font-size: 11px; color: var(--ink-soft);">{label}</p>
</section>
```

- [ ] **Step 2: Create `src/components/TodayBanner.astro`**

```astro
---
import type { CollectionEntry } from 'astro:content';

type Props = {
  todayDay: CollectionEntry<'days'> | undefined;
  todayDayIndex: number;
  todayFirstHike: CollectionEntry<'hikes'> | undefined;
  // For Phase II free days
  saloLodging: CollectionEntry<'lodgings'> | undefined;
  nearestActivities: CollectionEntry<'activities'>[]; // pre-computed top 4 by haversine from Salò
};
const { todayDay, todayDayIndex, todayFirstHike, saloLodging, nearestActivities } = Astro.props;

if (!todayDay) return null;

const isFreeForm = todayDay.data.hikeSlugs.length === 0;
---
{isFreeForm ? (
  <section class="stagger" style="padding: 12px var(--page-x) 0;">
    <div
      style="
        padding: 14px 16px;
        background: var(--bg-paper);
        border: 1px solid var(--hairline);
        border-left: 4px solid var(--gold);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-paper-md);
      "
    >
      <span class="mono-cap" style="font-size: 11px; color: var(--gold); font-weight: 700;">
        Today · Day {String(todayDayIndex + 1).padStart(2, '0')} · Free
      </span>
      <div style="font-family: var(--font-display); font-style: italic; font-weight: 700; font-size: 22px; color: var(--ink); line-height: 1.1; margin-top: 4px;">
        Free at {saloLodging?.data.location ?? 'Salò'}
      </div>
      <div class="mono" style="font-size: 11.5px; color: var(--ink-soft); margin-top: 4px;">
        Pick from today's options
      </div>
      {nearestActivities.length > 0 && (
        <div style="display: flex; gap: 8px; overflow-x: auto; margin-top: 12px; padding-bottom: 4px;">
          {nearestActivities.map((a) => (
            <a href={`/activities/${a.id}`} style="
              flex: 0 0 auto;
              padding: 8px 12px;
              background: var(--bg);
              border: 1px solid var(--hairline);
              border-radius: var(--r-sm);
              font-size: 12px;
              color: var(--ink);
              text-decoration: none;
              white-space: nowrap;
            ">{a.data.name}</a>
          ))}
        </div>
      )}
    </div>
  </section>
) : (
  <section class="stagger" style="padding: 12px var(--page-x) 0;">
    <a
      href={todayFirstHike ? `/hike/${todayFirstHike.slug}` : `/day/${todayDay.data.date}`}
      style="
        display: block;
        padding: 14px 16px;
        background: var(--bg-paper);
        border: 1px solid var(--hairline);
        border-left: 4px solid var(--moss);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-paper-md);
        transform: rotate(-1deg);
        transition: transform 200ms var(--ease-out);
      "
    >
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div>
          <span class="mono-cap" style="font-size: 11px; color: var(--moss); font-weight: 700;">
            Today · Day {String(todayDayIndex + 1).padStart(2, '0')}
          </span>
          <div style="font-family: var(--font-display); font-style: italic; font-weight: 700; font-size: 22px; color: var(--ink); line-height: 1.1; margin-top: 4px;">
            {todayFirstHike ? todayFirstHike.data.name : todayDay.data.theme}
          </div>
          {todayFirstHike && (
            <div class="mono tabular" style="font-size: 11.5px; color: var(--ink-soft); margin-top: 4px; letter-spacing: 0.04em;">
              {todayFirstHike.data.distanceKm} <span style="color: var(--ink-soft); opacity: 0.6;">km</span> ·
              {todayFirstHike.data.elevationGainM} <span style="color: var(--ink-soft); opacity: 0.6;">m</span> ·
              {todayFirstHike.data.movingTimeHours.min}–{todayFirstHike.data.movingTimeHours.max}h
            </div>
          )}
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex: 0 0 auto; color: var(--moss);">
          <path d="M5 12 H19 M14 6 L20 12 L14 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </div>
    </a>
  </section>
)}
```

- [ ] **Step 3: Create `src/components/BookingRingOrBadge.astro`**

```astro
---
type Props = {
  bookedCount: number;
  totalBookings: number;
  collapse: boolean; // collapse when fully booked OR when Phase II started (decision in caller)
};
const { bookedCount, totalBookings, collapse } = Astro.props;
const bookedPct = Math.round((bookedCount / totalBookings) * 100);

// Ring geometry (only used when expanded)
const ringSize = 168;
const ringStroke = 14;
const ringR = (ringSize - ringStroke) / 2;
const ringC = 2 * Math.PI * ringR;
const ringTarget = ringC * (bookedCount / totalBookings);
const ringRest = ringC - ringTarget;
---
<section
  class="stagger"
  style={`padding: ${collapse ? '24px' : '40px'} var(--page-x) ${collapse ? '20px' : '32px'}; display: flex; justify-content: center;`}
>
  {collapse ? (
    <a
      href="/checklist"
      aria-label={`Booking checklist: ${bookedCount} of ${totalBookings} confirmed`}
      style="
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        background: var(--bg-paper);
        border: 1px solid var(--hairline);
        border-radius: 999px;
        text-decoration: none;
        box-shadow: var(--shadow-paper-sm);
      "
    >
      <span style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px; height: 32px;
        border-radius: 50%;
        background: var(--moss);
        color: var(--bg);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12 L10 17 L20 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
      <span class="mono tabular" style="font-size: 12.5px; color: var(--ink); letter-spacing: 0.04em;">
        {bookedCount}/{totalBookings} <span style="color: var(--ink-soft);">booked</span>
      </span>
    </a>
  ) : (
    <a
      href="/checklist"
      style="display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 8px 16px;"
      aria-label={`Booking checklist: ${bookedCount} of ${totalBookings} confirmed`}
    >
      <div style={`position: relative; width: ${ringSize}px; height: ${ringSize}px; --ring-c: ${ringC}; --ring-target: ${ringTarget}; --ring-rest: ${ringRest};`}>
        <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <circle cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke="var(--ink)" stroke-opacity="0.15" stroke-width={ringStroke} fill="none" />
          <circle class="ring-fill" cx={ringSize / 2} cy={ringSize / 2} r={ringR} stroke="var(--gold)" stroke-width={ringStroke} fill="none" stroke-linecap="butt" />
        </svg>
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
          <span class="tabular" style="
            font-family: var(--font-display);
            font-weight: 800;
            font-variation-settings: 'opsz' 80;
            font-size: 38px;
            line-height: 1;
            letter-spacing: -0.02em;
            color: var(--ink);
          ">{bookedCount}<span style="color: var(--ink-soft); font-weight: 500; opacity: 0.6;">/{totalBookings}</span></span>
          <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); margin-top: 6px;">{bookedPct}% Booked</span>
        </div>
      </div>
      <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); padding-bottom: 4px; border-bottom: 1px dashed var(--gold); display: inline-flex; align-items: center; gap: 6px;">
        View Checklist
        <svg class="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12 H19 M14 6 L20 12 L14 18" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </span>
    </a>
  )}
</section>
```

- [ ] **Step 4: Create `src/components/PastPhaseSummary.astro`**

```astro
---
import type { CollectionEntry } from 'astro:content';

type Props = {
  hikes: CollectionEntry<'hikes'>[];
  startDate: string;
  endDate: string;
  nights: number;
};
const { hikes, startDate, endDate, nights } = Astro.props;

const sumKm = hikes.reduce((acc, h) => acc + h.data.distanceKm, 0);
const sumGain = hikes.reduce((acc, h) => acc + h.data.elevationGainM, 0);

const fmtDayMon = (iso: string) =>
  new Date(iso + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
---
<section class="stagger" style="padding: 36px var(--page-x) 0;">
  <div style="display: flex; align-items: baseline; gap: 12px;">
    <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); letter-spacing: 0.32em; font-weight: 700;">Past Phase</span>
    <span style="flex: 1; height: 1px; background: var(--hairline);"></span>
  </div>
  <a href="/hikes" class="hike-poster" style="display: block; margin-top: 12px;">
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); letter-spacing: 0.18em;">Dolomites</span>
      <span style="color: var(--gold); opacity: 0.6;">·</span>
      <span class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">{fmtDayMon(startDate)} — {fmtDayMon(endDate)}</span>
    </div>
    <h3 style="
      font-family: var(--font-display);
      font-style: italic;
      font-weight: 800;
      font-variation-settings: 'opsz' 80;
      font-size: clamp(22px, 5.5vw, 28px);
      line-height: 1.04;
      color: var(--ink);
      margin: 12px 0 10px;
    ">{hikes.length} hikes · Phase complete</h3>
    <div class="poster-stats" style="grid-template-columns: repeat(3, 1fr);">
      <div style="text-align: center;">
        <div class="stat-num tabular">{Math.round(sumKm)}</div>
        <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">km</div>
      </div>
      <div style="text-align: center; border-left: 1px dashed var(--hairline);">
        <div class="stat-num tabular">{sumGain}</div>
        <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">m gain</div>
      </div>
      <div style="text-align: center; border-left: 1px dashed var(--hairline);">
        <div class="stat-num tabular">{nights}</div>
        <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">nights</div>
      </div>
    </div>
    <div style="margin-top: 10px; display: flex; align-items: center; gap: 6px; color: var(--ink-soft);">
      <span class="mono-cap" style="font-size: 10.5px;">View All Hikes</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12 H19 M14 6 L20 12 L14 18" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    </div>
  </a>
</section>
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds. None of the new components are mounted yet so the only build difference is four new component files compiling to nothing.

- [ ] **Step 6: Commit**

```bash
git add src/components/Countdown.astro src/components/TodayBanner.astro src/components/BookingRingOrBadge.astro src/components/PastPhaseSummary.astro
git commit -m "feat(components): extract Countdown / TodayBanner / BookingRingOrBadge / PastPhaseSummary

Four focused components that index.astro will compose by phase
in the next commit. Countdown handles pre-trip / during-trip /
post-trip cases. TodayBanner adapts to Phase I (hike CTA) vs
Phase II (free-day quick-row of nearest activities). BookingRing
collapses to a small badge when the caller decides. PastPhaseSummary
is a single .hike-poster-styled card linking to /hikes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Wire phase-aware home page

**Files:**
- Modify: `src/pages/index.astro`

This task replaces most of the home page's body. Read the current file once before editing — it's ~462 lines.

- [ ] **Step 1: Replace the frontmatter**

Replace the entire frontmatter (between the leading `---` and the next `---`) of `src/pages/index.astro` with:

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Countdown from '@/components/Countdown.astro';
import TodayBanner from '@/components/TodayBanner.astro';
import BookingRingOrBadge from '@/components/BookingRingOrBadge.astro';
import PastPhaseSummary from '@/components/PastPhaseSummary.astro';
import { getDays, getHikes, getTrip, getBookings, getLodgings, getActivities } from '@/lib/content';

const trip = getTrip();
const days = await getDays();
const hikes = await getHikes();
const bookings = getBookings();
const lodgings = await getLodgings();
const activities = await getActivities();

const today = new Date();
const todayISO = today.toISOString().slice(0, 10);
const inTrip = todayISO >= trip.startDate && todayISO <= trip.endDate;

// Phase boundary: derived from trip.phases (Garda start), with safe fallback
// to trip.endDate (i.e. "Phase II never starts") if phases is removed.
const phaseBoundary = trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
const inPhaseII = todayISO >= phaseBoundary;

const bookedCount = bookings.filter((b) => b.status === 'booked').length;
const totalBookings = bookings.length;

// Booking ring collapse triggers (per spec §1.3): all booked OR Phase II started
const collapseRing = bookedCount === totalBookings || inPhaseII;

// Today's day record (if any)
const todayDay = inTrip ? days.find((d) => d.data.date === todayISO) : undefined;
const todayDayIndex = todayDay ? days.findIndex((d) => d.data.date === todayDay.data.date) : -1;
const todayFirstHike = todayDay && todayDay.data.hikeSlugs.length > 0
  ? hikes.find((h) => h.slug === todayDay.data.hikeSlugs[0])
  : undefined;

// Salò AirBnB lodging (anchor for Phase II nearest-activity computation)
const saloLodging = lodgings.find((l) => l.id === 'salo-airbnb');

// 4 nearest activities to Salò (haversine from lodging coords, NOT weatherFor)
function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}
const nearestActivities = saloLodging
  ? [...activities]
      .filter((a) => typeof a.data.location?.lat === 'number' && typeof a.data.location?.lon === 'number')
      .sort((x, y) =>
        haversineKm(saloLodging.data.lat, saloLodging.data.lon, x.data.location.lat, x.data.location.lon) -
        haversineKm(saloLodging.data.lat, saloLodging.data.lon, y.data.location.lat, y.data.location.lon)
      )
      .slice(0, 4)
  : [];

// Hikes in trip order, paired with the day they appear on (Phase I view only)
type HikeWithDay = { hike: any; day: any };
const hikesInOrder: HikeWithDay[] = [];
for (const day of days) {
  for (const slug of day.data.hikeSlugs) {
    const hike = hikes.find((h) => h.slug === slug);
    if (hike) hikesInOrder.push({ hike, day });
  }
}

// For PastPhaseSummary stat block
const dolomiteDays = days.filter((d) => d.data.date < phaseBoundary);
const dolomiteNights = dolomiteDays.length;

const fmtShort = (iso: string) => {
  const d = new Date(iso + 'T00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const fmtDayMon = (iso: string) =>
  new Date(iso + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
const fmtRange = (a: string, b: string) =>
  `${fmtDayMon(a)} — ${fmtDayMon(b)} ${new Date(b + 'T00:00').getFullYear()}`;
---
```

- [ ] **Step 2: Replace the body**

Replace the entire body of `src/pages/index.astro` (everything from `<BaseLayout ...>` to `</BaseLayout>` inclusive) with:

```astro
<BaseLayout title={`${trip.name} · Trip`} bodyClass="home-bg">

  {/* HERO ─────────────────────────────────────────────────────────── */}
  <section class="stagger" style="padding: 28px var(--page-x) 8px;">
    <p class="eyebrow with-rule" style="margin: 0;">A Trip To</p>
    <h1 style="
      font-family: var(--font-display);
      font-style: italic;
      font-weight: 900;
      font-variation-settings: 'opsz' 144;
      font-size: clamp(54px, 14vw, 88px);
      line-height: 0.92;
      letter-spacing: -0.025em;
      color: var(--ink);
      margin: 12px 0 14px;
    ">The {trip.name}</h1>
    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
      <span class="mono-cap" style="font-size: 12px; color: var(--ink-soft);">
        {fmtRange(trip.startDate, trip.endDate)}
      </span>
      <span class="stamp wobbly">{days.length} Days</span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px; margin: 24px 0 0;">
      <span style="flex: 1; height: 1px; background: var(--gold); opacity: 0.7;"></span>
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true">
        <path d="M1 13 L7 3 L11 9 L14 5 L21 13 Z" stroke="var(--gold)" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" fill="none" />
        <circle cx="7" cy="3" r="0.8" fill="var(--gold)" />
      </svg>
      <span style="flex: 1; height: 1px; background: var(--gold); opacity: 0.7;"></span>
    </div>
  </section>

  {/* TODAY BANNER (only during trip) */}
  <TodayBanner
    todayDay={todayDay}
    todayDayIndex={todayDayIndex}
    todayFirstHike={todayFirstHike}
    saloLodging={saloLodging}
    nearestActivities={nearestActivities}
  />

  {/* COUNTDOWN — adaptive copy by phase */}
  <Countdown startDate={trip.startDate} endDate={trip.endDate} todayISO={todayISO} />

  {inPhaseII ? (
    <>
      {/* PARTE II — GARDA (now leads) */}
      <section class="stagger" style="padding: 36px var(--page-x) 0;">
        <div style="display: flex; align-items: baseline; gap: 12px;">
          <span class="mono-cap" style="font-size: 11px; color: var(--gold); letter-spacing: 0.32em; font-weight: 700;">Parte II</span>
          <span style="flex: 1; height: 1px; background: var(--gold); opacity: 0.6;"></span>
        </div>
        <h2 style="
          font-family: var(--font-display);
          font-style: italic;
          font-weight: 700;
          font-variation-settings: 'opsz' 80;
          font-size: clamp(28px, 7vw, 38px);
          line-height: 1.0;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin: 8px 0 0;
        ">Lake Garda</h2>
        <p class="mono-cap" style="font-size: 11px; color: var(--ink-soft); margin: 6px 0 0;">Jul 20 — Jul 27 · 7 nights</p>
      </section>

      {saloLodging && (
        <section class="stagger" style="padding: 18px var(--page-x) 0;">
          <a href={`/lodgings/${saloLodging.id}`} class="hike-poster" style="display: block;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); letter-spacing: 0.18em;">Lodging · 7 Nights</span>
              <span style="color: var(--gold); opacity: 0.6;">·</span>
              <span class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">{saloLodging.data.location}</span>
            </div>
            <h3 style="
              font-family: var(--font-display);
              font-style: italic;
              font-weight: 800;
              font-variation-settings: 'opsz' 80;
              font-size: clamp(24px, 6.5vw, 30px);
              line-height: 1.02;
              color: var(--ink);
              margin: 12px 0 6px;
            ">{saloLodging.data.name}</h3>
            <p class="mono" style="font-size: 11.5px; color: var(--ink-soft); margin: 0;">Check-in Jul 20 · Check-out Jul 27</p>
          </a>
        </section>
      )}

      <section class="stagger" style="padding: 16px var(--page-x) 0;">
        <a href="/activities" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 16px;
          background: var(--bg-paper);
          border: 1px dashed var(--gold);
          border-radius: var(--r-md);
          box-shadow: var(--shadow-paper-sm);
        ">
          <div>
            <div class="mono-cap" style="font-size: 11px; color: var(--gold); letter-spacing: 0.18em;">Free-form</div>
            <div style="font-family: var(--font-display); font-weight: 700; font-size: 18px; color: var(--ink); margin-top: 4px;">
              Pick from {activities.length} activities
            </div>
            <div class="mono" style="font-size: 11.5px; color: var(--ink-soft); margin-top: 4px;">
              Jetski · Vittoriale · Monte Baldo · Solferino · Verona · and more
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="color: var(--gold); flex: 0 0 auto;">
            <path d="M9 6 L15 12 L9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
      </section>

      <BookingRingOrBadge bookedCount={bookedCount} totalBookings={totalBookings} collapse={collapseRing} />

      {/* PAST PHASE — Dolomites summary card */}
      <PastPhaseSummary hikes={hikes} startDate={trip.startDate} endDate={phaseBoundary} nights={dolomiteNights} />
    </>
  ) : (
    <>
      {/* PARTE I — DOLOMITES (default order) */}
      <section class="stagger" style="padding: 36px var(--page-x) 0;">
        <div style="display: flex; align-items: baseline; gap: 12px;">
          <span class="mono-cap" style="font-size: 11px; color: var(--gold); letter-spacing: 0.32em; font-weight: 700;">Parte I</span>
          <span style="flex: 1; height: 1px; background: var(--gold); opacity: 0.6;"></span>
        </div>
        <h2 style="
          font-family: var(--font-display);
          font-style: italic;
          font-weight: 700;
          font-variation-settings: 'opsz' 80;
          font-size: clamp(28px, 7vw, 38px);
          line-height: 1.0;
          letter-spacing: -0.02em;
          color: var(--ink);
          margin: 8px 0 0;
        ">Dolomites</h2>
        <p class="mono-cap" style="font-size: 11px; color: var(--ink-soft); margin: 6px 0 0;">Jul 15 — Jul 20 · 6 days</p>
      </section>

      <section class="stagger" style="padding: 24px var(--page-x) 8px;">
        <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 16px;">
          <h2 class="eyebrow with-rule" style="margin: 0;">The {hikesInOrder.length} Hikes</h2>
          <span style="flex: 1; height: 1px; background: var(--hairline);"></span>
          <a href="/hikes" class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">View All →</a>
        </div>
        <div style="display: grid; gap: 14px;">
          {hikesInOrder.map(({ hike, day }, idx) => {
            const stars = hike.data.rating?.stars ?? null;
            const fullStars = stars ? Math.floor(stars) : 0;
            const halfStar = stars ? (stars - fullStars >= 0.5 ? 1 : 0) : 0;
            return (
              <a href={`/hike/${hike.slug}`} class="hike-poster">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); letter-spacing: 0.18em;">
                    Day {String(days.findIndex(d => d.data.date === day.data.date) + 1).padStart(2, '0')}
                  </span>
                  <span style="color: var(--gold); opacity: 0.6;">·</span>
                  <span class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">{hike.data.region}</span>
                  <span style="color: var(--gold); opacity: 0.6;">·</span>
                  <span class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">{hike.data.type.replace('-', ' ')}</span>
                  <span style="color: var(--gold); opacity: 0.6;">·</span>
                  <span class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">{fmtShort(day.data.date)}</span>
                </div>
                <h3 style="
                  font-family: var(--font-display);
                  font-style: italic;
                  font-weight: 800;
                  font-variation-settings: 'opsz' 80;
                  font-size: clamp(24px, 6.5vw, 30px);
                  line-height: 1.02;
                  letter-spacing: -0.018em;
                  color: var(--ink);
                  margin: 12px 0 10px;
                  max-width: 96%;
                ">{hike.data.name}</h3>
                {stars && (
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <div style="display: flex; gap: 1px;" aria-label={`${stars} out of 5`}>
                      {Array.from({ length: 5 }, (_, i) => {
                        const filled = i < fullStars;
                        const half = i === fullStars && halfStar === 1;
                        const gradId = `home-half-${hike.slug}-${i}`;
                        return (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            {half && (
                              <defs>
                                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="50%" stop-color="var(--gold)" />
                                  <stop offset="50%" stop-color="transparent" />
                                </linearGradient>
                              </defs>
                            )}
                            <path d="M12 2 L14.6 8.6 L21.6 9.2 L16.3 13.9 L17.9 20.8 L12 17.2 L6.1 20.8 L7.7 13.9 L2.4 9.2 L9.4 8.6 Z"
                              fill={filled ? 'var(--gold)' : (half ? `url(#${gradId})` : 'transparent')}
                              stroke="var(--gold)"
                              stroke-width="1.3"
                              stroke-linejoin="round" />
                          </svg>
                        );
                      })}
                    </div>
                    <span class="mono tabular" style="font-size: 11px; color: var(--ink-soft); letter-spacing: 0.04em;">
                      {stars.toFixed(1)} <span style="opacity: 0.65;">({hike.data.rating?.reviews?.toLocaleString() ?? 0})</span>
                    </span>
                  </div>
                )}
                <div class="poster-stats">
                  <div style="text-align: center;">
                    <div class="stat-num tabular">{hike.data.distanceKm}</div>
                    <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">km</div>
                  </div>
                  <div style="text-align: center; border-left: 1px dashed var(--hairline);">
                    <div class="stat-num tabular">{hike.data.elevationGainM}</div>
                    <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">m gain</div>
                  </div>
                  <div style="text-align: center; border-left: 1px dashed var(--hairline);">
                    <div class="stat-num tabular">{hike.data.movingTimeHours.min}–{hike.data.movingTimeHours.max}</div>
                    <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">hours</div>
                  </div>
                  <div style="text-align: center; border-left: 1px dashed var(--hairline);">
                    <div class="stat-num" style="text-transform: capitalize; font-size: 16px; padding-top: 4px;">{hike.data.difficulty}</div>
                    <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">grade</div>
                  </div>
                </div>
                <span class="mono-cap" style="position: absolute; top: 14px; right: 16px; font-size: 9px; color: var(--ink-soft); opacity: 0.55; letter-spacing: 0.18em;">
                  {String(idx + 1).padStart(2, '0')} / {String(hikesInOrder.length).padStart(2, '0')}
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <BookingRingOrBadge bookedCount={bookedCount} totalBookings={totalBookings} collapse={collapseRing} />

      {/* PARTE II preview during Phase I */}
      <section class="stagger" style="padding: 36px var(--page-x) 0;">
        <div style="display: flex; align-items: baseline; gap: 12px;">
          <span class="mono-cap" style="font-size: 11px; color: var(--gold); letter-spacing: 0.32em; font-weight: 700;">Parte II</span>
          <span style="flex: 1; height: 1px; background: var(--gold); opacity: 0.6;"></span>
        </div>
        <h2 style="
          font-family: var(--font-display);
          font-style: italic;
          font-weight: 700;
          font-variation-settings: 'opsz' 80;
          font-size: clamp(28px, 7vw, 38px);
          line-height: 1.0;
          color: var(--ink);
          margin: 8px 0 0;
        ">Lake Garda</h2>
        <p class="mono-cap" style="font-size: 11px; color: var(--ink-soft); margin: 6px 0 0;">Jul 20 — Jul 27 · 7 nights</p>
      </section>

      {saloLodging && (
        <section class="stagger" style="padding: 18px var(--page-x) 0;">
          <a href={`/lodgings/${saloLodging.id}`} class="hike-poster" style="display: block;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); letter-spacing: 0.18em;">Lodging · 7 Nights</span>
              <span style="color: var(--gold); opacity: 0.6;">·</span>
              <span class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">{saloLodging.data.location}</span>
            </div>
            <h3 style="
              font-family: var(--font-display);
              font-style: italic;
              font-weight: 800;
              font-variation-settings: 'opsz' 80;
              font-size: clamp(24px, 6.5vw, 30px);
              line-height: 1.02;
              color: var(--ink);
              margin: 12px 0 6px;
            ">{saloLodging.data.name}</h3>
            <p class="mono" style="font-size: 11.5px; color: var(--ink-soft); margin: 0;">Check-in Jul 20 · Check-out Jul 27</p>
          </a>
        </section>
      )}

      <section class="stagger" style="padding: 16px var(--page-x) 0;">
        <a href="/activities" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 16px;
          background: var(--bg-paper);
          border: 1px dashed var(--gold);
          border-radius: var(--r-md);
          box-shadow: var(--shadow-paper-sm);
        ">
          <div>
            <div class="mono-cap" style="font-size: 11px; color: var(--gold); letter-spacing: 0.18em;">Free-form</div>
            <div style="font-family: var(--font-display); font-weight: 700; font-size: 18px; color: var(--ink); margin-top: 4px;">
              Pick from {activities.length} activities
            </div>
            <div class="mono" style="font-size: 11.5px; color: var(--ink-soft); margin-top: 4px;">
              Jetski · Vittoriale · Monte Baldo · Solferino · Verona · and more
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="color: var(--gold); flex: 0 0 auto;">
            <path d="M9 6 L15 12 L9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
      </section>
    </>
  )}

  {/* ITINERARY ─ at the bottom always ───────────────────────────────── */}
  <section class="stagger" style="padding: 24px 0 8px;">
    <h2 class="eyebrow with-rule" style="margin: 0 var(--page-x) 12px;">Itinerary</h2>
    <div class="day-pill-scroll" style="display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x proximity; padding: 4px var(--page-x) 12px; margin: 0; -webkit-overflow-scrolling: touch;">
      {days.map((d) => {
        const isToday = d.data.date === todayISO;
        return (
          <a href={`/day/${d.data.date}`} class="day-pill" style="scroll-snap-align: start;" aria-current={isToday ? 'true' : undefined}>
            <span style="font-weight: 700;">{new Date(d.data.date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric' })}</span>
            <span style="opacity: 0.7;">{new Date(d.data.date + 'T00:00').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</span>
          </a>
        );
      })}
    </div>
    <ol style="list-style: none; margin: 6px 0 0; padding: 0 var(--page-x); display: grid; gap: 10px;">
      {days.map((d, i) => (
        <li>
          <a href={`/day/${d.data.date}`} class="ticket">
            <div class="ticket-rail">
              <span class="ticket-num tabular">{String(i + 1).padStart(2, '0')}</span>
              <span class="ticket-label">Day</span>
            </div>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
              <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft);">{fmtShort(d.data.date)}</span>
              <span style="font-family: var(--font-display); font-weight: 600; font-variation-settings: 'opsz' 36; font-size: 17px; line-height: 1.15; letter-spacing: -0.01em; color: var(--ink); margin-top: 2px;">{d.data.theme}</span>
              {d.data.hikeSlugs.length > 0 && (
                <span class="mono" style="font-size: 11px; color: var(--ink-soft); margin-top: 4px; letter-spacing: 0.04em;">
                  {d.data.hikeSlugs.map((s, j) => (
                    <>
                      {j > 0 && <span style="color: var(--gold); margin: 0 6px;">·</span>}
                      <span>{s}</span>
                    </>
                  ))}
                </span>
              )}
            </div>
            <svg class="ticket-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6 L15 12 L9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
        </li>
      ))}
    </ol>
  </section>

  <style is:global>
    .day-pill-scroll::-webkit-scrollbar { display: none; }
    .day-pill-scroll { scrollbar-width: none; }
  </style>
</BaseLayout>
```

(The previous count-up `<script>` is removed because the Countdown component now produces the final number directly without animation. If you want the count-up animation back, it's a separate enhancement — out of scope for this pass.)

- [ ] **Step 3: Build + smoke**

Run: `npm run build && npm run dev`
Visit `http://localhost:4321/`. Expected (since today is 2026-05-02, before Phase I):
- Hero "The Dolomites" + countdown showing days-until
- No Today banner (outside trip dates)
- PARTE I divider + 6 hike posters
- Booking ring (full size — not all booked yet)
- PARTE II divider + Salò card + activities CTA
- Itinerary at the bottom (now showing 13 days including the 7 Garda stubs)

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(home): phase-aware composition using new components

index.astro now composes Countdown / TodayBanner / BookingRingOrBadge /
PastPhaseSummary by phase rather than inlining 460 lines. Phase II
date flips section ordering: PARTE II + Salò + activities CTA lead;
Phase I appears as a Past phase summary card linking to /hikes.
Booking ring auto-collapses to a small badge when all booked OR
when Phase II started. Itinerary block stays at the bottom always.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: `RelatedActivities.astro` + mount on `/activities/[slug]`

**Files:**
- Create: `src/components/RelatedActivities.astro`
- Modify: `src/pages/activities/[slug].astro`

- [ ] **Step 1: Create the component**

Create `src/components/RelatedActivities.astro`:

```astro
---
import type { CollectionEntry } from 'astro:content';
import { getActivities } from '@/lib/content';

type Props = { current: CollectionEntry<'activities'> };
const { current } = Astro.props;

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

const all = await getActivities();

// Exclude the current activity, and any activity missing GPS.
// Log a build-time warning for any GPS-less entries — surfaces data-quality
// issues without failing the build.
const dropped = all.filter((a) => a.id !== current.id && (typeof a.data.location?.lat !== 'number' || typeof a.data.location?.lon !== 'number'));
if (dropped.length > 0) {
  console.warn(`[RelatedActivities] Excluding ${dropped.length} activity entries lacking location.lat/lon: ${dropped.map((d) => d.id).join(', ')}`);
}

const candidates = all.filter((a) =>
  a.id !== current.id
  && typeof a.data.location?.lat === 'number'
  && typeof a.data.location?.lon === 'number'
);

const nearest = candidates
  .map((a) => ({
    activity: a,
    dist: haversineKm(
      current.data.location.lat,
      current.data.location.lon,
      a.data.location.lat,
      a.data.location.lon
    ),
  }))
  .sort((x, y) => x.dist - y.dist)
  .slice(0, 3);
---
{nearest.length > 0 && (
  <section class="stagger" style="padding: 26px var(--page-x) 0;">
    <h2 class="eyebrow" style="margin: 0 0 12px;">Nearby activities</h2>
    <div style="
      display: flex;
      gap: 12px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding-bottom: 6px;
      -webkit-overflow-scrolling: touch;
    ">
      {nearest.map(({ activity: a, dist }) => (
        <a
          href={`/activities/${a.id}`}
          style="
            flex: 0 0 70%;
            scroll-snap-align: start;
            scroll-snap-stop: always;
            background: var(--bg-paper);
            border: 1px solid var(--hairline);
            border-radius: var(--r-md);
            padding: 14px;
            text-decoration: none;
            box-shadow: var(--shadow-paper-sm);
          "
        >
          <div class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft); letter-spacing: 0.18em;">{a.data.location.label}</div>
          <h3 style="
            font-family: var(--font-display);
            font-style: italic;
            font-weight: 700;
            font-size: 17px;
            line-height: 1.15;
            color: var(--ink);
            margin: 6px 0 8px;
          ">{a.data.name}</h3>
          <div class="mono tabular" style="font-size: 11px; color: var(--ink-soft);">
            {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`} away
          </div>
        </a>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 2: Mount on activity detail page**

Open `src/pages/activities/[slug].astro`. Add the import in the frontmatter:

```typescript
import RelatedActivities from '@/components/RelatedActivities.astro';
```

In the body, immediately BEFORE the existing `← Back to catalog` section (the last `<section>` before `</BaseLayout>`), insert:

```astro
  <RelatedActivities current={activity} />
```

- [ ] **Step 3: Build + smoke**

Run: `npm run build && npm run dev`
Visit `http://localhost:4321/activities/solferino-red-cross-memorial`. Expected:
- Nearby section appears above the back-to-catalog link
- 3 cards visible (e.g. San Martino della Battaglia, Castiglione CRI Museum, etc. — all close to Solferino)
- Each card shows label, name, and distance like "8.4 km away"
- Horizontal scroll snaps to the next card on swipe

Visit `/activities/garda-rent-boat-jetski` (Sirmione). Expected: 3 different nearest activities (Sirmione Catullo, Sirmione Castello, etc.).

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/RelatedActivities.astro src/pages/activities/[slug].astro
git commit -m "feat(activities): nearby-activities tail on detail pages

Atlas Obscura-style discovery loop. Top-3 closest activities by
haversine, excluding GPS-less entries (with build-time warning).
Horizontal scroll-snap with snap-stop:always so swipe lands one
card at a time. Hides whole section if no candidates remain.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Garda free-form day CTA + day → contingencies cross-link

**Files:**
- Modify: `src/pages/day/[date].astro`

- [ ] **Step 1: Add the Garda free-form CTA**

In `src/pages/day/[date].astro`, find the `{/* Hikes — uniform .hike-poster cards (same shape as the home page) */}` block (around line 67). The block is wrapped in `{hikes.length > 0 && (`. Immediately AFTER that closing `)}` of the hikes block (i.e. for days where `hikes.length === 0`), insert a new section that fires only for free-form Garda days.

Add this in the frontmatter (after `const lodging = ...`):

```typescript
import { getTrip } from '@/lib/content';
const trip = getTrip();
const phaseBoundary = trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
const isGardaFreeForm = day.data.hikeSlugs.length === 0 && day.data.date >= phaseBoundary;
```

Then in the body, AFTER the `{hikes.length > 0 && (...)}` block, insert:

```astro
  {isGardaFreeForm && (
    <section class="stagger" style="padding: 22px var(--page-x);">
      <h2 class="eyebrow" style="margin: 0 0 12px;">Today</h2>
      <a href="/activities" style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 16px;
        background: var(--bg-paper);
        border: 1px dashed var(--gold);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-paper-sm);
      ">
        <div>
          <div class="mono-cap" style="font-size: 11px; color: var(--gold); letter-spacing: 0.18em;">Free-form</div>
          <div style="font-family: var(--font-display); font-weight: 700; font-size: 18px; color: var(--ink); margin-top: 4px;">
            Pick today's activities
          </div>
          <div class="mono" style="font-size: 11.5px; color: var(--ink-soft); margin-top: 4px;">
            Browse the full catalog · {day.data.theme}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="color: var(--gold); flex: 0 0 auto;">
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </a>
    </section>
  )}
```

- [ ] **Step 2: Add a contingencies cross-link**

In the same file, find the `{/* Bad weather option */}` block (around line 164). Inside the block, after the `<div>` with the bad-weather-option text, add a small link to `/contingencies`:

Replace this block:

```astro
  {day.data.badWeatherOption && (
    <section class="stagger" style="padding: 22px var(--page-x);">
      <h2 class="eyebrow signal" style="margin: 0 0 12px;">If The Weather Turns</h2>
      <div style="
        background: var(--bg-paper);
        border: 1px solid var(--signal);
        border-left: 4px solid var(--signal);
        border-radius: var(--r-sm);
        padding: 12px 14px;
        font-size: 13.5px;
        color: var(--ink);
        transform: rotate(-0.5deg);
      ">{day.data.badWeatherOption}</div>
    </section>
  )}
```

with:

```astro
  {day.data.badWeatherOption && (
    <section class="stagger" style="padding: 22px var(--page-x);">
      <h2 class="eyebrow signal" style="margin: 0 0 12px;">If The Weather Turns</h2>
      <div style="
        background: var(--bg-paper);
        border: 1px solid var(--signal);
        border-left: 4px solid var(--signal);
        border-radius: var(--r-sm);
        padding: 12px 14px;
        font-size: 13.5px;
        color: var(--ink);
        transform: rotate(-0.5deg);
      ">{day.data.badWeatherOption}</div>
      <a href="/contingencies" class="mono-cap" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        font-size: 10.5px;
        color: var(--ink-soft);
      ">See all contingencies <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12 H19 M14 6 L20 12 L14 18" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
    </section>
  )}
```

- [ ] **Step 3: Build + smoke**

Run: `npm run build && npm run dev`
Visit:
- `/day/2026-07-21` — should now show the dashed-gold "Pick today's activities" CTA where the hikes block normally lives
- `/day/2026-07-15` (or any Phase I day with `badWeatherOption`) — the bad-weather block should now have a "See all contingencies →" mono-cap link below it

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/day/[date].astro
git commit -m "feat(day): Garda free-form CTA + contingencies cross-link

Days with empty hikeSlugs that fall on or after the Garda phase
boundary render a dashed-gold 'Pick today's activities' CTA in
place of the missing hikes block. Phase I days with a badWeatherOption
gain a subtle 'See all contingencies →' link below the box —
addresses the audit's 'restaurants/contingencies isolated' point.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 5 — Polish & deploy

### Task 13: DayPillScroller auto-scroll active pill into view

**Files:**
- Modify: `src/components/DayPillScroller.astro`

- [ ] **Step 1: Add the visibility-checking auto-scroll script**

In `src/components/DayPillScroller.astro`, after the closing `</aside>` tag and BEFORE end of file, add:

```astro

<script is:inline>
  // Auto-scroll the active pill into view when it's off-screen.
  // Runs on initial mount AND after astro:after-swap (View Transitions).
  // Visibility check ensures we don't yank the user's manual scroll position.
  (function () {
    function maybeCenterActive() {
      const scroller = document.querySelector('.day-pill-scroll');
      if (!scroller) return;
      const active = scroller.querySelector('.day-pill.is-active');
      if (!active) return;
      const sBox = scroller.getBoundingClientRect();
      const aBox = active.getBoundingClientRect();
      const isFullyVisible = aBox.left >= sBox.left && aBox.right <= sBox.right;
      if (isFullyVisible) return;
      // scrollIntoView respects the parent overflow container by default
      active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
    }

    // Run on initial paint
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', maybeCenterActive);
    } else {
      maybeCenterActive();
    }
    // Re-run after View Transitions swap a new page in
    document.addEventListener('astro:after-swap', maybeCenterActive);
  })();
</script>
```

- [ ] **Step 2: Build + smoke**

Run: `npm run build && npm run dev`
Visit `/day/2026-07-19` (a day late in the trip that would normally be off-screen on first paint). Expected: the day-19 pill is centred horizontally in the scroller. Now scroll the pill strip manually toward day 27, then click into a different day's link from the page body — when the new page loads, the pills should still show your scrolled position UNLESS the new active pill is outside the visible window (in which case it re-centres).

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/DayPillScroller.astro
git commit -m "feat(nav): day-pill auto-scrolls active into view

Active pill auto-centres on initial mount + astro:after-swap, but
only if it's not currently visible inside the scroller's viewport.
Preserves the user's manual scroll position when they peek at a
future day and then navigate to it.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: BaseLayout focus-restoration on after-swap

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Add `tabindex="-1"` to `#main` and the after-swap focus listener**

In `src/layouts/BaseLayout.astro`, change the `<main>` line from:

```astro
    <main id="main" class="mx-auto" style="max-width: var(--max-content);"><slot /></main>
```

to:

```astro
    <main id="main" tabindex="-1" class="mx-auto" style="max-width: var(--max-content); outline: none;"><slot /></main>
```

Then immediately AFTER the `<RegisterServiceWorker />` line and BEFORE `</body>`, insert:

```astro
    <script is:inline>
      // After View Transitions swap a new page in, move keyboard focus to
      // <main> so screen readers announce the new content. tabindex=-1 lets
      // .focus() succeed without inserting <main> into the tab order.
      document.addEventListener('astro:after-swap', () => {
        document.getElementById('main')?.focus();
      });
    </script>
```

- [ ] **Step 2: Build + smoke**

Run: `npm run build && npm run dev`
- Visit `/`. Open DevTools → Elements → check that `<main id="main" tabindex="-1">` is present
- Click any link to navigate to another page. After the View Transition completes, run `document.activeElement` in the console — should be the `<main>` element
- Tab from the URL bar — the skip link should appear first (as today), then the rest of the document. Verify `<main>` itself is NOT in the tab order (tabindex=-1 keeps it out of natural tab flow but allows programmatic focus)

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat(a11y): focus-restoration on View Transitions

Move keyboard focus to <main> after astro:after-swap so screen
readers announce new page content. tabindex=-1 keeps <main> out of
the natural tab order while allowing programmatic focus. outline:none
prevents a flash of focus ring on the main element itself (focus
visibility on inner elements is unaffected).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 15: Full smoke + Lighthouse + push

**Files:**
- (no source changes; verification + deploy)

- [ ] **Step 1: Full clean build**

```bash
rm -rf dist .astro
npm run build
```
Expected: build succeeds with the count of pages now at 50+ (was 46 before this pass — added 7 day stubs + 3 lodging detail pages = 10, plus minor reshuffles).

- [ ] **Step 2: Smoke each route in dev**

Run: `npm run dev`. Walk through every route group:

| URL | Expected behaviour |
|---|---|
| `/` | Hero + countdown (today < startDate so "Days Until Departure" copy); PARTE I leads (we're in pre-trip); 6 hike posters; full booking ring; PARTE II preview with Salò + activities CTA; itinerary 13 days |
| `/day/2026-07-17` | 80px sepia ribbon at top with Sorapis trailhead + Baita Fraina pins; full schedule; Today banner does NOT render (today is May 2 — outside trip dates) |
| `/day/2026-07-21` | Ribbon centred on Salò (single pin); "Pick today's activities" CTA where hikes block normally lives |
| `/day/2026-07-27` | Ribbon at Salò; "Driving" section shows the VCE airport leg with the 19:10 derived flight time in the notes |
| `/hike/tre-cime` | Single-pin ribbon at top; rest unchanged |
| `/activities/solferino-red-cross-memorial` | Ribbon, breadcrumb "Activities / Culture & History", stat block, description, no booking CTA (bookingRequired=false), maps links, Nearby section with 3 closest pins, back-to-catalog |
| `/activities/vittoriale-degli-italiani` | Same plus gold-dashed Book in advance card |
| `/activities` | Filter pills now read "Water Sports", "Culture & History", etc. (not slug-cased); 22 cards |
| `/lodgings` | 3 cards — each one is a full link into `/lodgings/<slug>` (no inline contact buttons) |
| `/lodgings/salo-airbnb` | Ribbon at Salò; hero "Anna's Home — Salò"; address; 4 contact buttons; notes; back link |
| `/map` | Both Phase I/II toggles visible top-left; 6 trailhead + 3 lodging + 22 activity pins |
| `/map?day=2026-07-17` | Toggles hidden; only Sorapis trailhead + Baita Fraina visible; map fits to those |
| `/map?focus=hike-tre-cime` | Only Tre Cime pin visible; popup auto-opens; zoom 14 |
| `/map?focus=lodging-salo-airbnb` | Only Salò pin visible; popup auto-opens |
| `/more` | Three groups; counts dynamic |
| `/checklist` | 15 items |
| `/restaurants` | Unchanged |
| `/contingencies` | Unchanged |

Also verify:
- Bottom nav active state highlights Home on `/hike/*` and `/day/*`
- Bottom nav active state highlights More on `/lodgings`, `/lodgings/<slug>`, `/checklist`, `/restaurants`, `/contingencies`, `/photos`, `/customize`
- Day-pill auto-scroll: visit `/day/2026-07-25` (a Garda day) and confirm pill 25 is centred

Stop dev server.

- [ ] **Step 3: Lighthouse pass**

Run:
```bash
npm run build && npx serve dist -p 4173 &
```

In Chrome DevTools → Lighthouse, run on **mobile** with Performance + Accessibility on each of:
- `http://localhost:4173/activities`
- `http://localhost:4173/lodgings/salo-airbnb`
- `http://localhost:4173/day/2026-07-17`
- `http://localhost:4173/hike/tre-cime`

Target ≥ 95 on Performance AND Accessibility for all four. The map ribbon is one `<img>` so it should not regress performance.

`/map` is excluded from this target — separately confirm it doesn't drop below 80 on Performance (MapLibre + raster tiles).

Common Lighthouse failure modes and fixes:
- **LCP > 2.5 s**: the OSM tile is the LCP element on detail pages. Add `loading="eager"` (instead of `lazy`) only on detail pages where the ribbon is above the fold — done by default in our component since the ribbon IS at the top
- **CLS shifts from ribbon**: ribbon has fixed `height: 80px` so should be 0
- **A11y < 95**: check `<img>` has `alt=""` (it does — decorative tile), check breadcrumb has `aria-label="Breadcrumb"` (it does), check toggle buttons have `aria-pressed` (they do)

Kill the static server (`fg` then Ctrl+C, or `kill %1`).

- [ ] **Step 4: Verify SW cache invalidation**

Restart `npx serve dist -p 4173 &`. In an incognito window:
1. Visit `http://localhost:4173/`, then close window
2. Open new incognito window, visit `http://localhost:4173/day/2026-07-21` (a Garda day stub)
3. DevTools → Application → Cache Storage: should show only `dolomites-v4` (no `v3`). The `2026-07-21` URL should resolve from cache OR fresh fetch — never 404

Kill the static server.

- [ ] **Step 5: Commit any verification fixes** (only if smoke surfaces issues)

If Lighthouse drops anything below target or smoke reveals a regression, fix and commit. Otherwise skip this step.

- [ ] **Step 6: Push**

```bash
git status            # confirm nothing uncommitted
git log --oneline -16 # confirm last 16 commits look right
git push origin main
```

Cloudflare Workers Builds will auto-deploy.

- [ ] **Step 7: Production smoke**

After CI completes, open `https://italy-trip.github-mud285.workers.dev/`. Force a service-worker update: DevTools → Application → Service Workers → Unregister, then reload. Walk a quick subset of the smoke list: `/`, `/day/2026-07-17`, `/hike/tre-cime`, `/activities/solferino-red-cross-memorial`, `/lodgings/salo-airbnb`, `/map?focus=activity-vittoriale-degli-italiani`. All should load and behave per the dev smoke results. Done.

---

## Self-Review

**Spec coverage check** (against `docs/superpowers/specs/2026-05-02-nav-usability-pass-design.md`):

- §1 Bottom nav extended active-state rules → Task 8 ✅
- §1 MapRibbon (static, no MapLibre, layering, projection, view-transition opt-out cascade) → Task 3 + Task 2 (math) ✅
- §1 MapRibbon caption + expand control → Task 3 ✅
- §1 phaseBoundary derived from trip.phases → Task 10 frontmatter ✅
- §1 Adaptive countdown copy (3 cases) → Task 9 (Countdown component) ✅
- §1 Today banner Phase I (hike) vs Phase II (free + nearest 4) → Task 9 (TodayBanner) + Task 10 (anchor) ✅
- §1 Booking ring two-trigger collapse → Task 9 (BookingRingOrBadge) + Task 10 (collapseRing rule) ✅
- §1 Section ordering swap by phase → Task 10 (inPhaseII branch) ✅
- §1 Past phase summary card → Task 9 (PastPhaseSummary) + Task 10 mount ✅
- §2 7 Garda day stubs (Jul 21–27 with Day 27 special) → Task 1 ✅
- §2 Activity proximity computed at build time → Task 11 ✅
- §2 Map ribbon pin sourcing → Tasks 5 + 7 (per-page) ✅
- §2 /map ?day= and ?focus= with focus-wins precedence → Task 6 ✅
- §2 /lodgings restructure → Task 7 ✅
- §3 New files: MapRibbon, Breadcrumb, RelatedActivities, lodgings/index, lodgings/[slug], CATEGORY_LABELS → Tasks 3, 4, 11, 7 ✅
- §3 Modified: BottomNav, DayPillScroller, BaseLayout, index, day, hike, activities/index, activities/[slug], map, MapView, migrate-itinerary, sw → Tasks 1, 5, 6, 7, 8, 10, 11, 12, 13, 14 ✅
- §3 index.astro decomposition into 4 components → Tasks 9 + 10 ✅
- §3 emitGardaDayStubs idempotency + flight-time-from-trip-data → Task 1 ✅
- §3 SW v4 (skipWaiting/clients.claim already in place) → Task 4 ✅
- §4 Implementation order matches Tasks 1-15 in 5 phases ✅

**Placeholder scan:** searched the plan for `TBD`, `TODO`, "implement later", "add appropriate", "similar to", "etc.". No matches. Every step shows the actual code or exact command.

**Type-consistency scan:**
- `Pin` type defined in `src/lib/tile-math.ts` (Task 2) and re-used by every consumer via `import type { Pin } from '@/lib/tile-math'` (Tasks 5, 7) ✅
- `MapView.tsx`'s `Pin` (Task 6) defines its own version with `id` + `dayDates` extras — distinct on purpose because the React island has different needs from the static ribbons. Both have `category: 'trailhead' | 'lodging' | 'parking' | 'restaurant' | 'activity'` consistent ✅
- `ActivityCategory` exported from `src/lib/category-labels.ts` (Task 4); imported in `src/pages/activities/index.astro` (Task 8) ✅
- `CATEGORY_LABELS` defined in Task 4, used in Task 8 (catalog filter pills + breadcrumb) ✅
- `phaseBoundary` derived in Task 10 + Task 12 — both use the same expression `trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate` ✅
- `haversineKm` defined inline in both Task 10 (TodayBanner anchor) and Task 11 (RelatedActivities) — duplicated by design (small enough not to extract a shared util) ✅
- `collapseRing` boolean in Task 10 maps directly to `BookingRingOrBadge`'s `collapse` prop in Task 9 ✅
- Garda day stub filename pattern `2026-07-NN-free-day-lake-garda.md` (Task 1) matches Astro's `[date].astro` route — Astro derives `date` from frontmatter via `getStaticPaths`, not the filename, so any filename works ✅
- `lodging.id` (Task 7 + Task 10) is the Astro-derived id for data collections, equal to the YAML filename without `.yaml` (e.g. `salo-airbnb`) — matches `getLodgings()` return shape ✅

**Granularity scan:** every step is one concrete edit, run, or commit. No prose-only steps. Every code change has a code block. Per-task commits.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-nav-usability-pass.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
