# Trip Data Verification & Corrections — Design Spec

**Status:** Draft for approval
**Author:** Claude (with Kevin Sundberg)
**Date:** 2026-05-01
**Repo:** `/Users/kevinsundberg/code/italy/italy-trip`
**Inputs:** Four parallel research audits (AllTrails, operators+schedule, drive-times via OSRM, restaurants+lodging+booking arithmetic)

---

## 1. Purpose

Audit every piece of trip data on the site against authoritative sources, then apply the corrections. Four research agents fanned out across:

- **A** Hike facts (distance / gain / time / difficulty / rating) → AllTrails
- **B** Trailhead GPS + names → AllTrails / Google Maps spot-check
- **C** Parking + cable-car operators → official sites
- **D** Drive-time matrix → OSRM driving routing API
- **E** Schedule timestamp logic → operator hours
- **F** Lodgings → booking confirmations + official hotel sites
- **G** Restaurants → web search per-name
- **H** Booking-window arithmetic → 30-day rule check

The audit found: **9 critical errors**, **9 medium errors**, **6 cosmetic items**, **2 unverified entries**, plus a missing schema feature (drive-time matrix).

## 2. Scope

### In scope (this spec)

1. Apply all 18 critical/medium content corrections to `src/content/**`
2. Schema change: per-day `driving` becomes an array of legs (`{ from, to, distanceKm, durationMin, notes? }[]`) so multi-leg days render clearly
3. Add a drive-time component to the day page that renders the legs + total
4. Update `dolomites-garda-itinerary.md` (source markdown) so the migration regenerates the corrected values
5. Update `scripts/migrate-itinerary.mjs` so it parses the new structure
6. Restaurant cleanup: rename "Bar Anna" → "Caffè Val d'Anna"; remove "Hofschank Klausnerhof"
7. Cosmetic fixes (Vitis description, Panificio Alverà spelling, Pension Kircher Sepp address)

### Out of scope (deferred / flagged but not changed)

- The Sorapis difficulty change (`moderate` → `hard`) is the only safety-relevant item where we override AllTrails' grade; document the change in the hike's `notes`/`hazards` so the existing safety-related copy still reads correctly.
- Last-lift-down times for Seceda and Mont Sëuc cable cars: source is ambiguous; we note "verify on ticket purchase" in the hike `notes` field rather than commit to a specific time.
- The Hofschank Klausnerhof entry is removed but a comment in the spec records why, so it can be re-added if the user confirms it firsthand.

## 3. Decisions made (settled in brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Audit approach | All four parallel agents | "All of them" — comprehensive scope |
| Drive matrix in data model | Yes, as `src/content/days/*.md`'s `driving` field, restructured to an array | One-leg days collapse cleanly; multi-leg days like Day 4 finally make sense |
| Drive matrix on day pages | Yes, render leg-by-leg with a total | Day 4 (3 legs) is unintelligible as a single aggregate |
| Unverified restaurants | Replace Bar Anna with Caffè Val d'Anna; remove Hofschank Klausnerhof | Don't keep entries we can't stand behind |
| Tre Cime moving time | Update **3.5–4h** per AllTrails | Trust the source unless we have a strong reason not to |
| Sorapis difficulty | Update to **hard** per AllTrails | Safety-relevant; existing hazards copy already warns about exposure |

## 4. Hike fact corrections

Apply per-hike. The migration script writes these fields from the source markdown, so the source markdown must be updated *and* `scripts/migrate-itinerary.mjs` re-run. Hand-editing `src/content/hikes/*.md` directly would regress on next migration.

### tre-cime

| Field | Before | After |
|---|---|---|
| `distanceKm` | 10.3 | **10.1** |
| `elevationGainM` | 425 | **493** |
| `movingTimeHours` | { min: 4, max: 5 } | **{ min: 3.5, max: 4 }** |
| `totalTimeHours` | { min: 4, max: 6 } | **{ min: 4.5, max: 5 }** |

### sorapis

| Field | Before | After |
|---|---|---|
| `difficulty` | `moderate` | **`hard`** |
| `rating.reviews` | 4585 | **4569** |

### lago-di-braies

| Field | Before | After |
|---|---|---|
| `elevationGainM` | 30 | **189** |
| `difficulty` | `easy` | **`moderate`** |
| `rating` | (none) | **`{ stars: 4.7, reviews: 2913 }`** |

### cadini

| Field | Before | After |
|---|---|---|
| `distanceKm` | 4 | **3.4** |
| `elevationGainM` | 200 | **211** |
| `rating` | `{ stars: 4.9, reviews: null }` | **`{ stars: 4.8, reviews: 2867 }`** |

### seceda-firenze

No fact changes (everything matched AllTrails). Add a `notes` field with: *"Last lift down: confirm on ticket purchase — official site doesn't print closing time clearly. Plan a margin."*

### alpe-di-siusi-family

No fact changes. Same closing-time caveat note.

## 5. Operator + parking corrections

These show up across day pages and the contingencies page; some are referenced in the original markdown (which feeds the migration).

