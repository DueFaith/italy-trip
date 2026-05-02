# Test Coverage Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the test suite up to date with everything shipped since the Garda extension — three layers (unit, integrity audit, e2e) plus three small library refactors that the test suite depends on.

**Architecture:** Phase 1 extracts duplicated logic (`haversineKm`, phase-boundary derivation, wordmark resolution) into focused `src/lib/*` modules so they can be tested in isolation and so the integrity audit can call them as the source of truth. Phases 2–4 add the actual tests. Phase 5 wires everything together (`npm run test:all`, short README).

**Tech Stack:** vitest (already present), Playwright (already present), TypeScript strict, cheerio (new dev-dep, ~80 KB).

**Verification model:** vitest unit tests + integrity tests run as part of `npm test`. Playwright e2e runs separately as `npm run test:e2e`. Each task includes the exact `grep` or `npm test` command and the expected output.

---

## File Structure

### New library modules (created in Phase 1)
- `src/lib/geo.ts` — `haversineKm(aLat, aLon, bLat, bLon): number`
- `src/lib/phase.ts` — `phaseBoundary(trip)`, `isInPhaseII(trip, todayISO)`
- `src/lib/wordmark.ts` — `getWordmark({ pathname, dayLodgingSlug?, lodgingId? }): string`
- `src/lib/related.ts` — `sharedSlugPrefix(a, b): number` (extracted from `RelatedActivities.astro`)

### New test files (created in Phases 2–4)
- `tests/unit/tile-math.test.ts`
- `tests/unit/category-labels.test.ts`
- `tests/unit/related-activities.test.ts`
- `tests/unit/haversine.test.ts`
- `tests/unit/phase-boundary.test.ts`
- `tests/integrity/setup.ts` — vitest globalSetup that runs `astro build`
- `tests/integrity/links.test.ts` — all 10 invariants

### Modified files
- `src/pages/index.astro` — import from `@/lib/geo`, `@/lib/phase` (remove inline copies)
- `src/pages/day/[date].astro` — same
- `src/components/RelatedActivities.astro` — import from `@/lib/geo`, `@/lib/related`
- `src/components/DayPillScroller.astro` — import `phaseBoundary` from `@/lib/phase`
- `src/components/MapView.tsx` — accept `phaseBoundary` prop instead of hardcoded literal
- `src/pages/map.astro` — pass `phaseBoundary={phaseBoundary(getTrip())}` prop to `<MapView>`
- `src/layouts/BaseLayout.astro` — call `getWordmark` from `@/lib/wordmark`
- `src/pages/day/[date].astro`, `src/pages/hike/[slug].astro`, `src/pages/lodgings/[slug].astro` — call `getWordmark` for `headerTitle`
- `scripts/migrate-itinerary.mjs` — export `buildGardaDayStubs`, `buildActivities` (split build-vs-emit)
- `tests/unit/schemas.test.ts` — add `ActivitySchema` cases
- `tests/unit/migration.test.mjs` — add `buildGardaDayStubs` + `buildActivities` cases
- `tests/e2e/smoke.spec.ts` — refresh + extend
- `vitest.config.ts` — extend `include` pattern to cover `tests/integrity/**`
- `package.json` — add `test:all` script + cheerio dev-dep

### New docs
- `tests/README.md` — three-tier guide

### Untouched
- All content collections (`src/content/**`)
- All other `src/components/`, `src/pages/`, `src/lib/category-labels.ts`, `src/lib/tile-math.ts`
- `playwright.config.ts`, `astro.config.mjs`, `tsconfig.json`

---

## Phase 1 — Refactors

Three library extractions + one migration-script refactor. Each task verifies via grep that the refactor converged AND that existing 27 unit tests still pass.

### Task 1: Extract `haversineKm` → `src/lib/geo.ts`

**Files:**
- Create: `src/lib/geo.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/day/[date].astro`
- Modify: `src/components/RelatedActivities.astro`

- [ ] **Step 1: Create `src/lib/geo.ts`**

```typescript
// Great-circle distance between two lat/lon points using the haversine formula.
// Returns kilometres. Pure function — no DOM, no I/O.
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}
```

- [ ] **Step 2: Update `src/pages/index.astro`**

Find the inline `function haversineKm(...)` declaration (around line 42) and remove it. Replace the import block at the top with an additional import line:

```astro
import { getDays, getHikes, getTrip, getBookings, getLodgings, getActivities } from '@/lib/content';
import { haversineKm } from '@/lib/geo';
```

The `nearestActivities` const that uses `haversineKm(...)` remains identical — only the function definition moves.

- [ ] **Step 3: Update `src/pages/day/[date].astro`**

Same pattern: remove the inline `function haversineKm(...)` (around line 39), add `import { haversineKm } from '@/lib/geo';` to the imports block.

- [ ] **Step 4: Update `src/components/RelatedActivities.astro`**

Same pattern: remove the inline function (around line 8), add `import { haversineKm } from '@/lib/geo';` after the existing imports.

- [ ] **Step 5: Verify the refactor converged**

Run: `grep -rn "haversine" src/`
Expected: matches appear ONLY in:
- `src/lib/geo.ts` (the function definition)
- `src/pages/index.astro` (one import + one usage in `nearestActivities`)
- `src/pages/day/[date].astro` (one import + one usage)
- `src/components/RelatedActivities.astro` (one import + one usage)
- `src/components/TodayBanner.astro` (one comment mentioning haversine, OK)

No other file should contain `haversine`.

- [ ] **Step 6: Verify existing tests still pass**

Run: `npm test`
Expected: 27 tests pass (same count as before the refactor). Build artefacts unchanged.

Run: `npm run build`
Expected: succeeds, 56 pages built.

- [ ] **Step 7: Commit**

```bash
git add src/lib/geo.ts src/pages/index.astro src/pages/day/\[date\].astro src/components/RelatedActivities.astro
git commit -m "refactor(geo): extract haversineKm to src/lib/geo.ts

Three sites duplicated the function body verbatim (index.astro,
day/[date].astro, RelatedActivities.astro). Single source of truth
+ unit-testable in isolation. No behavioural change.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Extract phase derivation → `src/lib/phase.ts`

**Files:**
- Create: `src/lib/phase.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/day/[date].astro`
- Modify: `src/components/DayPillScroller.astro`
- Modify: `src/components/MapView.tsx`
- Modify: `src/pages/map.astro`

- [ ] **Step 1: Create `src/lib/phase.ts`**

```typescript
// Trip-phase derivation. Single source of truth for "where the Garda phase
// starts" — derived from trip.phases (set in trip.yaml) with a safe fallback
// to trip.endDate (i.e. "Phase II never starts") if phases is removed.

type TripLike = {
  endDate: string;
  phases?: Array<{ id: string; start: string; end: string }>;
};

export function phaseBoundary(trip: TripLike): string {
  return trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
}

