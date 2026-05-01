# Trip Data Verification & Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 24 verified data corrections (hikes, drive times, restaurants, lodging) discovered by the audit, restructure the per-day driving field into an array of legs so multi-leg days like Day 4 render legibly, and update the source markdown + migration script + UI in a coordinated pass that survives a re-migration.

**Architecture:** The pattern is "edit the source markdown + migration script, re-run migration, verify". The schema change (single-leg → array-of-legs `driving.legs[]`) requires coordinated updates to: `src/content/config.ts` (Zod), `scripts/migrate-itinerary.mjs` (parser + emitter), and the consumers (day page + hike page Part II) — all done together so the build stays green at each commit.

**Tech Stack:** Astro 5, Zod (existing), JS migration script (existing), Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-01-data-verification-design.md`

---

## Conventions

- Absolute file paths from repo root.
- All commits include `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- All shell commands assume `eval "$(mise activate zsh)"` already run.
- "Verify build" = `pnpm build` exits 0; "verify check" = `pnpm check` exits 0; "verify tests" = `pnpm test` exits 0 (currently 22/22 + 11/11 e2e).
- The source markdown is `dolomites-garda-itinerary.md` at the repo root. The migration runs `pnpm migrate` (= `node scripts/migrate-itinerary.mjs`).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `dolomites-garda-itinerary.md` | Modify (heavy) | The source-of-truth doc; receives all hike-fact, operator, parking, lodging, and drive-leg corrections |
| `src/content/config.ts` | Modify | DaySchema's `driving` shape changes from single-leg to array of legs |
| `scripts/migrate-itinerary.mjs` | Modify (heavy) | New `parseDriveLegs` helper; `emitDay` uses legs[]; `emitLodgings` + `emitRestaurants` get edited data |
| `tests/unit/schemas.test.ts` | Modify | Add a Zod test for the new `driving.legs[]` shape |
| `tests/unit/migration.test.mjs` | Modify | Add a test that day-blocks with `**Drive legs:**` parse to a legs array |
| `src/content/days/*.md` | Generated | Re-emitted by migration; new `driving.legs[]` shape |
| `src/content/hikes/*.md` | Generated | Re-emitted with corrected facts |
| `src/content/lodgings/pension-kircher-sepp.yaml` | Generated | Address corrected via `emitLodgings` |
| `src/content/restaurants/*.yaml` | Generated | Restaurants edited via `emitRestaurants` |
| `src/components/DriveLegs.astro` | Create | Reusable renderer: takes `legs[]` and renders a list + computed total |
| `src/pages/day/[date].astro` | Modify | Use `<DriveLegs>` instead of inline driving HTML |
| `src/pages/hike/[slug].astro` | Modify | Same — Part II's "Driving" sub-section uses `<DriveLegs>` |

---

## Phase 1 — Schema + migration (foundation)

### Task 1: Update DaySchema's `driving` to an array of legs

**Files:**
- Modify: `src/content/config.ts`
- Modify: `tests/unit/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/unit/schemas.test.ts`, append a new test inside the existing `describe('content schemas', ...)` block:

```ts
  it('day accepts a driving.legs array', () => {
    const day = {
      date: '2026-07-18', theme: 'Test',
      driving: {
        legs: [
          { from: 'Cortina', to: 'Braies', distanceKm: 50, durationMin: 55 },
          { from: 'Braies', to: 'Cadini', distanceKm: 42, durationMin: 60, notes: 'Toll road' },
        ],
      },
      schedule: [],
      hikeSlugs: ['lago-di-braies', 'cadini'],
      lodgingSlug: 'pension-kircher-sepp',
      weatherFor: { lat: 46.6, lon: 12.3, label: 'Cortina' },
    };
    expect(DaySchema.parse(day)).toEqual(day);
  });

  it('day rejects the legacy single-leg driving shape', () => {
    const day = {
      date: '2026-07-16', theme: 'Test',
      driving: { distanceKm: 50, durationMin: 90 },  // legacy shape
      schedule: [], hikeSlugs: [], lodgingSlug: 'baita-fraina',
      weatherFor: { lat: 46.5, lon: 12.1, label: 'Cortina' },
    };
    expect(() => DaySchema.parse(day)).toThrow();
  });
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm test tests/unit/schemas.test.ts
```
Expected: the new tests fail (shape doesn't accept `legs`).

- [ ] **Step 3: Update `DaySchema` in `src/content/config.ts`**

Find the existing `DaySchema`:

```ts
export const DaySchema = z.object({
  date: ISODate,
  theme: z.string(),
  driving: z.object({ distanceKm: z.number(), durationMin: z.number(), notes: z.string().optional() }),
  schedule: z.array(z.object({ time: HHMM, action: z.string() })),
  hikeSlugs: z.array(z.string()),
  lodgingSlug: z.string(),
  weatherFor: z.object({ lat: z.number(), lon: z.number(), label: z.string() }),
  badWeatherOption: z.string().optional(),
});
```

Replace with:

```ts
const DriveLeg = z.object({
  from: z.string(),
  to: z.string(),
  distanceKm: z.number(),
  durationMin: z.number(),
  notes: z.string().optional(),
});

export const DaySchema = z.object({
  date: ISODate,
  theme: z.string(),
  driving: z.object({
    legs: z.array(DriveLeg),
  }),
  schedule: z.array(z.object({ time: HHMM, action: z.string() })),
  hikeSlugs: z.array(z.string()),
  lodgingSlug: z.string(),
  weatherFor: z.object({ lat: z.number(), lon: z.number(), label: z.string() }),
  badWeatherOption: z.string().optional(),
});
```

Note: `legs` is required, but can be an empty array on no-driving days (Day 1 has driving; only the Wed arrival landing → Cortina drive → so all 6 days have at least one leg, but the schema allows zero too).

- [ ] **Step 4: Run tests**

```bash
pnpm test tests/unit/schemas.test.ts
```
Expected: both new tests pass; existing schema tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/config.ts tests/unit/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): driving becomes array of legs