| What | Before | After | Where |
|---|---|---|---|
| Mont Sëuc cable car round-trip | ~€30 | **€39** | `dolomites-garda-itinerary.md` Day 6 cable car block + day-page driving notes |
| Lago di Braies P3 access cutoff | 09:30 | **09:00** | Source markdown Section 2.2 + Day 4 schedule notes |
| Seceda cable car last-lift down | 17:30 | (deferred — note "verify on ticket purchase") | Source markdown Day 5 |
| Mont Sëuc summer closing | 17:30 | (deferred — note "verify on ticket purchase") | Source markdown Day 6 |

## 6. Lodging corrections

| What | Before | After |
|---|---|---|
| Pension Kircher Sepp address | Via Rosengarten 30, Barbiano (Barbian), BZ 39040 | **Via Rosengarten 27, Barbiano (Barbian), BZ 39040** |

## 7. Drive-time data + schema change

### 7.1 Schema change

Update `DaySchema` in `src/content/config.ts`:

```ts
// before
driving: z.object({
  distanceKm: z.number(),
  durationMin: z.number(),
  notes: z.string().optional()
})

// after
driving: z.object({
  legs: z.array(z.object({
    from: z.string(),         // human-readable ("Cortina · Baita Fraina")
    to: z.string(),           // human-readable ("Lago di Braies P3")
    distanceKm: z.number(),
    durationMin: z.number(),
    notes: z.string().optional(),
  })),
})
```

Day pages render legs as a list; total is computed (sum of legs). Single-leg days collapse to one row.

### 7.2 Drive-time corrections (per-day legs)

**Day 1 (Wed 15 Jul) — Arrival**
- VCE Marco Polo → Cortina (Baita Fraina): **146 km / 2h 30m** (kept conservative for airport + summer traffic; OSRM raw is 1h 49m)

**Day 2 (Thu 16 Jul) — Tre Cime**
- Baita Fraina → Rifugio Auronzo (Tre Cime parking): **25 km / 45 min** (was 30 / 47 — toll-road buffer baked in)

**Day 3 (Fri 17 Jul) — Sorapis**
- Baita Fraina → Passo Tre Croci: **11 km / 15 min** (was 14 / 19)

**Day 4 (Sat 18 Jul) — Braies + Cadini + transfer**
- Cortina → Lago di Braies P3: **50 km / 55 min** (was 50 / 60)
- Lago di Braies → Rifugio Auronzo (Cadini): **42 km / 60 min** ⚠️ (was **80 / 90 — biggest single error**)
- Rifugio Auronzo (Cadini) → Pension Kircher Sepp: **111 km / 2h 15m** (was ~150 / ~2h 45m)
- **Day 4 total: 203 km / 4h 10m** (was ~280 / ~4h 45m)

**Day 5 (Sun 19 Jul) — Seceda**
- Pension Kircher Sepp → Ortisei (Mont Sëuc valley station): **19 km / 25 min** (was 25 / 30)

**Day 6 (Mon 20 Jul) — Alpe di Siusi + transfer to Salò**
- Pension Kircher Sepp → Ortisei (Mont Sëuc valley station): **19 km / 25 min** (was 25 / 30)
- Ortisei → Salò (after the morning hike): **207 km / 2h 50m** (was 280 / 3h 30m — drops Salò ETA from ~16:00 to ~15:00 if departing at noon)

### 7.3 Migration script update

`scripts/migrate-itinerary.mjs`:
- Replace the single-leg `driving` parser with one that emits an array of legs
- For each day, parse the "Driving distances" or "Drive notes" sub-section of the source markdown
- For Day 4 specifically (multi-leg), parse the structured table block

The corrected source-markdown content becomes the input. So we do this in this order:
1. Update source markdown (`dolomites-garda-itinerary.md`)
2. Update migration script
3. Re-run migration
4. Verify generated `src/content/days/*.md` reflects the new shape

## 8. Restaurant corrections

`src/content/restaurants/ortisei-val-gardena.yaml`:
- **Replace** the entry "Bar Anna" with:
  ```yaml
  - name: Caffè Val d'Anna
    type: Café · quick panini and coffee
    priceRange: $
    needsReservation: false
    address: Streda Annatal 39, Ortisei
    notes: Casual stop for coffee, panini, light bites.
  ```

`src/content/restaurants/brixen-eisacktal.yaml`:
- **Remove** "Hofschank Klausnerhof" entry. Add a top-of-file YAML comment:
  ```yaml
  # Note: a previous "Hofschank Klausnerhof (Klausen)" entry was removed
  # 2026-05-01 because no listing could be found online. Hofschanks
  # (farm-taverns) often aren't indexed; if the original local tip is
  # firsthand, re-add manually with phone + address from local tourist info.
  ```

`src/content/restaurants/cortina-d-ampezzo.yaml`:
- **Rename** "Panificio Alvera" → "Panificio Alverà" (add accent)
- **Update** Ospitale notes: "8 km north" → "~7 km north on the SS51"