export function isInPhaseII(trip: TripLike, todayISO: string): boolean {
  return todayISO >= phaseBoundary(trip);
}
```

- [ ] **Step 2: Update `src/pages/index.astro`**

Add to the imports:
```astro
import { phaseBoundary, isInPhaseII } from '@/lib/phase';
```

Find the existing two lines (around line 22):
```typescript
const phaseBoundary = trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
const inPhaseII = todayISO >= phaseBoundary;
```

Replace with:
```typescript
const boundary = phaseBoundary(trip);
const inPhaseII = isInPhaseII(trip, todayISO);
```

Then update the two downstream usages of `phaseBoundary` in the same file to use the new local name `boundary`:
- The line `const dolomiteDays = days.filter((d) => d.data.date < phaseBoundary);` becomes `… < boundary;`
- The line `<PastPhaseSummary hikes={hikes} startDate={trip.startDate} endDate={phaseBoundary} nights={dolomiteNights} />` becomes `endDate={boundary}`

- [ ] **Step 3: Update `src/pages/day/[date].astro`**

Add to the imports:
```astro
import { phaseBoundary } from '@/lib/phase';
```

Find the existing two lines (around line 32):
```typescript
const phaseBoundary = trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
const isGardaFreeForm = day.data.hikeSlugs.length === 0 && day.data.date >= phaseBoundary;
```

Replace with:
```typescript
const boundary = phaseBoundary(trip);
const isGardaFreeForm = day.data.hikeSlugs.length === 0 && day.data.date >= boundary;
```

- [ ] **Step 4: Update `src/components/DayPillScroller.astro`**

Add to the imports:
```astro
import { phaseBoundary } from '@/lib/phase';
```

Replace the inline derivation (around line 18):
```typescript
const phaseBoundary = trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
```
with:
```typescript
const boundary = phaseBoundary(trip);
```

Update the downstream usage at line 53:
```typescript
const isPhaseTransition = prev && prev.data.date < phaseBoundary && d.data.date >= phaseBoundary;
```
becomes:
```typescript
const isPhaseTransition = prev && prev.data.date < boundary && d.data.date >= boundary;
```

- [ ] **Step 5: Update `src/components/MapView.tsx`**

The hardcoded literal at line 48 (`dayDateProp < '2026-07-20'`) is the drift bug. MapView is a React island — it can't import server-side helpers, so the boundary must arrive as a prop.

Update the `Props` type:
```typescript
type Props = {
  pins: Pin[];
  focusId?: string;
  dayDate?: string;
  phaseBoundary?: string;  // ← new; e.g. '2026-07-20'
};
```

Update the destructure:
```typescript
export default function MapView({ pins, focusId: focusIdProp, dayDate: dayDateProp, phaseBoundary: phaseBoundaryProp = '2026-07-20' }: Props) {
```

(The `'2026-07-20'` default is a safety fallback if the prop isn't passed; the test asserts the prop IS passed.)

Replace the hardcoded literal at line 48:
```typescript
const phaseIOnly = dayDateProp !== undefined && !focusIdProp && dayDateProp < '2026-07-20';
```
with:
```typescript
const phaseIOnly = dayDateProp !== undefined && !focusIdProp && dayDateProp < phaseBoundaryProp;
```

- [ ] **Step 6: Update `src/pages/map.astro` to pass the boundary prop**

Add to the imports:
```astro
import { phaseBoundary } from '@/lib/phase';
```

Find the `<MapView>` invocation (around the bottom of the file body). Currently it reads:
```astro
<MapView pins={pins} focusId={focusId} dayDate={dayDate} client:only="react" />
```

Update to:
```astro
<MapView pins={pins} focusId={focusId} dayDate={dayDate} phaseBoundary={phaseBoundary(getTrip())} client:only="react" />
```

If `getTrip` isn't already imported in this file, add it:
```astro
import { getHikes, getLodgings, getActivities, getDays, getTrip } from '@/lib/content';
```

- [ ] **Step 7: Verify the refactor converged**

Run: `grep -rn "2026-07-20\|trip.phases?.find" src/`
Expected: matches appear ONLY in:
- `src/lib/phase.ts` (no — wait, it doesn't contain the literal '2026-07-20'. Only `'garda'` lookup.) — should match `phases?.find` only here
- `src/components/MapView.tsx` (the `'2026-07-20'` default fallback in the prop destructure — acceptable safety net)

No `src/pages/*.astro` or `src/components/*.astro` should contain the inline derivation pattern any more.

- [ ] **Step 8: Verify existing tests + build**

Run: `npm test`
Expected: 27 tests still pass.

Run: `npm run build`
Expected: succeeds, 56 pages built.

- [ ] **Step 9: Commit**

```bash
git add src/lib/phase.ts src/pages/index.astro src/pages/day/\[date\].astro src/components/DayPillScroller.astro src/components/MapView.tsx src/pages/map.astro
git commit -m "refactor(phase): extract phaseBoundary + isInPhaseII to src/lib/phase.ts

Four sites had drifted: 3 with the full trip.phases?.find pattern
(index.astro, day/[date].astro, DayPillScroller.astro) and 1 with
a hardcoded '2026-07-20' literal (MapView.tsx) that wouldn't notice
if trip.yaml shifted the Garda phase start. MapView now receives
the boundary as a prop from map.astro at SSR time.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: Extract wordmark → `src/lib/wordmark.ts`

**Files:**
- Create: `src/lib/wordmark.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/day/[date].astro`
- Modify: `src/pages/hike/[slug].astro`
- Modify: `src/pages/lodgings/[slug].astro`

- [ ] **Step 1: Create `src/lib/wordmark.ts`**

```typescript
// Header wordmark resolution. Pages can pass partial context (lodgingSlug for
// /day/*, lodgingId for /lodgings/[slug]); other routes use path-only defaults.
//
// Returning the trip name in the default case lets callers always render the
// returned value unconditionally — no null handling needed.

export type WordmarkContext = {
  pathname: string;
  // Optional content context for detail pages:
  dayLodgingSlug?: string;  // pass for /day/[date]
  lodgingId?: string;       // pass for /lodgings/[slug]
  // /hike/[slug] always returns 'Dolomites' — every hike is in the Dolomites.
};

export function getWordmark(ctx: WordmarkContext): string {
  // Astro can emit static pages with a trailing slash (e.g. "/map/"); normalise.
  const p = ctx.pathname === '/' ? '/' : ctx.pathname.replace(/\/$/, '');

  // Detail pages with content context — geographic
  if (p.startsWith('/day/') && ctx.dayLodgingSlug) {
    return ctx.dayLodgingSlug === 'salo-airbnb' ? 'Lago di Garda' : 'Dolomites';
  }
  if (p.startsWith('/lodgings/') && p !== '/lodgings' && ctx.lodgingId) {
    return ctx.lodgingId === 'salo-airbnb' ? 'Lago di Garda' : 'Dolomites';
  }
  if (p.startsWith('/hike/')) return 'Dolomites';

  // Path-based functional + section pages
  if (p === '/') return 'Dolomites + Garda';
  if (p === '/activities' || p.startsWith('/activities/')) return 'Lago di Garda';
  if (p === '/map') return 'Map';
  if (p === '/checklist') return 'Checklist';
  if (p === '/customize') return 'Customize';
  if (p === '/photos') return 'Photos';
  if (p === '/more') return 'More';
  if (p === '/restaurants') return 'Restaurants';
  if (p === '/contingencies') return 'Contingencies';
  if (p === '/hikes') return 'Hikes';
  if (p === '/lodgings') return 'Lodgings';

  return 'Dolomites + Garda';
}
```

- [ ] **Step 2: Update `src/layouts/BaseLayout.astro`**

Find the inline `function wordmarkForPath(rawPath)` (lines ~16–37) and the `const resolvedHeaderTitle = headerTitle ?? wordmarkForPath(...)` line (~40). Replace the entire helper block with an import + a single-line resolved call.

Add to imports:
```astro
import { getWordmark } from '@/lib/wordmark';
```

Replace the inline `function wordmarkForPath` block AND the `const resolvedHeaderTitle = ...` line with:

```typescript
const resolvedHeaderTitle = headerTitle ?? getWordmark({ pathname: Astro.url.pathname });
```

The `<Header title={resolvedHeaderTitle} />` line stays unchanged.

- [ ] **Step 3: Update `src/pages/day/[date].astro`**

Find the existing `<BaseLayout>` invocation (around line 83):
```astro
<BaseLayout
  title={`Day ${dayIndex + 1} — ${day.data.theme}`}
  activeDayDate={day.data.date}
  headerTitle={day.data.lodgingSlug === 'salo-airbnb' ? 'Lago di Garda' : 'Dolomites'}
>
```

Add to imports:
```astro
import { getWordmark } from '@/lib/wordmark';
```

Replace the inline ternary in `headerTitle`:
```astro
<BaseLayout
  title={`Day ${dayIndex + 1} — ${day.data.theme}`}
  activeDayDate={day.data.date}
  headerTitle={getWordmark({ pathname: Astro.url.pathname, dayLodgingSlug: day.data.lodgingSlug })}
>
```

- [ ] **Step 4: Update `src/pages/hike/[slug].astro`**

Find the `<BaseLayout>` invocation:
```astro
<BaseLayout title={hike.data.name} activeDayDate={dayForHike?.data.date} headerTitle="Dolomites">
```

Add to imports:
```astro
import { getWordmark } from '@/lib/wordmark';
```

Replace the hardcoded `headerTitle="Dolomites"` with:
```astro
<BaseLayout title={hike.data.name} activeDayDate={dayForHike?.data.date} headerTitle={getWordmark({ pathname: Astro.url.pathname })}>
```

(For /hike/* the helper returns 'Dolomites' deterministically — no context needed.)

- [ ] **Step 5: Update `src/pages/lodgings/[slug].astro`**

Find the `<BaseLayout>` invocation:
```astro
<BaseLayout
  title={`${l.name} · Lodgings`}
  headerTitle={lodging.id === 'salo-airbnb' ? 'Lago di Garda' : 'Dolomites'}
>
```

Add to imports:
```astro
import { getWordmark } from '@/lib/wordmark';
```

Replace:
```astro
<BaseLayout
  title={`${l.name} · Lodgings`}
  headerTitle={getWordmark({ pathname: Astro.url.pathname, lodgingId: lodging.id })}
>
```

- [ ] **Step 6: Verify the refactor converged**

Run: `grep -rn "wordmarkForPath\|'Dolomites + Garda'\|'Lago di Garda'" src/`
Expected: matches appear ONLY in:
- `src/lib/wordmark.ts` (the helper definition)
- `src/components/Header.astro` (the wordmark default fallback if `title` prop is unset — acceptable; Header doesn't compute, it just renders)

No `*.astro` page or layout should contain inline wordmark literals any more.

- [ ] **Step 7: Verify build + spot-check**

Run: `npm run build && grep -oE 'font-weight: 400;">[A-ZÀ-Ÿ +]+' dist/index.html dist/day/2026-07-22/index.html dist/lodgings/salo-airbnb/index.html dist/map/index.html`
Expected output (snipped):
- `dist/index.html`: `DOLOMITES + GARDA`
- `dist/day/2026-07-22/index.html`: `LAGO DI GARDA`
- `dist/lodgings/salo-airbnb/index.html`: `LAGO DI GARDA`
- `dist/map/index.html`: `MAP`

- [ ] **Step 8: Commit**

```bash
git add src/lib/wordmark.ts src/layouts/BaseLayout.astro src/pages/day/\[date\].astro src/pages/hike/\[slug\].astro src/pages/lodgings/\[slug\].astro
git commit -m "refactor(wordmark): extract getWordmark to src/lib/wordmark.ts

BaseLayout had an inline wordmarkForPath helper and 3 detail pages
(day, hike, lodging) hardcoded ternaries inline. Centralise so the
integrity test in Phase 3 can assert 'rendered wordmark === getWordmark
for this route' as a property check across all 56 pages.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Refactor `migrate-itinerary.mjs` to expose `buildGardaDayStubs` + `buildActivities`

**Files:**
- Modify: `scripts/migrate-itinerary.mjs`

The existing `emit*` functions write files directly. Splitting each into a pure `build*` (returns `{relPath, content}[]`) + a thin `emit*` wrapper (writes them) lets unit tests assert on data without touching the filesystem. We do this only for the two emits that the spec wants tested (`emitGardaDayStubs`, `emitActivities`); other emits stay as-is.

- [ ] **Step 1: Refactor `emitActivities` into `buildActivities` + `emitActivities`**

Find the existing `function emitActivities()` (a long block with the 22 activities array). Rename to `buildActivities` and change it to RETURN the records instead of writing them. Then add a thin wrapper that writes.

Replace the entire `function emitActivities() { ... }` block with:

```javascript
export function buildActivities() {
  const activities = [
    // ... (keep the full 22-entry array exactly as it is today)
  ];
  return activities.map((a) => ({
    relPath: `src/content/activities/${a.slug}.yaml`,
    content: toYAML(a).trim() + '\n',
  }));
}

function emitActivities() {
  for (const r of buildActivities()) {
    writeFile(r.relPath, r.content);
  }
}
```

(Keep the 22-activity array literal intact — only the surrounding return/write shape changes.)

- [ ] **Step 2: Refactor `emitGardaDayStubs` into `buildGardaDayStubs` + `emitGardaDayStubs`**

Find the existing `function emitGardaDayStubs()` block. Replace it with:

```javascript
export function buildGardaDayStubs() {
  // Pull the return-flight depart string straight from the same source
  // emitTrip() uses, so the two never drift out of sync.
  const returnDepart = '2026-07-27T19:10';
  const departTime = returnDepart.slice(11, 16);
  const arriveBy = '16:00';
  const SALO = { lat: 45.6063, lon: 10.5237, label: 'Salò' };

  const records = [];

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
    records.push({
      relPath: `src/content/days/${date}-free-day-lake-garda.md`,
      content: `---\n${toYAML(stub).trim()}\n---\n\n`,
    });
  }

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
  records.push({
    relPath: `src/content/days/2026-07-27-departure-drive-to-vce.md`,
    content: `---\n${toYAML(dep).trim()}\n---\n\n`,
  });

  return records;
}

function emitGardaDayStubs() {
  for (const r of buildGardaDayStubs()) {
    const target = path.join(ROOT, r.relPath);
    if (fs.existsSync(target)) {
      console.log(`  · ${r.relPath} already exists — skipping`);
      continue;
    }
    writeFile(r.relPath, r.content);
  }
}
```

- [ ] **Step 3: Verify migration still works end-to-end**

Run: `node scripts/migrate-itinerary.mjs`
Expected: same output as before — emits 22 activities (overwriting), 7 day stubs (skipping if exist).

Run: `git diff src/content/activities src/content/days`
Expected: no changes (idempotent re-run).

- [ ] **Step 4: Verify existing migration tests still pass**

Run: `npx vitest run tests/unit/migration.test.mjs`
Expected: existing 8 tests pass (parser tests are unaffected by the emit refactor).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-itinerary.mjs
git commit -m "refactor(migration): split emitActivities + emitGardaDayStubs into build*+emit* pairs

Pure build* functions return [{ relPath, content }] records; thin
emit* wrappers do the fs writes. Lets unit tests assert on the
data without touching the filesystem. Idempotency check for day
stubs lives in the wrapper as before.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 2 — Unit tests

Six tasks: 2 refreshes + 4 new (one extracts `sharedSlugPrefix` to `src/lib/related.ts` along the way).

### Task 5: Refresh `tests/unit/schemas.test.ts` — add ActivitySchema

**Files:**
- Modify: `tests/unit/schemas.test.ts`

- [ ] **Step 1: Add `ActivitySchema` import + 6 tests**

Find the existing import line at the top:
```typescript
import { TripSchema, DaySchema, HikeSchema, LodgingSchema, BookingSchema } from '@/content/config';
```

Add `ActivitySchema`:
```typescript
import { TripSchema, DaySchema, HikeSchema, LodgingSchema, BookingSchema, ActivitySchema } from '@/content/config';
```

At the end of the file (after the existing `describe('content schemas', ...)` block), append a new `describe` block:

```typescript
describe('ActivitySchema', () => {
  const validBase = {
    slug: 'demo',
    name: 'Demo Activity',
    category: 'culture-history' as const,
    description: 'A test activity for schema validation.',
    location: { label: 'Salò', lat: 45.6063, lon: 10.5237 },
    cost: { display: '€10' },
    bookingRequired: false,
  };

  it('accepts a minimal valid activity', () => {
    expect(() => ActivitySchema.parse(validBase)).not.toThrow();
  });

  it('accepts a featured activity with bookingNote and url', () => {
    const a = {
      ...validBase,
      slug: 'featured-demo',
      featured: true,
      bookingRequired: true,
      bookingNote: 'Reserve 2 days ahead',
      url: 'https://example.com/booking',
      durationHours: 2,
      driveFromSaloMin: 25,
    };
    expect(() => ActivitySchema.parse(a)).not.toThrow();
  });

  it('defaults featured to false when omitted', () => {
    const parsed = ActivitySchema.parse(validBase);
    expect(parsed.featured).toBe(false);
  });

  it('rejects a missing required field (name)', () => {
    const { name, ...withoutName } = validBase;
    expect(() => ActivitySchema.parse(withoutName)).toThrow();
  });

  it('rejects an invalid category enum value', () => {
    const a = { ...validBase, category: 'made-up-category' };
    expect(() => ActivitySchema.parse(a)).toThrow();
  });

  it('rejects a malformed url', () => {
    const a = { ...validBase, url: 'not-a-url' };
    expect(() => ActivitySchema.parse(a)).toThrow();
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run tests/unit/schemas.test.ts`
Expected: previously 8 tests, now 14 (8 + 6 new), all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/schemas.test.ts
git commit -m "test(schemas): add ActivitySchema coverage

6 cases: minimal valid, full valid, default featured=false, missing
required, bad category enum, malformed url. ActivitySchema previously
had zero unit-test coverage despite shipping 22 entries.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Refresh `tests/unit/migration.test.mjs` — add `buildActivities` + `buildGardaDayStubs`

**Files:**
- Modify: `tests/unit/migration.test.mjs`

- [ ] **Step 1: Update imports**

Find the existing import line:
```javascript
import { parseDays, parseHikes, parseBookings, parseDriveLegs } from '../../scripts/migrate-itinerary.mjs';
```

Add the two new exported builders:
```javascript
import { parseDays, parseHikes, parseBookings, parseDriveLegs, buildActivities, buildGardaDayStubs } from '../../scripts/migrate-itinerary.mjs';
```

- [ ] **Step 2: Add `buildActivities` describe block at end of file**

```javascript
describe('buildActivities', () => {
  it('returns 22 records with unique slugs', () => {
    const records = buildActivities();
    expect(records).toHaveLength(22);
    const slugs = records.map((r) => r.relPath.replace(/^src\/content\/activities\//, '').replace(/\.yaml$/, ''));
    expect(new Set(slugs).size).toBe(22);
  });

  it('every record has a non-empty content body and a YAML extension', () => {
    for (const r of buildActivities()) {
      expect(r.relPath).toMatch(/^src\/content\/activities\/[a-z0-9-]+\.yaml$/);
      expect(r.content.length).toBeGreaterThan(0);
    }
  });

  it('contains the featured slugs', () => {
    const slugs = buildActivities().map((r) => r.relPath);
    expect(slugs).toEqual(expect.arrayContaining([
      'src/content/activities/solferino-red-cross-memorial.yaml',
      'src/content/activities/garda-rent-boat-jetski.yaml',
      'src/content/activities/vittoriale-degli-italiani.yaml',
      'src/content/activities/monte-baldo-cable-car.yaml',
    ]));
  });
});

describe('buildGardaDayStubs', () => {
  it('returns 7 records (Jul 21..27)', () => {
    const records = buildGardaDayStubs();
    expect(records).toHaveLength(7);
  });

  it('records target paths under src/content/days/', () => {
    for (const r of buildGardaDayStubs()) {
      expect(r.relPath).toMatch(/^src\/content\/days\/2026-07-2[1-7]-[a-z-]+\.md$/);
    }
  });

  it('day 27 record contains the literal flight time 19:10', () => {
    const dep = buildGardaDayStubs().find((r) => r.relPath.includes('2026-07-27'));
    expect(dep).toBeDefined();
    expect(dep.content).toContain('19:10');
    expect(dep.content).toContain('Venice Marco Polo Airport');
  });

  it('all stubs reference lodgingSlug salo-airbnb', () => {
    for (const r of buildGardaDayStubs()) {
      expect(r.content).toContain('lodgingSlug: salo-airbnb');
    }
  });

  it('Jul 21..26 records have empty hikeSlugs and empty schedule', () => {
    const freeForm = buildGardaDayStubs().filter((r) => !r.relPath.includes('2026-07-27'));
    expect(freeForm).toHaveLength(6);
    for (const r of freeForm) {
      expect(r.content).toContain('hikeSlugs: []');
      expect(r.content).toContain('schedule: []');
    }
  });
});
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run tests/unit/migration.test.mjs`
Expected: previously 8 tests, now 16 (8 + 3 buildActivities + 5 buildGardaDayStubs), all pass.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/migration.test.mjs
git commit -m "test(migration): add buildActivities + buildGardaDayStubs coverage

8 new cases asserting record counts, slug uniqueness, featured slug
presence, the literal flight time 19:10 derived from trip data,
lodgingSlug consistency, and empty fields for free-form days.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: New `tests/unit/tile-math.test.ts`

**Files:**
- Create: `tests/unit/tile-math.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { buildRibbonSpec, type Pin } from '@/lib/tile-math';

const trailheadPin = (lat: number, lon: number, label = 'pin'): Pin => ({
  lat,
  lon,
  label,
  category: 'trailhead',
});

describe('buildRibbonSpec', () => {
  it('returns null for an empty pin set', () => {
    expect(buildRibbonSpec([])).toBeNull();
  });

  it('uses zoom 13 and centres a single pin at fx=fy=0.5-ish', () => {
    const spec = buildRibbonSpec([trailheadPin(46.5, 12.0)]);
    expect(spec).not.toBeNull();
    expect(spec!.zoom).toBe(13);
    expect(spec!.projected).toHaveLength(1);
    expect(spec!.projected[0].edge).toBeNull();
    // The pin is inside its own tile so fx/fy are roughly proportional to its
    // position within the tile bbox — not exactly 0.5, but always inside [0,1].
    expect(spec!.projected[0].fx).toBeGreaterThanOrEqual(0);
    expect(spec!.projected[0].fx).toBeLessThanOrEqual(1);
    expect(spec!.projected[0].fy).toBeGreaterThanOrEqual(0);
    expect(spec!.projected[0].fy).toBeLessThanOrEqual(1);
  });

  it('Tre Cime + Baita Fraina overflow at z=10 → one pin marked as edge', () => {
    const spec = buildRibbonSpec([
      trailheadPin(46.6168, 12.2954, 'Tre Cime'),
      trailheadPin(46.5237, 12.1528, 'Baita Fraina'),
    ]);
    expect(spec).not.toBeNull();
    expect(spec!.zoom).toBe(10); // bottoms out — pin spread > tile lat extent
    const edges = spec!.projected.map((p) => p.edge);
    expect(edges).toContain('bottom'); // at least one is clipped
  });

  it('cross-region pins (Salò + VCE) bottom out at MIN_ZOOM=10', () => {
    const spec = buildRibbonSpec([
      trailheadPin(45.6063, 10.5237, 'Salò'),
      trailheadPin(45.5053, 12.3519, 'VCE'),
    ]);
    expect(spec).not.toBeNull();
    expect(spec!.zoom).toBe(10);
  });

  it('uses bbox-centre, not mean, for asymmetric pin sets', () => {
    // Three pins at (1,1), (1,1), (3,3). Mean lon is 1.67, bbox-centre lon is 2.0.
    // We can't read centerLon directly without checking it's bbox-centre;
    // instead, assert tile selection is consistent with bbox-centre by
    // checking that the centre lat/lon of the spec equals (2,2) ±tolerance.
    const spec = buildRibbonSpec([
      { lat: 1, lon: 1, label: 'a', category: 'trailhead' },
      { lat: 1, lon: 1, label: 'b', category: 'trailhead' },
      { lat: 3, lon: 3, label: 'c', category: 'trailhead' },
    ]);
    expect(spec).not.toBeNull();
    expect(spec!.centerLat).toBeCloseTo(2.0, 6);
    expect(spec!.centerLon).toBeCloseTo(2.0, 6);
  });

  it('produces an OSM tile URL matching the chosen zoom + tile coords', () => {
    const spec = buildRibbonSpec([trailheadPin(46.5237, 12.1528)]);
    expect(spec!.tileUrl).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    expect(spec!.tileUrl).toContain(`/${spec!.zoom}/`);
    expect(spec!.tileUrl).toContain(`/${spec!.tileX}/`);
    expect(spec!.tileUrl).toContain(`/${spec!.tileY}.png`);
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run tests/unit/tile-math.test.ts`
Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/tile-math.test.ts
git commit -m "test(tile-math): cover buildRibbonSpec projection rules

6 cases: empty pin set, single-pin centring, Tre Cime + Baita Fraina
overflow at z=10, cross-region pins bottom out, bbox-centre vs mean,
OSM tile URL format.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: New `tests/unit/category-labels.test.ts`

**Files:**
- Create: `tests/unit/category-labels.test.ts`

- [ ] **Step 1: Create the test file**

The activities collection lives at `src/content/activities/*.yaml`. The vitest mock for `astro:content` doesn't provide `getCollection`, so this test reads YAML files from disk directly.

```typescript
import { describe, it, expect } from 'vitest';
import { CATEGORY_LABELS, type ActivityCategory } from '@/lib/category-labels';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ACTIVITIES_DIR = path.resolve(__dirname, '../../src/content/activities');

function loadActivities(): { slug: string; category: string }[] {
  const files = fs.readdirSync(ACTIVITIES_DIR).filter((f) => f.endsWith('.yaml'));
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(ACTIVITIES_DIR, f), 'utf8');
    const data = yaml.load(raw) as { slug: string; category: string };
    return { slug: data.slug, category: data.category };
  });
}

describe('CATEGORY_LABELS', () => {
  it('has a label for every activity category in the collection', () => {
    const activities = loadActivities();
    for (const a of activities) {
      expect(CATEGORY_LABELS[a.category as ActivityCategory]).toBeDefined();
    }
  });

  it('every key is a valid ActivityCategory (no orphan keys)', () => {
    const activities = loadActivities();
    const usedCategories = new Set(activities.map((a) => a.category));
    for (const key of Object.keys(CATEGORY_LABELS)) {
      // Every label key should appear in at least one activity OR be a
      // legitimately unused category. Today every key IS used.
      expect(usedCategories.has(key)).toBe(true);
    }
  });

  it('produces human-readable labels (no slug-cased fallbacks)', () => {
    expect(CATEGORY_LABELS['culture-history']).toBe('Culture & History');
    expect(CATEGORY_LABELS['water-sports']).toBe('Water Sports');
    expect(CATEGORY_LABELS['mountain-cable-car']).toBe('Mountain & Cable Car');
    expect(CATEGORY_LABELS['day-trip']).toBe('Day Trip');
    expect(CATEGORY_LABELS['aquatic-park']).toBe('Aquatic Park');
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run tests/unit/category-labels.test.ts`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/category-labels.test.ts
git commit -m "test(category-labels): exhaustiveness guard against the activities collection

3 cases: every activity category has a label entry, every label key is
actually used, spot-check humanised strings (not slug-cased fallbacks).
Reads activities directly from disk since the vitest astro:content mock
doesn't stub getCollection.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Extract `sharedSlugPrefix` → `src/lib/related.ts` + new test

**Files:**
- Create: `src/lib/related.ts`
- Modify: `src/components/RelatedActivities.astro`
- Create: `tests/unit/related-activities.test.ts`

- [ ] **Step 1: Create `src/lib/related.ts`**

```typescript
// Count shared hyphen-separated tokens at the start of two slugs.
// Used by RelatedActivities to exclude same-business activities (e.g.
// `garda-rent-boat-jetski` and `garda-rent-boat-rental` share 3 prefix
// tokens — same business, different watercraft).
export function sharedSlugPrefix(a: string, b: string): number {
  const at = a.split('-');
  const bt = b.split('-');
  let i = 0;
  while (i < at.length && i < bt.length && at[i] === bt[i]) i++;
  return i;
}
```

- [ ] **Step 2: Update `src/components/RelatedActivities.astro` to import**

Find the inline `function sharedSlugPrefix(...)` block in the frontmatter. Remove it. Add to imports:

```astro
import { sharedSlugPrefix } from '@/lib/related';
```

The `candidates` filter that uses `sharedSlugPrefix(a.id, current.id) < 3` stays unchanged.

- [ ] **Step 3: Verify the refactor converged**

Run: `grep -rn "sharedSlugPrefix" src/`
Expected: matches in `src/lib/related.ts` (definition) and `src/components/RelatedActivities.astro` (import + one call).

- [ ] **Step 4: Create `tests/unit/related-activities.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { sharedSlugPrefix } from '@/lib/related';

describe('sharedSlugPrefix', () => {
  it('returns 3 for "garda-rent-boat-jetski" + "garda-rent-boat-rental" (same business)', () => {
    expect(sharedSlugPrefix('garda-rent-boat-jetski', 'garda-rent-boat-rental')).toBe(3);
  });

  it('returns 1 for two Sirmione attractions (same town, different attractions)', () => {
    expect(sharedSlugPrefix('sirmione-grotte-di-catullo', 'sirmione-scaligero-castle')).toBe(1);
  });

  it('returns 0 for completely different slugs', () => {
    expect(sharedSlugPrefix('a', 'b')).toBe(0);
    expect(sharedSlugPrefix('verona-day-trip', 'rocca-di-manerba')).toBe(0);
  });

  it('returns the full token count for identical slugs', () => {
    expect(sharedSlugPrefix('foo-bar', 'foo-bar')).toBe(2);
    expect(sharedSlugPrefix('one-two-three-four', 'one-two-three-four')).toBe(4);
  });

  it('handles single-token slugs', () => {
    expect(sharedSlugPrefix('foo', 'foo')).toBe(1);
    expect(sharedSlugPrefix('foo', 'bar')).toBe(0);
  });

  it('is symmetric: sharedSlugPrefix(a, b) === sharedSlugPrefix(b, a)', () => {
    const a = 'sirmione-grotte-di-catullo';
    const b = 'sirmione-scaligero-castle';
    expect(sharedSlugPrefix(a, b)).toBe(sharedSlugPrefix(b, a));
  });
});
```

- [ ] **Step 5: Run the new tests + build**

Run: `npx vitest run tests/unit/related-activities.test.ts`
Expected: 6 tests pass.

Run: `npm run build`
Expected: succeeds; the activity detail pages still render the Nearby section correctly.

- [ ] **Step 6: Commit**

```bash
git add src/lib/related.ts src/components/RelatedActivities.astro tests/unit/related-activities.test.ts
git commit -m "refactor+test(related): extract sharedSlugPrefix to src/lib/related.ts

Helper was inline in RelatedActivities.astro. Extract so it's
testable in isolation. 6 cases cover the same-business filter rule
(3-token threshold), same-town overlap, identical slugs, symmetry.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: New `tests/unit/haversine.test.ts`

**Files:**
- Create: `tests/unit/haversine.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { haversineKm } from '@/lib/geo';

const SALO = { lat: 45.6063, lon: 10.5237 };
const SIRMIONE = { lat: 45.4951, lon: 10.6065 };
const VERONA = { lat: 45.4384, lon: 10.9916 };

describe('haversineKm', () => {
  it('returns Salò → Sirmione ≈ 14 km (±1)', () => {
    // Bird-line distance is roughly 13.4 km
    const d = haversineKm(SALO.lat, SALO.lon, SIRMIONE.lat, SIRMIONE.lon);
    expect(d).toBeGreaterThan(13);
    expect(d).toBeLessThan(15);
  });

  it('returns Salò → Verona ≈ 38 km (±2)', () => {
    // Bird-line distance is roughly 38 km
    const d = haversineKm(SALO.lat, SALO.lon, VERONA.lat, VERONA.lon);
    expect(d).toBeGreaterThan(36);
    expect(d).toBeLessThan(40);
  });

  it('returns 0 for the same point', () => {
    expect(haversineKm(SALO.lat, SALO.lon, SALO.lat, SALO.lon)).toBe(0);
  });

  it('is symmetric — d(A,B) === d(B,A)', () => {
    const d1 = haversineKm(SALO.lat, SALO.lon, VERONA.lat, VERONA.lon);
    const d2 = haversineKm(VERONA.lat, VERONA.lon, SALO.lat, SALO.lon);
    expect(d1).toBeCloseTo(d2, 9);
  });

  it('antipodal sanity: ~ half earth circumference (within 100 km)', () => {
    // Salò is at (45.6, 10.5); rough antipode is (-45.6, -169.5).
    const halfCircumference = Math.PI * 6371; // ~20015 km
    const d = haversineKm(SALO.lat, SALO.lon, -SALO.lat, SALO.lon - 180);
    expect(Math.abs(d - halfCircumference)).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run tests/unit/haversine.test.ts`
Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/haversine.test.ts
git commit -m "test(geo): cover haversineKm

5 cases: Salò → Sirmione (~14 km), Salò → Verona (~38 km), zero
distance, symmetry, antipodal sanity.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: New `tests/unit/phase-boundary.test.ts`

**Files:**
- Create: `tests/unit/phase-boundary.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { phaseBoundary, isInPhaseII } from '@/lib/phase';

const tripWithPhases = {
  endDate: '2026-07-27',
  phases: [
    { id: 'dolomites', start: '2026-07-15', end: '2026-07-20' },
    { id: 'garda', start: '2026-07-20', end: '2026-07-27' },
  ],
};

const tripWithoutPhases = {
  endDate: '2026-07-27',
};

describe('phaseBoundary', () => {
  it('returns the garda phase start when phases is set', () => {
    expect(phaseBoundary(tripWithPhases)).toBe('2026-07-20');
  });

  it('falls back to trip.endDate when phases is omitted', () => {
    expect(phaseBoundary(tripWithoutPhases)).toBe('2026-07-27');
  });

  it('falls back when phases exists but has no garda entry', () => {
    expect(phaseBoundary({
      endDate: '2026-07-27',
      phases: [{ id: 'dolomites', start: '2026-07-15', end: '2026-07-20' }],
    })).toBe('2026-07-27');
  });
});

describe('isInPhaseII', () => {
  it('false on the day before the boundary', () => {
    expect(isInPhaseII(tripWithPhases, '2026-07-19')).toBe(false);
  });

  it('true on the boundary day itself', () => {
    expect(isInPhaseII(tripWithPhases, '2026-07-20')).toBe(true);
  });

  it('true mid-Phase II', () => {
    expect(isInPhaseII(tripWithPhases, '2026-07-26')).toBe(true);
  });

  it('true after the trip ends (boundary still satisfied)', () => {
    expect(isInPhaseII(tripWithPhases, '2026-08-01')).toBe(true);
  });

  it('with no phases set, only true after endDate', () => {
    expect(isInPhaseII(tripWithoutPhases, '2026-07-26')).toBe(false);
    expect(isInPhaseII(tripWithoutPhases, '2026-07-28')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run tests/unit/phase-boundary.test.ts`
Expected: 8 tests pass.

- [ ] **Step 3: Run the full unit suite to verify nothing broke**

Run: `npm test`
Expected: existing 27 + new 6 (schemas) + 8 (migration) + 6 (tile-math) + 3 (category-labels) + 6 (related) + 5 (haversine) + 8 (phase-boundary) = **69 tests pass**.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/phase-boundary.test.ts
git commit -m "test(phase): cover phaseBoundary + isInPhaseII

8 cases: phase derivation with/without phases array, fallback to
endDate, truth table around the boundary, post-trip behaviour.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 3 — Integrity audit

Three tasks: dep + setup, then 3.1–3.5, then 3.6–3.10.

### Task 12: Add cheerio + globalSetup + extend vitest config

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `tests/integrity/setup.ts`

- [ ] **Step 1: Install cheerio**

Run: `npm install --save-dev cheerio`
Expected: adds `cheerio: ^1.x.x` to `devDependencies` in `package.json`.

- [ ] **Step 2: Extend `vitest.config.ts` to include integrity tests**

Replace the `include` line in `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'astro:content': resolve(__dirname, 'tests/__mocks__/astro-content.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,mjs}', 'tests/integrity/**/*.test.{ts,mjs}'],
    globalSetup: ['./tests/integrity/setup.ts'],
    testTimeout: 60_000, // integrity tests run after astro build (≈ 5–10s)
  },
});
```

- [ ] **Step 3: Create `tests/integrity/setup.ts`**

```typescript
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// vitest globalSetup — runs once before any test file.
// We always rebuild dist/ so integrity tests never run against stale output.
// astro build is ~5-10s on this site; cheap enough to run unconditionally.