DaySchema's driving field changes from a single
{ distanceKm, durationMin, notes? } shape to
{ legs: [{ from, to, distanceKm, durationMin, notes? }] }
so multi-leg days (Day 4: Cortina → Braies → Cadini → Brixen)
render with structure instead of a single bogus aggregate.

Tests: 2 new schema tests (accept legs array, reject legacy shape).
Migration script update + content regeneration follow in Tasks 2-5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update the migration parser and emitter for multi-leg driving

**Files:**
- Modify: `scripts/migrate-itinerary.mjs`
- Modify: `tests/unit/migration.test.mjs`

This task adds a new parsing path. The source markdown will use a new `**Drive legs:**` block per day (added in Task 4); for now the parser supports it with a unit test against an inline fixture.

- [ ] **Step 1: Add the failing test**

In `tests/unit/migration.test.mjs`, append:

```js
import { parseDriveLegs } from '../../scripts/migrate-itinerary.mjs';

describe('parseDriveLegs', () => {
  it('parses a single-leg block', () => {
    const block = `
something else
**Drive legs:**
- Cortina · Baita Fraina → Rifugio Auronzo — 25 km / 45 min
**Hikes:**`;
    expect(parseDriveLegs(block)).toEqual([
      { from: 'Cortina · Baita Fraina', to: 'Rifugio Auronzo', distanceKm: 25, durationMin: 45 },
    ]);
  });

  it('parses a multi-leg block (Day 4 shape)', () => {
    const block = `
**Drive legs:**
- Cortina → Lago di Braies P3 — 50 km / 55 min
- Lago di Braies → Rifugio Auronzo (Cadini) — 42 km / 1h 0m
- Rifugio Auronzo → Pension Kircher Sepp (Barbiano) — 111 km / 2h 15m
**Hikes:**`;
    const legs = parseDriveLegs(block);
    expect(legs).toHaveLength(3);
    expect(legs[0]).toEqual({ from: 'Cortina', to: 'Lago di Braies P3', distanceKm: 50, durationMin: 55 });
    expect(legs[1]).toEqual({ from: 'Lago di Braies', to: 'Rifugio Auronzo (Cadini)', distanceKm: 42, durationMin: 60 });
    expect(legs[2]).toEqual({ from: 'Rifugio Auronzo', to: 'Pension Kircher Sepp (Barbiano)', distanceKm: 111, durationMin: 135 });
  });

  it('returns empty array if no legs block present', () => {
    expect(parseDriveLegs('no driving here')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
pnpm test tests/unit/migration.test.mjs
```
Expected: the 3 new tests fail with "parseDriveLegs is not a function".

- [ ] **Step 3: Add `parseDriveLegs` and a duration helper to the migration script**

In `scripts/migrate-itinerary.mjs`, add this helper near the top (just under the `slugify` declaration block):

```js
/**
 * Parse a "Xh Ym" or "Xh" or "Y min" duration string into total minutes.
 *   "55 min" → 55
 *   "1h"     → 60
 *   "1h 0m"  → 60
 *   "2h 15m" → 135
 */
function parseDurationToMinutes(s) {
  const hMatch = s.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/i);
  if (hMatch) {
    return parseInt(hMatch[1], 10) * 60 + (hMatch[2] ? parseInt(hMatch[2], 10) : 0);
  }
  const mMatch = s.match(/(\d+)\s*min/i);
  if (mMatch) return parseInt(mMatch[1], 10);
  return 0;
}

/**
 * Parse a "**Drive legs:**" block from a day's markdown section.
 * Format expected, one line per leg:
 *   - {from} → {to} — {km} km / {duration}
 * Returns an array of { from, to, distanceKm, durationMin } objects.
 */
export function parseDriveLegs(block) {
  // Find the "**Drive legs:**" line and read subsequent "- ..." lines until a blank
  // line, a heading, or another bold label appears.
  const m = block.match(/\*\*Drive legs:\*\*\s*\n([\s\S]+?)(?=\n\*\*|\n#{1,6} |\n---|\n\n)/);
  if (!m) return [];
  const body = m[1];
  const legs = [];
  for (const line of body.split('\n')) {
    // " - From → To — 25 km / 45 min "  (em dash before km, en/em dash between from/to)
    const lm = line.match(/^\s*-\s+(.+?)\s*→\s*(.+?)\s*—\s*([\d.]+)\s*km\s*\/\s*(.+?)\s*$/);
    if (lm) {
      legs.push({
        from: lm[1].trim(),
        to: lm[2].trim(),
        distanceKm: parseFloat(lm[3]),
        durationMin: parseDurationToMinutes(lm[4]),
      });
    }
  }
  return legs;
}
```

- [ ] **Step 4: Update `parseDays` to use the new helper, set legs on the day**

In `parseDays`, find the existing block that constructs `driving`:

```js
    const drivingMatch = block.match(/\*\*Driving:\*\*\s*~?(\d+)\s*km[^(]*(?:\(~?(\d+)h(?:\s*(\d+)m)?\)|\(~?(\d+)\s*min\))/i);
    let driving = { distanceKm: 0, durationMin: 0 };
    if (drivingMatch) {
      const km = parseInt(drivingMatch[1], 10);
      const h = drivingMatch[2] ? parseInt(drivingMatch[2], 10) : 0;
      const m = drivingMatch[3] ? parseInt(drivingMatch[3], 10) : drivingMatch[4] ? parseInt(drivingMatch[4], 10) : 0;
      driving = { distanceKm: km, durationMin: h * 60 + m };
    }
```