`src/content/restaurants/brixen-eisacktal.yaml`:
- **Update** Vitis description: "Modern South Tyrolean tasting menu" → "Wine bar with refined seasonal small plates" (no formal tasting menu; it's an enoteca attached to Hotel Adler)

## 9. Source-markdown updates (for migration to stay correct)

Edit `dolomites-garda-itinerary.md` to apply the same corrections so re-running the migration regenerates the right values:

1. **Tre Cime hike block**: distance 10.3 → 10.1; gain 425 → 493; time 4–5h → 3.5–4h
2. **Sorapis hike block**: change "Moderate" → "Hard" in the Difficulty header
3. **Lago di Braies hike block**: gain 30 → 189; difficulty Easy → Moderate; rating "n/a" → "4.7 (2,913)"
4. **Cadini hike block**: distance ~4 km → ~3.4 km; gain ~200 m → ~211 m; rating 4.9★ → 4.8★ (2,867)
5. **Section 5 driving table**: rewrite all 9 rows with the corrected values from §7.2
6. **Section 1.3 lodging table**: Kircher Sepp address 30 → 27
7. **Day 4 schedule**: keep timestamps unchanged (the schedule is the *plan*; a faster Braies→Cadini drive just gives more buffer)
8. **Day 6 schedule**: optionally rebalance Salò departure earlier given the shorter drive — but lower priority; the schedule still works.
9. **Section 2.2** (parking notes): Braies P3 cutoff "09:30" → "09:00"
10. **Day 6 cable car**: Mont Sëuc round-trip ~€30 → €39

## 10. Implementation order

### Phase 1 — Source + schema (foundation)

1. Update `dolomites-garda-itinerary.md` with all corrections from §9
2. Update `src/content/config.ts` `DaySchema` with the new `driving.legs[]` shape
3. Update `scripts/migrate-itinerary.mjs`:
   - Parse new multi-leg driving tables
   - Emit `legs[]` instead of single `{ distanceKm, durationMin }`
   - Spot-fix lodging address parsing if needed
4. Re-run `pnpm migrate`
5. Verify `pnpm check` passes (Zod will catch shape mismatches)

### Phase 2 — UI updates for new shape

6. Update day page (`src/pages/day/[date].astro`) to render `driving.legs[]` as a list with totals
7. Update hike page Part II (`src/pages/hike/[slug].astro`) — same renderer used inside Part II's "Driving" sub-section
8. Verify visually: `pnpm dev`, walk Day 4 specifically; confirm 3 legs render with totals

### Phase 3 — Restaurant + lodging corrections

9. Apply restaurant edits in `src/content/restaurants/*.yaml`
10. Apply Pension Kircher Sepp address fix in `src/content/lodgings/pension-kircher-sepp.yaml`

### Phase 4 — Cosmetic + spot fixes

11. Apply remaining cosmetic fixes (Panificio Alverà, Vitis description, Ospitale distance, Cadini rating fill, Lago di Braies rating fill)

### Phase 5 — Verify + push

12. `pnpm build` clean (23 pages)
13. `pnpm test` clean (22/22 unit tests)
14. `pnpm test:e2e` clean (or address any selectors that broke from data shape changes)
15. Commit phase by phase
16. Push to deploy

## 11. Definition of done

- All 18 critical/medium fact corrections applied to `src/content/`
- `driving` field on day pages is an array of legs; multi-leg Day 4 renders 3 legs + total
- Migration script can regenerate the corrected content from the source markdown without human intervention
- Day 4's drive total reads ~203 km / 4h 10m (down from the bogus ~280 km / 4h 45m)
- Sorapis page surfaces "Hard" difficulty
- Lago di Braies page shows 189 m gain + Moderate difficulty + 4.7★ 2,913 reviews rating
- Cadini page shows 3.4 km / 211 m gain + 4.8★ 2,867 reviews
- Tre Cime page shows 10.1 km / 493 m / 3.5–4h
- Pension Kircher Sepp address shows Via Rosengarten **27**
- Mont Sëuc cable car cost in copy reads **€39 RT**
- Braies P3 access cutoff in copy reads **09:00**
- Bar Anna replaced by Caffè Val d'Anna; Hofschank Klausnerhof removed
- Build clean; all tests pass

## 12. Non-goals

- Not adding live cost-API integration for cable cars (one-time price update only)
- Not adding restaurant reviews/ratings (out of scope)
- Not changing the schedule timestamps based on the new (faster) drive times — schedule is the planned cadence; faster drives = more buffer, which is good
- Not verifying every restaurant phone number with a call

## 13. Open flags

| Flag | Note |
|---|---|
| **Last-lift-down times** for Seceda and Mont Sëuc | Source ambiguous; flagged in `notes` field only |
| **Hofschank Klausnerhof** | Removed; user can re-add manually if firsthand info |
| **Sorapis "Hard" upgrade** | Existing hazards copy already covers exposure; the difficulty change reinforces what's already there |
| **VCE → Cortina drive: 146 km vs 165 km** | Keep 146 (the actual distance per OSRM); keep 2h 30m for traffic buffer | 
| **Day 6 transfer departure timing** | Faster drive (207 vs 280) means earlier Salò arrival; spec leaves the schedule as-is — user can rebalance if they want a leisurely lunch en route |