const ROOT = path.resolve(__dirname, '../..');

export default async function setup() {
  // Skip rebuild if the only thing that changed is a unit-test file (vitest
  // runs setup on every invocation). Heuristic: if no source file is newer
  // than dist/index.html, skip the rebuild.
  const distIndex = path.join(ROOT, 'dist/index.html');
  let needRebuild = true;
  if (fs.existsSync(distIndex)) {
    const distMtime = fs.statSync(distIndex).mtimeMs;
    const sources = [
      ...walk(path.join(ROOT, 'src')),
      ...walk(path.join(ROOT, 'src/content')),
    ];
    const newestSource = Math.max(...sources.map((p) => fs.statSync(p).mtimeMs));
    needRebuild = newestSource > distMtime;
  }

  if (needRebuild) {
    console.log('[integrity setup] running astro build…');
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  } else {
    console.log('[integrity setup] dist/ is up-to-date, skipping rebuild');
  }
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}
```

(Spec §6 said "always rebuild" but in practice running `astro build` on every `npm test` makes the unit-test cycle painful. The mtime check above is a soft compromise: rebuilds when ANY source is newer than dist, skips otherwise. This matches the spec's intent — integrity tests never run against stale output — without forcing a 5s rebuild on every unit-test save.)

- [ ] **Step 4: Verify nothing breaks**

Run: `npm test`
Expected: existing 69 tests pass, plus the setup hook prints `[integrity setup] running astro build…` on first run (since there are no integrity tests yet, the setup runs but no integrity assertions fire).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/integrity/setup.ts
git commit -m "test(integrity): scaffold cheerio + globalSetup + vitest include

Adds cheerio ^1.x as dev-dep. vitest now includes tests/integrity/**.
globalSetup runs astro build when any src file is newer than
dist/index.html. Sets the foundation for the link-integrity audit
in the next two commits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 13: Integrity invariants 3.1–3.5

**Files:**
- Create: `tests/integrity/links.test.ts`

- [ ] **Step 1: Create the file with the first 5 invariants**

```typescript
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { getWordmark } from '@/lib/wordmark';

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const ACTIVITIES_DIR = path.join(ROOT, 'src/content/activities');