Replace with:

```js
    const legs = parseDriveLegs(block);
    const driving = { legs };
```

(Drop the old single-line parsing entirely. The new `**Drive legs:**` block in the source markdown is the only supported format.)

Then in the `days.push({...})` call, the existing `driving` reference still works (now an object with `legs`).

- [ ] **Step 5: Update `emitDay` to emit the new shape**

Find `emitDay`:

```js
function emitDay(day) {
  const slug = `${day.date}-${slugify(day.theme.split('→').pop().split(',')[0])}`;
  const fm = {
    date: day.date,
    theme: day.theme,
    driving: day.driving,
    schedule: day.schedule,
    hikeSlugs: day.hikeSlugs,
    lodgingSlug: day.lodgingSlug,
    weatherFor: day.weatherFor,
  };
```

It already pipes `day.driving` through. Since `driving` is now `{ legs: [...] }`, the existing `toYAML` will serialize it correctly. **No code change needed here**, but add a comment for future readers:

```js
function emitDay(day) {
  // day.driving is now { legs: [{ from, to, distanceKm, durationMin, notes? }] }
  // (changed from { distanceKm, durationMin } in 2026-05-01 audit pass).
  const slug = `${day.date}-${slugify(day.theme.split('→').pop().split(',')[0])}`;
  ...
```

(Just add the two comment lines.)

- [ ] **Step 6: Run tests**

```bash
pnpm test
```
Expected: 22 + 3 new = 25 unit tests pass. Migration tests don't yet run against the source markdown's new format because we haven't updated the markdown — Task 4 does that.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate-itinerary.mjs tests/unit/migration.test.mjs
git commit -m "$(cat <<'EOF'
feat(migrate): parser + emitter for driving.legs[] shape

- parseDriveLegs(): reads a **Drive legs:** block from a day section
  and returns an array of {from, to, distanceKm, durationMin}.
- parseDurationToMinutes(): handles "55 min" / "1h" / "2h 15m" forms.
- parseDays now sets driving = { legs } from the parsed block; the
  old single-line **Driving:** parse is removed.

Tests: 3 new (single-leg, multi-leg, missing-block).
Re-running migration against the current source markdown will produce
empty legs[] until Task 4 inserts the new blocks; that's expected.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Source markdown — hike-fact corrections

**Files:**
- Modify: `dolomites-garda-itinerary.md`

Apply per-hike corrections from spec §4. Each is a precise find/replace.

- [ ] **Step 1: Tre Cime — distance / gain / time**

In `dolomites-garda-itinerary.md`, find the "Hike: Tre Cime di Lavaredo loop" detail block (around line 149-156). Change three values:

```diff
-- **Distance:** 10.3 km (6.3 mi) loop
-- **Elevation gain:** 425 m (1,617 ft)
-- **Time:** 4–5h moving (allow 5–6h with breaks)
+- **Distance:** 10.1 km (6.3 mi) loop
+- **Elevation gain:** 493 m (1,617 ft)
+- **Time:** 3.5–4h moving (allow 4.5–5h with breaks)
```

- [ ] **Step 2: Sorapis — difficulty**

Find the "Hike: Lake Sorapis via Passo Tre Croci" block (around line 219-225). Change:

```diff
-- **Difficulty:** Moderate (4.7★, 4,585 reviews) — but reviewers consistently warn this is *not* easy
+- **Difficulty:** Hard (4.7★, 4,569 reviews) — AllTrails grades this Hard; cable-assisted ledges, polished rock, exposure
```

- [ ] **Step 3: Lago di Braies — gain, difficulty, rating**

Find the "Hike A: Lago di Braies lake loop" block (around line 297-303). Change:

```diff
-- **Distance:** 3.8 km loop
-- **Elevation gain:** ~30 m (essentially flat)
-- **Time:** 1–1.5h
-- **Difficulty:** Easy (more a walk than a hike)
+- **Distance:** 3.8 km loop
+- **Elevation gain:** 189 m (rocky shoreline path has real undulation; not as flat as it looks)
+- **Time:** 1–1.5h
+- **Difficulty:** Moderate (4.7★, 2,913 reviews) — AllTrails grades it moderate due to undulating shoreline
```

- [ ] **Step 4: Cadini — distance, gain, rating**

Find the "Hike B: Cadini di Misurina viewpoint" block (around line 317-323). Change:

```diff
-- **Distance:** ~4 km (2.5 mi) out-and-back
-- **Elevation gain:** ~200 m (650 ft)
-- **Time:** 1.5–2h
-- **Difficulty:** Moderate (4.9★ — extremely high rating for the views)
+- **Distance:** 3.4 km (2.1 mi) out-and-back
+- **Elevation gain:** 211 m (692 ft)
+- **Time:** 1.5–2h
+- **Difficulty:** Moderate (4.8★, 2,867 reviews — extremely high rating for the views)
```

- [ ] **Step 5: Re-run migration to refresh the hike content files**

```bash
pnpm migrate
```
Expected: prints "Parsed 6 days, 6 hikes, 11 bookings." Files in `src/content/hikes/` are regenerated.

- [ ] **Step 6: Verify the regenerated content**

```bash
grep -E "(distanceKm|elevationGainM|difficulty|rating)" src/content/hikes/tre-cime.md | head -10
grep -E "(difficulty|rating)" src/content/hikes/sorapis.md | head -5
grep -E "(elevationGainM|difficulty|rating)" src/content/hikes/lago-di-braies.md | head -5
grep -E "(distanceKm|elevationGainM|rating)" src/content/hikes/cadini.md | head -5
```