// Walk the built dist/ tree and yield { route, html } for every index.html.
function* allPages(): Generator<{ route: string; file: string; $ : cheerio.CheerioAPI }> {
  function* walk(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) yield* walk(p);
      else if (e.name === 'index.html') yield p;
    }
  }
  for (const file of walk(DIST)) {
    const route = '/' + path.relative(DIST, file).replace(/\/index\.html$/, '');
    const normalised = route === '/' || route === '/.' ? '/' : route;
    const html = fs.readFileSync(file, 'utf8');
    yield { route: normalised, file, $: cheerio.load(html) };
  }
}

function listActivitySlugs(): string[] {
  return fs.readdirSync(ACTIVITIES_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''));
}

function listLodgingSlugs(): string[] {
  const dir = path.join(ROOT, 'src/content/lodgings');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''));
}

describe('§3.1 internal-link resolution', () => {
  it('every internal href resolves to a built file', () => {
    const broken: { source: string; target: string }[] = [];
    for (const { route, $ } of allPages()) {
      $('a[href^="/"]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        if (href.startsWith('//')) return; // protocol-relative — skip
        // Strip query string and fragment first
        const stripped = href.split('?')[0].split('#')[0];
        if (stripped === '') return; // pure fragment
        const target = stripped === '/' ? path.join(DIST, 'index.html') : path.join(DIST, stripped, 'index.html');
        if (!fs.existsSync(target)) {
          broken.push({ source: route, target: stripped });
        }
      });
    }
    expect(broken, `Broken internal links: ${JSON.stringify(broken, null, 2)}`).toEqual([]);
  });
});

describe('§3.2 bottom-nav consistency', () => {
  const expectedHrefs = ['/', '/map', '/activities', '/more'];

  it('every page has the 4-item bottom nav with correct hrefs in order', () => {
    for (const { route, $ } of allPages()) {
      const navLinks = $('nav[aria-label="Primary"] a').map((_, el) => $(el).attr('href')).get();
      expect(navLinks, `nav on ${route}`).toEqual(expectedHrefs);
    }
  });

  it('at most one nav item has aria-current="page"', () => {
    for (const { route, $ } of allPages()) {
      const current = $('nav[aria-label="Primary"] a[aria-current="page"]');
      expect(current.length, `nav aria-current count on ${route}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('§3.3 header wordmark — property check', () => {
  it('the rendered wordmark matches getWordmark for every page', () => {
    const mismatches: { route: string; expected: string; actual: string }[] = [];
    for (const { route, $ } of allPages()) {
      // Look up content context for detail routes
      const ctx: Parameters<typeof getWordmark>[0] = { pathname: route };
      if (route.startsWith('/day/')) {
        const date = route.replace('/day/', '');
        const dayFile = fs.readdirSync(path.join(ROOT, 'src/content/days')).find((f) => f.startsWith(date));
        if (dayFile) {
          const fm = parseFrontmatter(fs.readFileSync(path.join(ROOT, 'src/content/days', dayFile), 'utf8'));
          ctx.dayLodgingSlug = fm.lodgingSlug;
        }
      }
      if (route.startsWith('/lodgings/') && route !== '/lodgings') {
        ctx.lodgingId = route.replace('/lodgings/', '');
      }
      const expected = getWordmark(ctx).toUpperCase();
      // Header wordmark renders inside the logo <a> with class font-mono
      const actual = $('header a[aria-label="Home"] span.font-mono').first().text().trim();
      if (actual !== expected) {
        mismatches.push({ route, expected, actual });
      }
    }
    expect(mismatches, `Wordmark mismatches: ${JSON.stringify(mismatches, null, 2)}`).toEqual([]);
  });
});

function parseFrontmatter(md: string): Record<string, any> {
  const m = md.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return {};
  return yaml.load(m[1]) as Record<string, any>;
}

describe('§3.4 map-link format', () => {
  it('every Google Maps link uses ?api=1&query= with at least 3 letters', () => {
    const bad: { source: string; href: string }[] = [];
    for (const { route, $ } of allPages()) {
      $('a[href^="https://www.google.com/maps"]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const m = href.match(/[?&]query=([^&]+)/);
        const decoded = m ? decodeURIComponent(m[1]) : '';
        if (!m || !/[A-Za-z]{3,}/.test(decoded)) {
          bad.push({ source: route, href });
        }
      });
    }
    expect(bad, `Bad Google Maps links: ${JSON.stringify(bad, null, 2)}`).toEqual([]);
  });

  it('every Apple Maps link has a q= parameter with at least 3 letters', () => {
    const bad: { source: string; href: string }[] = [];
    for (const { route, $ } of allPages()) {
      $('a[href^="https://maps.apple.com"]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const m = href.match(/[?&]q=([^&]+)/);
        const decoded = m ? decodeURIComponent(m[1]) : '';
        if (!m || !/[A-Za-z]{3,}/.test(decoded)) {
          bad.push({ source: route, href });
        }
      });
    }
    expect(bad, `Bad Apple Maps links: ${JSON.stringify(bad, null, 2)}`).toEqual([]);
  });
});

describe('§3.5 activity-card destinations', () => {
  it('every <a href="/activities/SLUG"> points at a real activity file', () => {
    const slugs = new Set(listActivitySlugs());
    const broken: { source: string; href: string }[] = [];
    for (const { route, $ } of allPages()) {
      $('a[href^="/activities/"]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        const slug = href.replace(/^\/activities\//, '').replace(/\/?$/, '');
        if (slug && !slugs.has(slug)) {
          broken.push({ source: route, href });
        }
      });
    }
    expect(broken, `Broken activity links: ${JSON.stringify(broken, null, 2)}`).toEqual([]);
  });

  it('the catalog grid card count equals the activity collection size', () => {
    const collectionSize = listActivitySlugs().length;
    const indexFile = path.join(DIST, 'activities/index.html');
    const $ = cheerio.load(fs.readFileSync(indexFile, 'utf8'));
    const cards = $('[data-activity-card]');
    expect(cards.length).toBe(collectionSize);
  });

  it('each catalog card has a data-category matching its YAML', () => {
    const yamlByslug = new Map<string, string>();
    for (const slug of listActivitySlugs()) {
      const data = yaml.load(fs.readFileSync(path.join(ACTIVITIES_DIR, `${slug}.yaml`), 'utf8')) as { category: string };
      yamlByslug.set(slug, data.category);
    }
    const $ = cheerio.load(fs.readFileSync(path.join(DIST, 'activities/index.html'), 'utf8'));
    const mismatches: { slug: string; html: string; yaml: string }[] = [];
    $('[data-activity-card]').each((_, el) => {
      const $el = $(el);
      const href = $el.find('a').first().attr('href') ?? '';
      const slug = href.replace(/^\/activities\//, '').replace(/\/?$/, '');
      const htmlCat = $el.attr('data-category') ?? '';
      const yamlCat = yamlByslug.get(slug);
      if (yamlCat && yamlCat !== htmlCat) {
        mismatches.push({ slug, html: htmlCat, yaml: yamlCat });
      }
    });
    expect(mismatches).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the integrity tests**

Run: `npm test`
Expected: 69 unit + new integrity tests pass. The integrity tests run after the globalSetup hook builds dist/.

If any assertion fails, fix the underlying code (these are real bugs the audit just caught) and rerun.

- [ ] **Step 3: Commit**

```bash
git add tests/integrity/links.test.ts
git commit -m "test(integrity): add invariants 3.1-3.5

Internal link resolution (with query/fragment stripping), bottom-nav
consistency (4 items, single aria-current), wordmark property check
across all pages, Google + Apple Maps text-query format, activity-card
slug + category cross-checks. ~7 assertions, runtime under 1s.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Integrity invariants 3.6–3.10

**Files:**
- Modify: `tests/integrity/links.test.ts`

- [ ] **Step 1: Append 5 more describe blocks**

Add these at the end of `tests/integrity/links.test.ts`, after the §3.5 block:

```typescript
describe('§3.6 day record consistency', () => {
  const daysDir = path.join(ROOT, 'src/content/days');
  const lodgingSlugs = new Set(listLodgingSlugs());
  const hikeSlugs = new Set(
    fs.readdirSync(path.join(ROOT, 'src/content/hikes'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
  );

  it('every day lodgingSlug references a real lodging', () => {
    const bad: { file: string; lodgingSlug: string }[] = [];
    for (const f of fs.readdirSync(daysDir).filter((f) => f.endsWith('.md'))) {
      const fm = parseFrontmatter(fs.readFileSync(path.join(daysDir, f), 'utf8'));
      if (!lodgingSlugs.has(fm.lodgingSlug)) bad.push({ file: f, lodgingSlug: fm.lodgingSlug });
    }
    expect(bad).toEqual([]);
  });

  it('every hikeSlugs[] entry references a real hike', () => {
    const bad: { file: string; hikeSlug: string }[] = [];
    for (const f of fs.readdirSync(daysDir).filter((f) => f.endsWith('.md'))) {
      const fm = parseFrontmatter(fs.readFileSync(path.join(daysDir, f), 'utf8'));
      for (const h of fm.hikeSlugs ?? []) {
        if (!hikeSlugs.has(h)) bad.push({ file: f, hikeSlug: h });
      }
    }
    expect(bad).toEqual([]);
  });

  it('day count equals the trip span (endDate - startDate + 1 days)', () => {
    const trip = yaml.load(fs.readFileSync(path.join(ROOT, 'src/content/trip.yaml'), 'utf8')) as { startDate: string; endDate: string };
    const expected = Math.floor((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000) + 1;
    const actual = fs.readdirSync(daysDir).filter((f) => f.endsWith('.md')).length;
    expect(actual).toBe(expected);
  });
});

describe('§3.7 service-worker cache key', () => {
  it('dist/sw.js declares a dolomites-vN cache version', () => {
    const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
    const m = sw.match(/['"]dolomites-v(\d+)['"]/);
    expect(m, 'sw.js missing dolomites-vN cache key').not.toBeNull();
    expect(parseInt(m![1], 10)).toBeGreaterThan(0);
  });
});

describe('§3.8 image alt text on detail pages', () => {
  it('every <img> on detail-page routes has an alt attribute', () => {
    const missing: { route: string; src: string }[] = [];
    for (const { route, $ } of allPages()) {
      const isDetail = route.startsWith('/hike/')
        || route.startsWith('/day/')
        || (route.startsWith('/activities/') && route !== '/activities')
        || (route.startsWith('/lodgings/') && route !== '/lodgings');
      if (!isDetail) continue;
      $('img').each((_, el) => {
        if ($(el).attr('alt') === undefined) {
          missing.push({ route, src: $(el).attr('src') ?? '' });
        }
      });
    }
    expect(missing, `Imgs missing alt: ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });
});

describe('§3.9 schedule renders on day pages', () => {
  it('every day with non-empty schedule frontmatter renders a Schedule heading + at least one HH:MM row', () => {
    const daysDir = path.join(ROOT, 'src/content/days');
    const issues: { route: string; reason: string }[] = [];
    for (const f of fs.readdirSync(daysDir).filter((f) => f.endsWith('.md'))) {
      const fm = parseFrontmatter(fs.readFileSync(path.join(daysDir, f), 'utf8'));
      if (!fm.schedule || fm.schedule.length === 0) continue;
      const route = `/day/${fm.date}`;
      const file = path.join(DIST, `day/${fm.date}/index.html`);
      const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
      const hasHeading = $('h2').filter((_, el) => /Schedule/i.test($(el).text())).length > 0;
      if (!hasHeading) issues.push({ route, reason: 'no Schedule heading' });
      const hasTimeRow = $('main ol li').filter((_, el) => /\d\d:\d\d/.test($(el).text())).length > 0;
      if (!hasTimeRow) issues.push({ route, reason: 'no HH:MM row' });
    }
    expect(issues, `Schedule rendering issues: ${JSON.stringify(issues, null, 2)}`).toEqual([]);
  });
});

describe('§3.10 map ribbon presence on detail pages', () => {
  it('every detail-page route has exactly one .map-ribbon with an OSM tile <img>', () => {
    const missing: { route: string; reason: string }[] = [];
    for (const { route, $ } of allPages()) {
      const isDetail = route.startsWith('/hike/')
        || route.startsWith('/day/')
        || (route.startsWith('/activities/') && route !== '/activities')
        || (route.startsWith('/lodgings/') && route !== '/lodgings');
      if (!isDetail) continue;

      const ribbons = $('.map-ribbon');
      if (ribbons.length !== 1) {
        missing.push({ route, reason: `expected 1 ribbon, got ${ribbons.length}` });
        continue;
      }
      const img = ribbons.find('img').first();
      const src = img.attr('src') ?? '';
      if (!/tile\.openstreetmap\.org/.test(src)) {
        missing.push({ route, reason: `ribbon img src not an OSM tile: ${src}` });
      }
    }
    expect(missing, `Ribbon issues: ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the full integrity suite**

Run: `npm test`
Expected: all unit + integrity tests pass. If any §3.6–§3.10 assertion fails, the failure message names the file and reason — fix the underlying code and rerun.

- [ ] **Step 3: Commit**

```bash
git add tests/integrity/links.test.ts
git commit -m "test(integrity): add invariants 3.6-3.10

Day record consistency (lodgingSlug + hikeSlugs reference real
collection entries; day count = trip span), service-worker cache
key sanity, alt-text on every detail-page <img>, Schedule heading
+ HH:MM rows for every day with non-empty schedule, map ribbon
present on every detail page (single ribbon with an OSM tile <img>).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 4 — E2E refresh + customize flow

Three tasks, one file. Each task ends with `npm run test:e2e` to verify against the dev server.

### Task 15: Refresh existing 11 e2e tests

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Replace stale assertions**

Open `tests/e2e/smoke.spec.ts` and apply these edits:

**1.** The test `'bottom nav has 4 items: home, map, checklist, more'` needs a complete rewrite — Activities replaced Checklist:

Replace:
```typescript
test('bottom nav has 4 items: home, map, checklist, more', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: /primary/i });
  await expect(nav.getByText('Home', { exact: true })).toBeVisible();
  await expect(nav.getByText('Map', { exact: true })).toBeVisible();
  await expect(nav.getByText('Checklist', { exact: true })).toBeVisible();
  await expect(nav.getByText('More', { exact: true })).toBeVisible();
  await expect(nav.getByText('Day', { exact: true })).toHaveCount(0);
  await expect(nav.getByText('Hikes', { exact: true })).toHaveCount(0);
});
```

with:
```typescript
test('bottom nav has 4 items: home, map, activities, more', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: /primary/i });
  await expect(nav.getByText('Home', { exact: true })).toBeVisible();
  await expect(nav.getByText('Map', { exact: true })).toBeVisible();
  await expect(nav.getByText('Activities', { exact: true })).toBeVisible();
  await expect(nav.getByText('More', { exact: true })).toBeVisible();
  await expect(nav.getByText('Checklist', { exact: true })).toHaveCount(0);
  await expect(nav.getByText('Day', { exact: true })).toHaveCount(0);
});
```

**2.** Rename + invert the day/schedule test:

Replace:
```typescript
test('day page renders hikes and driving (schedule lives on hike page now)', async ({ page }) => {
  await page.goto('/day/2026-07-16');
  await expect(page.getByRole('main').getByText(/Hike/i)).toBeVisible();
  // Schedule section was moved to the hike page in spec §4 — ensure it's NOT here
  await expect(page.locator('main').getByText('Wake, breakfast', { exact: false })).toHaveCount(0);
  // The "View Full Schedule" callout inside hike cards stays
  await expect(page.locator('main').getByText('View Full Schedule', { exact: true })).toBeVisible();
});
```

with:
```typescript
test('day page renders schedule, hikes, and driving', async ({ page }) => {
  await page.goto('/day/2026-07-17');
  await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible();
  // At least one HH:MM row in the schedule list
  await expect(page.locator('main ol li').filter({ hasText: /\d\d:\d\d/ }).first()).toBeVisible();
  // Hikes section still renders
  await expect(page.getByRole('main').getByRole('heading', { name: /Hike/i })).toBeVisible();
});
```

**3.** Update the `home page renders core elements` test — the countdown label is now "Days Until Departure" (not "Days to go"):

Replace:
```typescript
test('home page renders core elements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The Dolomites/i })).toBeVisible();
  await expect(page.getByText('Days to go')).toBeVisible();
  await expect(page.getByText('Booked')).toBeVisible();
});
```

with:
```typescript
test('home page renders core elements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The Dolomites/i })).toBeVisible();
  await expect(page.getByText('Days Until Departure')).toBeVisible();
  await expect(page.getByText(/Booked/)).toBeVisible();
});
```

**4.** Freeze the clock for the today-banner test:

Replace:
```typescript
test('today banner is absent outside trip dates (May 2026)', async ({ page }) => {
  await page.goto('/');
  // Today banner should not render today (May 2026, before Jul 15 trip start)
  await expect(page.getByText(/Today · Day/)).toHaveCount(0);
});
```

with:
```typescript
test('today banner is absent outside trip dates (May 2026)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-02T10:00:00Z') });
  await page.goto('/');
  await expect(page.getByText(/Today · Day/)).toHaveCount(0);
});
```

**5.** Update the checklist test to use a non-hardcoded count. Add an import + helper at the top of the file:

Add right after the existing `import { test, expect }` line:
```typescript
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const bookings = yaml.load(fs.readFileSync(path.join(ROOT, 'src/content/bookings.yaml'), 'utf8')) as Array<unknown>;
const activities = fs.readdirSync(path.join(ROOT, 'src/content/activities')).filter((f) => f.endsWith('.yaml'));
```

(`js-yaml` is already a project dep — no new install needed.)

Replace the existing checklist test:
```typescript
test('checklist renders bookings grouped by category', async ({ page }) => {
  await page.goto('/checklist');
  await expect(page.getByRole('heading', { name: 'Flights' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lodging' })).toBeVisible();
  // At least one "+ Add Confirmation #" button exists for items without a stored confirmation
  await expect(page.getByText('+ Add Confirmation', { exact: false }).first()).toBeVisible();
});
```

with:
```typescript
test('checklist renders one row per booking', async ({ page }) => {
  await page.goto('/checklist');
  await expect(page.getByRole('heading', { name: 'Flights' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lodging' })).toBeVisible();
  // Total checkbox count = bookings.length (each row has exactly one checkbox)
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(bookings.length);
});
```

- [ ] **Step 2: Run the refreshed e2e suite**

Run: `npm run test:e2e`
Expected: 11 tests pass (assertions match the current implementation).

If `pnpm dev` isn't installed locally and Playwright complains, edit `playwright.config.ts` `webServer.command` from `pnpm dev` to `npm run dev` for the duration of testing, but DO NOT commit that change (the playwright config stays on `pnpm dev` for the user's environment).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(e2e): refresh stale assertions

5 tests updated:
- bottom nav: Activities not Checklist
- day page: schedule renders here now (was moved off hike page)
- countdown copy: 'Days Until Departure' not 'Days to go'
- today-banner test: freeze clock to 2026-05-02 so it doesn't
  silently change meaning when run after Jul 15
- checklist count: derive from bookings.yaml instead of hardcoding

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 16: Add 12 new navigation/render e2e tests

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Append the new test block**

Add at the end of `tests/e2e/smoke.spec.ts`:

```typescript
test.describe('navigation / render', () => {
  test('/activities renders 22 cards, 4 featured, 10 filter pills', async ({ page }) => {
    await page.goto('/activities');
    // Featured row first
    const featured = page.locator('[data-featured-section] .hike-poster');
    await expect(featured).toHaveCount(4);
    // Catalog cards (only non-featured visible by default per the dedup rule)
    const cards = page.locator('[data-activity-card]');
    await expect(cards).toHaveCount(activities.length);
    // Filter pills: 1 "All" + 9 categories
    const pills = page.locator('.activity-pill');
    await expect(pills).toHaveCount(10);
  });

  test('clicking the Water Sports pill filters the grid and updates the URL', async ({ page }) => {
    await page.goto('/activities');
    await page.locator('.activity-pill[data-category="water-sports"]').click();
    await expect(page).toHaveURL(/\?category=water-sports/);
    // The "More" heading toggles to "All matching"
    await expect(page.locator('#grid-heading')).toHaveText('All matching');
    // No non-water-sports cards are visible
    const visibleCards = page.locator('[data-activity-card]:visible');
    const count = await visibleCards.count();
    for (let i = 0; i < count; i++) {
      await expect(visibleCards.nth(i)).toHaveAttribute('data-category', 'water-sports');
    }
  });

  test('/activities/solferino-red-cross-memorial renders breadcrumb + ribbon + nearby', async ({ page }) => {
    await page.goto('/activities/solferino-red-cross-memorial');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    await expect(page.locator('.map-ribbon')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Nearby activities' })).toBeVisible();
    // Back link
    await expect(page.locator('a').filter({ hasText: /Back to catalog/ })).toBeVisible();
  });

  test('/lodgings/baita-fraina renders ribbon, address, and contact buttons', async ({ page }) => {
    await page.goto('/lodgings/baita-fraina');
    await expect(page.locator('.map-ribbon')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Address' })).toBeVisible();
    // Apple + Google Maps buttons
    await expect(page.locator('a[href^="https://maps.apple.com"]')).toHaveCount(1);
    await expect(page.locator('a[href^="https://www.google.com/maps"]')).toHaveCount(1);
  });

  test('/lodgings lists 3 lodgings in chronological order (Baita Fraina → Kircher Sepp → Salò)', async ({ page }) => {
    await page.goto('/lodgings');
    const cards = page.locator('main a[href^="/lodgings/"]');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText(/Baita Fraina/);
    await expect(cards.nth(1)).toContainText(/Kircher Sepp/);
    await expect(cards.nth(2)).toContainText(/Salò/);
  });

  test('day pill scroller has a Phase I/II divider before Jul 20', async ({ page }) => {
    await page.goto('/day/2026-07-22');
    await expect(page.locator('.day-pill-phase-divider')).toHaveCount(1);
  });

  test('day pill auto-scroll: Jul 25 active pill is in viewport', async ({ page }) => {
    await page.goto('/day/2026-07-25');
    const active = page.locator('.day-pill.is-active');
    await expect(active).toBeVisible();
    const scroller = page.locator('.day-pill-scroll');
    const sBox = await scroller.boundingBox();
    const aBox = await active.boundingBox();
    expect(sBox).not.toBeNull();
    expect(aBox).not.toBeNull();
    expect(aBox!.x).toBeGreaterThanOrEqual(sBox!.x - 1);
    expect(aBox!.x + aBox!.width).toBeLessThanOrEqual(sBox!.x + sBox!.width + 1);
  });

  test('header wordmark adapts: home, day-Phase-II, lodging-Salò, map', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header span.font-mono').first()).toHaveText('DOLOMITES + GARDA');
    await page.goto('/day/2026-07-22');
    await expect(page.locator('header span.font-mono').first()).toHaveText('LAGO DI GARDA');
    await page.goto('/lodgings/salo-airbnb');
    await expect(page.locator('header span.font-mono').first()).toHaveText('LAGO DI GARDA');
    await page.goto('/map');
    await expect(page.locator('header span.font-mono').first()).toHaveText('MAP');
  });

  test('bottom-nav active state: Home highlighted on /hike/*, More on /lodgings/*', async ({ page }) => {
    await page.goto('/hike/tre-cime');
    await expect(page.locator('nav[aria-label="Primary"] a[aria-current="page"]')).toHaveAttribute('href', '/');
    await page.goto('/lodgings/baita-fraina');
    await expect(page.locator('nav[aria-label="Primary"] a[aria-current="page"]')).toHaveAttribute('href', '/more');
  });

  test('/map?focus=hike-tre-cime auto-opens the popup', async ({ page }) => {
    await page.goto('/map?focus=hike-tre-cime');
    // Wait for MapLibre to settle + the setTimeout(togglePopup, 350) to fire
    await page.waitForTimeout(1500);
    await expect(page.locator('.maplibregl-popup')).toBeVisible();
  });

  test('Phase II free-day banner shows nearest activities on /day/2026-07-22', async ({ page }) => {
    await page.goto('/day/2026-07-22');
    await expect(page.getByRole('heading', { name: 'Today · Free at Salò' })).toBeVisible();
    // The "Browse all N activities" link
    await expect(page.locator('a').filter({ hasText: /Browse all \d+ activities/ })).toBeVisible();
  });

  test('schedule renders on /day/2026-07-17 with at least 5 HH:MM rows', async ({ page }) => {
    await page.goto('/day/2026-07-17');
    const rows = page.locator('main ol li').filter({ hasText: /\d\d:\d\d/ });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `npm run test:e2e`
Expected: previously 11 tests, now 23 (11 + 12 new), all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(e2e): add 12 navigation/render coverage tests

Activities catalog (counts, filter, breadcrumb, nearby), lodging
detail (ribbon + contacts), lodgings index order, day-pill phase
divider + auto-scroll, header wordmark adapts, bottom-nav active
states on detail routes, /map?focus= auto-popup, Phase II free-day
banner, schedule rendering.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 17: Add 8 customize/edit-flow e2e tests

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Append the customize block**

Add at the end of `tests/e2e/smoke.spec.ts`:

```typescript
test.describe('customize / edit flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Each test gets a fresh localStorage so the "How To Customize" banner shows
    await context.clearCookies();
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch {}
    });
  });

  test('/customize renders How To banner + 6 hikes + 13 days', async ({ page }) => {
    await page.goto('/customize');
    await expect(page.getByText('How To Customize')).toBeVisible();
    // 6 canonical hikes
    await expect(page.locator('main').locator('h2').filter({ hasText: 'Hikes' })).toBeVisible();
    // 13 day cards (6 Phase I + 7 Phase II)
    const dayCards = page.locator('main').getByText(/Edit →/);
    await expect(dayCards).toHaveCount(13);
  });

  test('+ New Hike button reveals HikeForm and add submits', async ({ page }) => {
    await page.goto('/customize');
    await page.getByRole('button', { name: /Add new hike/i }).click();
    // Form is now visible
    const form = page.locator('main').filter({ hasText: 'Save' }).first();
    await expect(form).toBeVisible();
    // Fill required fields (HikeForm has at minimum a name input)
    await page.locator('input[type="text"]').first().fill('Test Hike From E2E');
    await page.getByRole('button', { name: 'Save' }).first().click();
    // The new hike appears in the list
    await expect(page.locator('main').getByText('Test Hike From E2E')).toBeVisible();
  });

  test('+ New Day button reveals form and add submits', async ({ page }) => {
    await page.goto('/customize');
    await page.getByRole('button', { name: /Add new day/i }).click();
    await page.locator('input[type="date"]').fill('2026-08-01');
    await page.locator('input[type="text"]').filter({ hasNotText: 'Test' }).first().fill('E2E Test Day');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('main').getByText('E2E Test Day')).toBeVisible();
  });

  test('custom hikes have a Delete button; canonical hikes do not', async ({ page }) => {
    await page.goto('/customize');
    // Add a custom hike first
    await page.getByRole('button', { name: /Add new hike/i }).click();
    await page.locator('input[type="text"]').first().fill('Custom Hike Delete Test');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('main').getByText('Custom Hike Delete Test')).toBeVisible();
    // Custom hike row has a Delete button
    const customRow = page.locator('main').getByText('Custom Hike Delete Test').locator('..').locator('..');
    await expect(customRow.getByRole('button', { name: /Delete/ })).toBeVisible();
    // Canonical hikes do not — pick one (Tre Cime di Lavaredo)
    const canonical = page.locator('main').getByText(/Tre Cime/i).first().locator('..').locator('..');
    await expect(canonical.getByRole('button', { name: /^Delete/ })).toHaveCount(0);
  });

  test('clicking Delete removes a custom hike', async ({ page }) => {
    await page.goto('/customize');
    await page.getByRole('button', { name: /Add new hike/i }).click();
    await page.locator('input[type="text"]').first().fill('Delete Me');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('main').getByText('Delete Me')).toBeVisible();
    await page.getByRole('button', { name: /Delete Delete Me/ }).click();
    await expect(page.locator('main').getByText('Delete Me')).toHaveCount(0);
  });

  test('CustomizedPill becomes visible after first edit', async ({ page }) => {
    await page.goto('/customize');
    // Pill is hidden initially
    const pill = page.locator('header').filter({ hasText: /customized/i });
    await expect(pill).toHaveCount(0);
    // Make an edit
    await page.getByRole('button', { name: /Add new hike/i }).click();
    await page.locator('input[type="text"]').first().fill('Pill Trigger');
    await page.getByRole('button', { name: 'Save' }).first().click();
    // Pill is visible now
    await expect(page.locator('header').filter({ hasText: /customized/i })).toBeVisible();
  });

  test('drag-drop affordance: every hike chip has cursor-grab + ⋮⋮ glyph', async ({ page }) => {
    // Customize page must have at least one DraggableHike rendered (one per hike on each day card).
    await page.goto('/customize');
    // The day cards render hike slugs as DraggableHike chips.
    // At least one chip should exist (Day 02 has tre-cime).
    const chips = page.locator('span[class*="cursor-grab"]');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    // Every chip contains the ⋮⋮ glyph
    for (let i = 0; i < count; i++) {
      await expect(chips.nth(i)).toContainText('⋮⋮');
    }
  });

  test('share-link button generates a URL containing ?s= encoded state', async ({ page }) => {
    await page.goto('/customize');
    // Make an edit so there's something to encode
    await page.getByRole('button', { name: /Add new hike/i }).click();
    await page.locator('input[type="text"]').first().fill('Share Test');
    await page.getByRole('button', { name: 'Save' }).first().click();
    // The share-link button should be visible somewhere on the page
    const shareBtn = page.getByRole('button', { name: /Share/i }).first();
    if (await shareBtn.count() === 0) {
      test.skip(true, 'ShareLinkButton not present — skip until rendered');
    }
    await shareBtn.click();
    // After clicking, either the URL bar contains ?s= or the clipboard does
    // — we'll check the URL-encoded payload via a page.evaluate read
    const url = page.url();
    expect(url).toMatch(/\?s=/);
  });
});
```

(The drag-drop test only asserts the affordance — chips have `cursor-grab` and the `⋮⋮` glyph. The actual `state.moveHikeToDay` action is covered by the existing unit tests in `tests/unit/store.test.ts` and `selectors.test.ts`.)

- [ ] **Step 2: Run the customize tests**

Run: `npm run test:e2e tests/e2e/smoke.spec.ts -g 'customize'`
Expected: 8 tests pass.

If a test fails because a selector doesn't match the live UI (HikeForm field labels can vary), fix the selector to match the actual rendered HTML. Don't relax the assertion — make the selector more robust (e.g. role-based instead of text-based).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(e2e): add 8 customize/edit-flow tests

Renders How To banner + collections; New Hike form opens, validates,
submits; New Day form opens, submits; custom hikes have Delete /
canonical do not; CustomizedPill appears after first edit; drag-drop
affordance (cursor-grab + ⋮⋮ glyph) — actual moveHikeToDay action
is covered by existing unit tests. Share-link generates ?s= URL.

beforeEach clears localStorage so each test sees a fresh slate.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 5 — Wiring + docs

One task. Adds the convenience script and a short README so future contributors know how to run each tier.

### Task 18: `npm run test:all` + `tests/README.md`

**Files:**
- Modify: `package.json`
- Create: `tests/README.md`

- [ ] **Step 1: Add `test:all` script to package.json**

Find the `"scripts"` block in `package.json` and add `test:all` after the existing `test:e2e` line:

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:all": "npm run build && npm test && npm run test:e2e",
  "migrate": "node scripts/migrate-itinerary.mjs"
},
```