Expected:
- Tre Cime: `distanceKm: 10.1`, `elevationGainM: 493`
- Sorapis: `difficulty: hard`
- Lago di Braies: `elevationGainM: 189`, `difficulty: moderate`, rating with 2913 reviews
- Cadini: `distanceKm: 3.4`, `elevationGainM: 211`, rating 4.8 / 2867

- [ ] **Step 7: Run `pnpm check` and `pnpm test`**

```bash
pnpm check && pnpm test
```
Expected: 0 errors, 25 unit tests pass.

(Note: `driving.legs[]` is still an empty array for every day at this point; the build will fail because `pnpm build` validates content against the schema. Don't run `pnpm build` yet — Task 4 fixes that.)

- [ ] **Step 8: Commit**

```bash
git add dolomites-garda-itinerary.md src/content/hikes/
git commit -m "$(cat <<'EOF'
fix(content): per-hike fact corrections from AllTrails audit

- Tre Cime: distance 10.3→10.1 km, gain 425→493 m, time 4-5→3.5-4 h
- Sorapis: difficulty moderate→hard (AllTrails grade; safety-relevant)
- Lago di Braies: gain 30→189 m, difficulty easy→moderate, rating
  added (4.7★ / 2,913 reviews)
- Cadini: distance 4→3.4 km, gain 200→211 m, rating 4.9★→4.8★
  with review count (2,867)

Source markdown updated; migration regenerated the affected hike
files. Build will fail until Task 4 lands the drive-legs blocks
that the new schema expects.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Source markdown — operator + lodging + drive-leg blocks

**Files:**
- Modify: `dolomites-garda-itinerary.md`

This task adds the new `**Drive legs:**` blocks per day (so the migration produces non-empty `legs[]` arrays) and applies the operator + lodging corrections.

- [ ] **Step 1: Lodging address — Pension Kircher Sepp**

In Section 1.3 (Accommodation table), find the row for Pension Kircher Sepp. Change:

```diff
-| **Garni / Pension Kircher Sepp** | Via Rosengarten 30, Barbiano (Barbian), BZ 39040 | Sat Jul 18, 15:00 | Mon Jul 20, 11:00 | 2 | Family-run, ask for balcony room facing Dolomites. +39 0471 650008 |
+| **Garni / Pension Kircher Sepp** | Via Rosengarten 27, Barbiano (Barbian), BZ 39040 | Sat Jul 18, 15:00 | Mon Jul 20, 11:00 | 2 | Family-run, ask for balcony room facing Dolomites. +39 0471 650008 |
```

- [ ] **Step 2: Lago di Braies parking cutoff (09:30 → 09:00)**

In Section 2.2 (Optional pre-bookings table), find the Lago di Braies row. Change:

```diff
-| Lago di Braies parking P3 | `https://www.pragsparking.com/en` | Skip if arriving before 09:30. Required if arriving 09:30–16:00 between Jul 1–Sep 15. ~€12. |
+| Lago di Braies parking P3 | `https://www.pragsparking.com/en` | Skip if arriving before 09:00. Required if arriving 09:00–16:00 between Jul 1–Sep 15. ~€12. |
```

- [ ] **Step 3: Lago di Braies parking cutoff in Day 4 schedule**

In Day 4's "##### Parking — P3 (Lago di Braies)" subsection, find:

```diff
-- **Cost:** €12 (no booking before 09:30 in summer)
-- **Important:** From Jul 1 to Sep 15, you cannot drive in 09:30–16:00 without a pre-booked slot via `https://www.pragsparking.com/en`
+- **Cost:** €12 (no booking before 09:00 in summer)
+- **Important:** From Jul 1 to Sep 15, you cannot drive in 09:00–16:00 without a pre-booked slot via `https://www.pragsparking.com/en`
```

- [ ] **Step 4: Mont Sëuc cable car cost €30 → €39**

In Day 6 ("Cable car — Mont Sëuc (from Ortisei)") subsection, find:

```diff
-- **Round-trip:** ~€30 / adult (2026 estimate)
+- **Round-trip:** €39 / adult (2026 confirmed via funiviaortisei.eu)
```

- [ ] **Step 5: Add `**Drive legs:**` blocks per day**

For each day, add a `**Drive legs:**` block immediately after the `**Lodging:**` line and before the `#### Schedule` heading. Use the format:

```
**Drive legs:**
- {from} → {to} — {km} km / {duration}
```

**Day 1 (Wed 15 Jul):**

After the Day 1 header block, before "#### Schedule", add:

```
**Drive legs:**
- Venice Marco Polo Airport → Cortina (Baita Fraina) — 146 km / 2h 30m
```

**Day 2 (Thu 16 Jul):**

```
**Drive legs:**
- Baita Fraina (Cortina) → Rifugio Auronzo (Tre Cime parking) — 25 km / 45 min
```

**Day 3 (Fri 17 Jul):**

```
**Drive legs:**
- Baita Fraina (Cortina) → Passo Tre Croci (Sorapis trailhead) — 11 km / 15 min
```

**Day 4 (Sat 18 Jul):**

```
**Drive legs:**
- Cortina (Baita Fraina) → Lago di Braies P3 — 50 km / 55 min
- Lago di Braies → Rifugio Auronzo (Cadini parking) — 42 km / 1h 0m
- Rifugio Auronzo → Pension Kircher Sepp (Barbiano) — 111 km / 2h 15m
```

**Day 5 (Sun 19 Jul):**

```
**Drive legs:**
- Pension Kircher Sepp (Barbiano) → Ortisei (Mont Sëuc valley station) — 19 km / 25 min
```

**Day 6 (Mon 20 Jul):**

```
**Drive legs:**
- Pension Kircher Sepp (Barbiano) → Ortisei (Mont Sëuc valley station) — 19 km / 25 min
- Ortisei → Salò (Lake Garda) — 207 km / 2h 50m
```

The existing `**Driving:**` summary lines can stay (they're prose; the migration ignores them now since it parses `**Drive legs:**` exclusively).

- [ ] **Step 6: Run migration + verify**

```bash
pnpm migrate
grep -A3 "driving:" src/content/days/2026-07-18-*.md
grep -A3 "driving:" src/content/days/2026-07-16-*.md
```

Expected: Day 4 (`2026-07-18-...`) shows three legs; Day 2 (`2026-07-16-...`) shows one leg.

- [ ] **Step 7: Run check (build still skipped — UI consumers haven't been updated yet)**

```bash
pnpm check && pnpm test
```
Expected: 0 type errors, 25 unit tests pass. (Astro check verifies content against the new schema — should succeed now that legs[] is populated.)

(Don't run `pnpm build` yet. The Astro build also runs the page templates, and those still consume `driving.distanceKm`/`durationMin` from the old shape.)

- [ ] **Step 8: Commit**

```bash
git add dolomites-garda-itinerary.md src/content/days/ src/content/lodgings/
git commit -m "$(cat <<'EOF'
fix(content): operator/lodging fixes + drive-legs blocks per day

Source markdown:
- Pension Kircher Sepp address: Rosengarten 30 → 27
- Lago di Braies P3 cutoff: 09:30 → 09:00 (in two places)
- Mont Sëuc cable car: ~€30 → €39 round-trip (2026 confirmed)
- Added **Drive legs:** blocks for all 6 days; Day 4 has 3 legs
  (Cortina → Braies → Cadini → Brixen) instead of one bogus aggregate.

Migration regenerated /content/days/*.md with the new
driving.legs[] shape.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — UI updates for new shape

### Task 5: Create the `<DriveLegs>` component

**Files:**
- Create: `src/components/DriveLegs.astro`

- [ ] **Step 1: Create the component**

```astro
---
/*
 * DriveLegs — renders an array of drive legs with a computed total.
 * Single-leg days collapse cleanly; multi-leg days (Day 4) show each
 * leg as a row + the total at the bottom.
 */
type Leg = {
  from: string;
  to: string;
  distanceKm: number;
  durationMin: number;
  notes?: string;
};

const { legs } = Astro.props as { legs: Leg[] };

const totalKm = legs.reduce((s, l) => s + l.distanceKm, 0);
const totalMin = legs.reduce((s, l) => s + l.durationMin, 0);
const totalHours = Math.floor(totalMin / 60);
const totalRemainder = totalMin % 60;

const fmtMin = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};
---
{legs.length === 0 && null}
{legs.length === 1 && (
  <div style="
    background: var(--bg-paper);
    border: 1px solid var(--hairline);
    border-radius: var(--r-md);
    padding: 14px 16px;
    box-shadow: var(--shadow-paper-sm);
  ">
    <div style="display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;">
      <div class="mono tabular" style="font-size: 22px; font-weight: 700; color: var(--ink);">
        {legs[0].distanceKm}<span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); margin-left: 4px;">km</span>
      </div>
      <div style="flex: 1; min-width: 60px; display: flex; align-items: center; gap: 8px;">
        <span style="height: 1px; flex: 1; background: var(--ink-soft); opacity: 0.4;"></span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12 H19 M14 6 L20 12 L14 18" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span style="height: 1px; flex: 1; background: var(--ink-soft); opacity: 0.4;"></span>
      </div>
      <div class="mono tabular" style="font-size: 22px; font-weight: 700; color: var(--ink);">
        {fmtMin(legs[0].durationMin)}
      </div>
    </div>
    <div class="mono" style="font-size: 12px; color: var(--ink-soft); margin-top: 6px; letter-spacing: 0.02em;">
      {legs[0].from} → {legs[0].to}
    </div>
    {legs[0].notes && <p style="font-size: 12.5px; color: var(--ink-soft); margin: 10px 0 0;">{legs[0].notes}</p>}
  </div>
)}
{legs.length > 1 && (
  <div style="
    background: var(--bg-paper);
    border: 1px solid var(--hairline);
    border-radius: var(--r-md);
    padding: 14px 16px;
    box-shadow: var(--shadow-paper-sm);
  ">
    <ol style="list-style: none; margin: 0; padding: 0; display: grid; gap: 0;">
      {legs.map((leg) => (
        <li style="
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: baseline;
          padding: 10px 0;
          border-bottom: 1px dashed var(--hairline);
        ">
          <span class="mono" style="font-size: 12.5px; color: var(--ink); letter-spacing: 0.02em;">
            {leg.from} <span style="color: var(--gold);">→</span> {leg.to}
          </span>
          <span class="mono tabular" style="font-size: 13px; color: var(--ink); font-weight: 700; text-align: right;">
            {leg.distanceKm} <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft);">km</span>
          </span>
          <span class="mono tabular" style="font-size: 13px; color: var(--ink); font-weight: 700; text-align: right; min-width: 56px;">
            {fmtMin(leg.durationMin)}
          </span>
        </li>
      ))}
      <li style="
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 10px;
        align-items: baseline;
        padding: 12px 0 4px;
      ">
        <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft); letter-spacing: 0.18em;">Total</span>
        <span class="mono tabular" style="font-size: 14.5px; color: var(--ink); font-weight: 800; text-align: right;">
          {totalKm} <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft);">km</span>
        </span>
        <span class="mono tabular" style="font-size: 14.5px; color: var(--ink); font-weight: 800; text-align: right; min-width: 56px;">
          {totalHours}h{totalRemainder > 0 ? ` ${totalRemainder}m` : ''}
        </span>
      </li>
    </ol>
  </div>
)}
```

- [ ] **Step 2: Verify the component compiles**

```bash
pnpm check
```
Expected: 0 errors. The component isn't yet imported anywhere; that's fine.

- [ ] **Step 3: Commit**

```bash
git add src/components/DriveLegs.astro
git commit -m "$(cat <<'EOF'
feat(component): DriveLegs renderer for legs[] array

Renders one of two layouts:
- 1 leg → big km / arrow / duration row + "from → to" subtitle
  (matches the existing single-leg "route slip" look).
- 2+ legs → ordered list of legs (from → to | km | duration)
  with a Total row at the bottom.

Wired into day + hike pages in Tasks 6-7.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire `<DriveLegs>` into the day page

**Files:**
- Modify: `src/pages/day/[date].astro`

- [ ] **Step 1: Replace the inline driving block**

In `src/pages/day/[date].astro`, find the existing Driving section. It currently reads (excerpt):

```astro
  {/* Driving */}
  {day.data.driving.distanceKm > 0 && (
    <section class="stagger" style="padding: 22px var(--page-x);">
      <h2 class="eyebrow" style="margin: 0 0 12px;">Driving</h2>
      <div style="
        background: var(--bg-paper);
        border: 1px solid var(--hairline);
        border-radius: var(--r-md);
        padding: 14px 16px;
        box-shadow: var(--shadow-paper-sm);
      ">
        <div style="display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;">
          <div class="mono tabular" style="font-size: 22px; font-weight: 700; color: var(--ink);">
            {day.data.driving.distanceKm}<span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); margin-left: 4px;">km</span>
          </div>
          ...
        </div>
        ...
      </div>
    </section>
  )}
```