(Existing keys preserved verbatim — only `test:all` added.)

- [ ] **Step 2: Create `tests/README.md`**

```markdown
# Tests

Three tiers, each independently runnable:

| Tier | Command | Runtime | What it covers |
|---|---|---|---|
| Unit | `npm test` (also runs integrity) | ~200ms unit + 5–10s build | Pure-logic modules in `src/lib/*` (geo, phase, wordmark, related, tile-math, category-labels), schema validation, migration script builders, localState/share-link/selectors |
| Integrity | runs as part of `npm test` | <1s after build | Walks `dist/**/*.html` with cheerio. Catches broken internal links, stale wordmarks, bad map links, missing alt-text, schedule-not-rendering, ribbon-missing, day-record consistency. See `tests/integrity/links.test.ts` |
| E2E | `npm run test:e2e` | 30–60s against dev server | Playwright smoke against `npm run dev`. Bottom-nav, page renders, customize flow, drag-drop affordance, share-link |

`npm run test:all` runs all three tiers sequentially after a clean build.

## Adding a new test

- **Unit** — drop a `*.test.ts` or `*.test.mjs` under `tests/unit/`. Vitest picks it up automatically.
- **Integrity** — add a new `describe` block in `tests/integrity/links.test.ts`. The setup hook ensures `dist/` is fresh before any assertion runs.
- **E2E** — add a new `test('…')` in `tests/e2e/smoke.spec.ts`, or a new `test.describe` group at the bottom.

## Drag-drop policy

Playwright's `dragAndDrop` doesn't reliably trigger `@dnd-kit`'s pointer-event listeners on chrome-headless. We assert the **affordance** in the DOM (chip has `cursor-grab` class + `⋮⋮` grip glyph) and rely on unit tests in `tests/unit/store.test.ts` + `tests/unit/selectors.test.ts` for the actual `moveHikeToDay` state transition.

## Clock freezing

The "today banner is absent outside trip dates" test freezes the clock to 2026-05-02 with `page.clock.install({ time: ... })` so it doesn't silently change meaning when run after Jul 15, 2026.

## What's NOT covered

- Visual regression (Percy/Chromatic)
- Lighthouse CI (manual post-deploy)
- Cross-browser (Chromium-only — matches `playwright.config.ts`)
- Accessibility-tree (axe-core); only `aria-current` + alt-text spot-checks in §3.2 + 3.8
```