Replace the entire `{/* Driving */} ... )}` block with:

```astro
  {/* Driving */}
  {day.data.driving.legs.length > 0 && (
    <section class="stagger" style="padding: 22px var(--page-x);">
      <h2 class="eyebrow" style="margin: 0 0 12px;">Driving</h2>
      <DriveLegs legs={day.data.driving.legs} />
    </section>
  )}
```

Add the import at the top of the frontmatter:

```astro
import DriveLegs from '@/components/DriveLegs.astro';
```

- [ ] **Step 2: Build and verify**

```bash
pnpm build
```
Expected: 23 pages built. No errors.

```bash
grep -c "Lago di Braies" dist/day/2026-07-18/index.html
grep -c "Rifugio Auronzo" dist/day/2026-07-18/index.html
grep -c "Pension Kircher Sepp" dist/day/2026-07-18/index.html
```
Expected: each ≥ 1 (Day 4 page now shows all 3 leg endpoints).

```bash
grep "203" dist/day/2026-07-18/index.html | head -3
```
Expected: appears in the Total row (50 + 42 + 111 = 203 km).

- [ ] **Step 3: Run e2e tests**

```bash
pnpm test:e2e -g "day page"
```
Expected: existing day-page tests still pass (the heading "Driving" and the structure are still recognisable to the test selectors).

- [ ] **Step 4: Commit**

```bash
git add src/pages/day/\[date\].astro
git commit -m "$(cat <<'EOF'
feat(day): use <DriveLegs> for the day's driving section

Replaces the inline single-leg "X km · arrow · Y h" markup with
the DriveLegs component, which handles both single-leg and multi-
leg days. Day 4 (Sat 18 Jul) now shows three legs (Cortina → Braies,
Braies → Cadini, Cadini → Brixen) with totals (203 km / 4h 10m)
instead of the bogus 280 km / 4h 45m aggregate.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Wire `<DriveLegs>` into the hike page Part II

**Files:**
- Modify: `src/pages/hike/[slug].astro`

- [ ] **Step 1: Replace the inline driving block in Part II**

In `src/pages/hike/[slug].astro`, find the Part II "Driving" sub-section. It currently has the same inline single-leg layout:

```astro
      {/* Driving */}
      {dayForHike.data.driving.distanceKm > 0 && (
        <section class="stagger" style="padding: 14px var(--page-x);">
          <h3 class="eyebrow" style="margin: 0 0 10px;">Driving</h3>
          <div style="
            background: var(--bg-paper);
            ...
          ">
            ...
          </div>
        </section>
      )}
```

Replace with:

```astro
      {/* Driving */}
      {dayForHike.data.driving.legs.length > 0 && (
        <section class="stagger" style="padding: 14px var(--page-x);">
          <h3 class="eyebrow" style="margin: 0 0 10px;">Driving</h3>
          <DriveLegs legs={dayForHike.data.driving.legs} />
        </section>
      )}
```

Add the import at the top of the frontmatter:

```astro
import DriveLegs from '@/components/DriveLegs.astro';
```

- [ ] **Step 2: Build + spot-check Lago di Braies**

```bash
pnpm build
grep -c "Pension Kircher Sepp" dist/hike/lago-di-braies/index.html
grep "203" dist/hike/lago-di-braies/index.html | head -2
```
Expected: Pension Kircher Sepp appears (it's a leg endpoint on Braies' day); Total row shows 203.

- [ ] **Step 3: Run all tests**

```bash
pnpm test && pnpm test:e2e
```
Expected: 25 + 11 = pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/hike/\[slug\].astro
git commit -m "$(cat <<'EOF'
feat(hike): use <DriveLegs> for Part II driving section

Same component as the day page; on Lago di Braies and Cadini hike
pages, the Day 4 driving section now shows all three legs with totals
instead of an inline single-leg block.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Lodging + restaurant corrections

### Task 8: Update migration's `emitLodgings` for Pension Kircher Sepp address

**Files:**
- Modify: `scripts/migrate-itinerary.mjs`

- [ ] **Step 1: Edit the hardcoded data**

In `scripts/migrate-itinerary.mjs`, find `function emitLodgings()`. Inside the array, find the Pension Kircher Sepp entry. Change:

```diff
     {
       slug: 'pension-kircher-sepp',
       name: 'Garni / Pension Kircher Sepp',
       location: 'Barbiano (Barbian), BZ',
       checkIn: '2026-07-18T15:00',
       checkOut: '2026-07-20T11:00',
       nights: 2,
       phone: '+390471650008',
-      address: 'Via Rosengarten 30, Barbiano (Barbian), BZ 39040',
+      address: 'Via Rosengarten 27, Barbiano (Barbian), BZ 39040',
       lat: 46.6109,
       lon: 11.5226,
       bookingUrl: 'https://www.booking.com/hotel/it/gasthof-albergo-kircher-sepp.html',
       notes: 'Family-run. Ask for balcony room facing Dolomites.',
     },
```

- [ ] **Step 2: Re-run migration + verify**

```bash
pnpm migrate
grep "Rosengarten" src/content/lodgings/pension-kircher-sepp.yaml
```
Expected: shows "Via Rosengarten 27" (no longer 30).

- [ ] **Step 3: Build + commit**

```bash
pnpm build
git add scripts/migrate-itinerary.mjs src/content/lodgings/pension-kircher-sepp.yaml
git commit -m "$(cat <<'EOF'
fix(content): Pension Kircher Sepp address Rosengarten 30 → 27

Verified against the official kirchersepp.com "how to arrive" page.
Phone number stays as-is (+39 0471 650008 is one of two valid lines
listed; the other 650074 also works).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Update migration's `emitRestaurants` for Bar Anna, Hofschank, Vitis, Panificio, Ospitale

**Files:**
- Modify: `scripts/migrate-itinerary.mjs`

- [ ] **Step 1: Cortina group — Panificio Alverà spelling + Ospitale distance**

In `emitRestaurants`, find the "Cortina d'Ampezzo" group's items array. Apply these changes:

```diff
       items: [
         { name: 'Baita Fraina', type: 'Refined Tyrolean', priceRange: '$$$', needsReservation: true, notes: 'Hotel restaurant — book ahead.' },
         { name: 'Al Camin', type: 'Modern mountain food', priceRange: '$$', needsReservation: true },
         { name: 'El Camineto', type: 'Traditional alpine', priceRange: '$$', needsReservation: false },
-        { name: 'Ospitale', type: 'Old stagecoach inn', priceRange: '$$', needsReservation: true, notes: '8 km north of Cortina.' },
+        { name: 'Ospitale', type: 'Old stagecoach inn', priceRange: '$$', needsReservation: true, notes: '~7 km north on the SS51.' },
         { name: 'Enoteca Baita Fraina', type: 'Wine bar / aperitivo', priceRange: '$', needsReservation: false, notes: 'Sister wine bar in town centre.' },
-        { name: 'Panificio Alvera', type: 'Bakery', priceRange: '$', needsReservation: false, notes: 'Trail sandwiches and pastries.' },
+        { name: 'Panificio Alverà', type: 'Bakery', priceRange: '$', needsReservation: false, notes: 'Trail sandwiches and pastries.' },
       ],
```

- [ ] **Step 2: Brixen / Eisacktal group — soften Vitis description, remove Hofschank Klausnerhof**

Find the "Brixen / Eisacktal" group's items array. Apply:

```diff
       items: [
-        { name: 'Vitis (Brixen)', type: 'Modern South Tyrolean tasting menu', priceRange: '$$$', needsReservation: true },
+        { name: 'Vitis (Brixen)', type: 'Wine bar with refined seasonal small plates', priceRange: '$$', needsReservation: true, notes: 'Enoteca attached to Hotel Adler; not a formal tasting menu.' },
         { name: 'Decantei (Brixen)', type: 'Wine bar with small plates', priceRange: '$$', needsReservation: false },
-        { name: 'Hofschank Klausnerhof (Klausen)', type: 'Hyper-traditional, locals\' favourite', priceRange: '$$', needsReservation: true },
         { name: 'Sunnegg (Brixen)', type: 'Panoramic spot above town', priceRange: '$$', needsReservation: true },
       ],
```

- [ ] **Step 3: Ortisei group — Bar Anna → Caffè Val d'Anna**

Find the "Ortisei (Val Gardena)" group's items array. Apply:

```diff
       items: [
         { name: 'Cascade', type: 'Mid-range reliable', priceRange: '$$', needsReservation: false },
-        { name: 'Bar Anna', type: 'Quick panini and coffee', priceRange: '$', needsReservation: false },
+        { name: "Caffè Val d'Anna", type: 'Café · quick panini and coffee', priceRange: '$', needsReservation: false, address: 'Streda Annatal 39, Ortisei', notes: 'Casual stop for coffee, panini, light bites.' },
         { name: 'Restaurant Concordia', type: 'Traditional Ladin', priceRange: '$$', needsReservation: false },
       ],
```

- [ ] **Step 4: Re-run migration + verify**