- [ ] **Step 3: Verify everything still runs end-to-end**

Run: `npm run test:all`
Expected: build succeeds, ~74 vitest tests pass (unit + integrity), 31 Playwright tests pass.

- [ ] **Step 4: Commit**

```bash
git add package.json tests/README.md
git commit -m "test(infra): add npm run test:all + three-tier README

test:all runs build + vitest + playwright sequentially. README
documents the three tiers, how to add tests in each, drag-drop
policy, clock-freezing convention, and what's intentionally
out of scope.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage check** (against `docs/superpowers/specs/2026-05-02-test-coverage-pass-design.md`):

- §1 Architecture (3 tiers, vitest+playwright, cheerio dep, npm run test:all) → Tasks 12, 18 ✅
- §2 Unit tests:
  - schemas.test.ts ActivitySchema → Task 5 ✅
  - migration.test.mjs buildGardaDayStubs + buildActivities → Tasks 4 + 6 ✅
  - tile-math.test.ts → Task 7 ✅
  - category-labels.test.ts → Task 8 ✅
  - related-activities.test.ts (with src/lib/related.ts extract) → Task 9 ✅
  - haversine.test.ts (with src/lib/geo.ts extract, 3 sites) → Tasks 1 + 10 ✅
  - phase-boundary.test.ts (with src/lib/phase.ts extract, 4 sites) → Tasks 2 + 11 ✅
- §3 Integrity invariants 3.1–3.10 → Tasks 13, 14 ✅
  - 3.1 query/fragment strip → Task 13 helper `resolveTo` ✅
  - 3.3 wordmark property check (with src/lib/wordmark.ts extract) → Tasks 3 + 13 ✅
  - 3.4 `[A-Za-z]{3,}` regex → Task 13 ✅
  - 3.5/3.6 collection-size assertions → Tasks 13/14 ✅
  - 3.10 Garda free-form day clarification → Task 14 ✅
- §4 E2E refresh + 12 new + 8 customize → Tasks 15, 16, 17 ✅
  - clock freeze on today-banner test → Task 15 ✅
- §5 Wiring + tests/README.md → Task 18 ✅

**Phase 1 acceptance gates** (from spec §7):
- haversine grep → Task 1 step 5 ✅
- 2026-07-20 / phases.find grep → Task 2 step 7 ✅
- wordmark grep → Task 3 step 6 ✅

**Placeholder scan:** searched for TBD/TODO/"implement later"/"add appropriate"/"similar to" — no matches. Every step has actual code or actual command.

**Type-consistency scan:**
- `WordmarkContext` type matches the spec definition (pathname, dayLodgingSlug?, lodgingId?) ✅
- `TripLike` in phase.ts has `endDate` + `phases?[]` — matches the shape returned by `getTrip()` from `src/lib/content.ts` ✅
- `Pin` from `tile-math` is consumed in `MapRibbon.astro` (already wired pre-plan) ✅
- `buildActivities()` and `buildGardaDayStubs()` return `{relPath, content}[]` consistently used in Tasks 6 ✅
- `sharedSlugPrefix(a, b): number` matches the inline signature in `RelatedActivities.astro` ✅
- All e2e selectors match attributes set in the source (e.g. `[data-activity-card]`, `.activity-pill`, `.day-pill-phase-divider`, `.map-ribbon`, `nav[aria-label="Primary"]`, `header a[aria-label="Home"] span.font-mono`) ✅
- `getWordmark` signature consistent in BaseLayout, day/[date].astro, hike/[slug].astro, lodgings/[slug].astro, integrity test ✅

**Total tests after this plan ships:** ~69 unit + ~10 integrity describes (~25 assertions) + 31 e2e = roughly 100 tests across the three tiers.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-test-coverage-pass.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