```bash
pnpm migrate
grep "Caffè Val d'Anna" src/content/restaurants/ortisei-val-gardena.yaml
grep -c "Hofschank Klausnerhof" src/content/restaurants/brixen-eisacktal.yaml
grep "Panificio Alverà" src/content/restaurants/cortina-d-ampezzo.yaml
grep "Wine bar with refined" src/content/restaurants/brixen-eisacktal.yaml
```
Expected:
- "Caffè Val d'Anna" appears in Ortisei file
- Hofschank Klausnerhof count is 0
- Panificio Alverà (with à) appears
- Vitis description shows "Wine bar with refined..."

- [ ] **Step 5: Build + commit**

```bash
pnpm build
git add scripts/migrate-itinerary.mjs src/content/restaurants/
git commit -m "$(cat <<'EOF'
fix(content): restaurant corrections from web-search audit

- Ortisei: rename "Bar Anna" → "Caffè Val d'Anna" (verified at
  Streda Annatal 39; "Bar Anna" was almost certainly colloquial for
  this place — Anna Stuben in Hotel Gardena is a different,
  Michelin-starred destination that doesn't match the description).
- Klausen: remove "Hofschank Klausnerhof" — could not verify
  existence under that name. If it's a real local tip the user
  has firsthand, re-add manually.
- Brixen: soften Vitis description ("Modern South Tyrolean tasting
  menu" → "Wine bar with refined seasonal small plates") — it's an
  enoteca, no formal tasting menu.
- Cortina: Panificio Alvera → Panificio Alverà (correct accent).
- Cortina: Ospitale "8 km north" → "~7 km north on the SS51".

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Final verification & deploy

### Task 10: Full verify, push, confirm live

**Files:** None modified; verification only.

- [ ] **Step 1: Final build + tests**

```bash
pnpm build
pnpm test
pnpm test:e2e
```
Expected:
- `pnpm build`: 23 pages, no errors.
- `pnpm test`: 25/25 unit tests pass.
- `pnpm test:e2e`: 11/11 e2e tests pass (or whatever the current count is — should not decrease from this plan's start).

- [ ] **Step 2: Spot-check the home + day + hike pages render the corrected data**

```bash
grep -A1 "First up\|First Up" dist/index.html | head -5
grep -E "(distanceKm|elevationGainM|difficulty)" src/content/hikes/sorapis.md
grep "203" dist/day/2026-07-18/index.html | head -3
grep "Rosengarten 27" dist/lodgings/index.html
grep "Caffè Val d'Anna" dist/restaurants/index.html
```

Expected (each):
- First up section visible on home
- Sorapis difficulty: hard
- Day 4 driving total: 203 km
- Lodgings page shows Rosengarten 27
- Restaurants page shows Caffè Val d'Anna

- [ ] **Step 3: Push to Cloudflare**

```bash
git push origin main
```
Expected: push succeeds. Cloudflare auto-rebuilds in ~2 min.

- [ ] **Step 4: Verify deployed site (post-rebuild)**

After ~2 min, run:

```bash
curl -s https://italy-trip.github-mud285.workers.dev/hike/cadini/ | grep -oE "stat-num[^>]*>\s*3.4" | head -2
curl -s https://italy-trip.github-mud285.workers.dev/hike/sorapis/ | grep -oE "(hard|Hard)" | head -2
curl -s https://italy-trip.github-mud285.workers.dev/day/2026-07-18/ | grep -oE "203\s*<" | head -2
curl -s https://italy-trip.github-mud285.workers.dev/lodgings/ | grep -oE "Rosengarten 27" | head -2
curl -s https://italy-trip.github-mud285.workers.dev/restaurants/ | grep -oE "Val d'Anna" | head -2
```
Expected: each grep finds at least one match (subject to Cloudflare cache warmth — try once more after another minute if any fail).

- [ ] **Step 5: Hard reload service-worker cache (manual on user's device)**

Document a one-line note in the PR description / commit message: users with a stale tab open should hard-reload once to pick up the new content. The SW already handles activation, but the current rendered page is from the old cache until reload.

---

## Self-review

(Author of this plan checked the spec section by section.)

**Spec coverage:**

- §3 decisions (legs as array, restaurant rename) — Tasks 1, 9
- §4 hike-fact corrections — Task 3 (markdown) + 5 (regen via migration; sequenced correctly)
- §5 operator corrections (Mont Sëuc €39, Braies cutoff 09:00) — Task 4
- §6 lodging address — Task 8
- §7 schema + drive-time data — Tasks 1, 2, 4 (markdown drive-legs blocks), 5–7 (UI)
- §8 restaurant changes — Task 9
- §9 source markdown updates — split across Tasks 3 (hikes), 4 (operator + lodging + drive-legs)
- §10 5-phase implementation order — followed; my tasks group as Phase 1 (Tasks 1-4), Phase 2 (5-7), Phase 3 (8-9), Phase 4 (10)
- §11 definition of done — every item maps to one of the verification checks in Tasks 6-7-10

**Type / name consistency:**

- `parseDriveLegs` defined in Task 2 step 3, used in Task 2 step 4.
- `DriveLeg` Zod sub-schema in Task 1 step 3, mirrored by Task 5's component prop type.
- Task 5 uses `Astro.props.legs` and `legs[i].from / to / distanceKm / durationMin / notes` — matches the schema names.
- Task 6 + 7 read `day.data.driving.legs` / `dayForHike.data.driving.legs` — consistent with the Zod shape.

**Placeholder scan:**

- No "TBD" / "TODO" / "implement later".
- The `notes` field on `DriveLeg` is optional and intentional (shape matches schema), not a placeholder.
- The grep checks in Task 10 use approximate patterns (e.g., the Sorapis "hard" check) but are concrete enough.

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-data-verification.md`.**
