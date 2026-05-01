# Lake Garda Extension — Design Spec

**Date:** 2026-05-01
**Status:** Approved
**Goal:** Extend the trip-planning site to cover Phase II (Lake Garda, Jul 20–27, 2026) alongside the existing Phase I (Dolomites, Jul 15–20). Add an Activities catalog, rewire navigation, and ensure both phases coexist cleanly.

---

## 1. Information Architecture & Navigation

### Trip shape
- **Phase I — Dolomites:** Jul 15–20 (existing; structured day-by-day)
- **Phase II — Garda:** Jul 20–27 (new; free-form — pick from activities pool)
- `trip.yaml` `endDate` extends from `2026-07-20` → `2026-07-27`

### Lodging
- New lodging entry: `salo-airbnb.yaml` (Salò, Lake Garda)
- 7 nights, Jul 20 → Jul 27 checkout
- Address and booking URL fields **left blank** for now (user to fill later)

### Bottom nav (4 items, unchanged count)
- **Home** / **Map** / **Activities** / **More**
- Activities **replaces** Checklist in primary nav
- Checklist remains reachable from `/more`

### Phase-aware home page
- If `today < 2026-07-20`: show Phase I hero (countdown to trip start, Dolomites itinerary, hike posters)
- If `today >= 2026-07-20`: show Phase II hero (Garda welcome, Activities CTA, lodging card)
- Phase I content still accessible via scroll / sub-nav for the duration of the trip

### `/more` reorganization
- Section: **Phase I — Dolomites** (Restaurants, Parking, Transit notes, etc.)
- Section: **Phase II — Garda** (Activities catalog link, lodging info)
- Section: **Trip-wide** (Checklist, Bookings, Customize)

### Explicit non-goals
- **No restaurants for Garda** (per user)
- **No parking for Garda** (per user)

---

## 2. Schema

### `ActivitySchema` (new) in `src/content/config.ts`

```typescript
const ActivitySchema = z.object({
  slug: z.string().optional(),
  name: z.string(),
  category: z.enum([
    'water-sports',
    'culture-history',
    'mountain-cable-car',
    'scenic',
    'bike',
    'wine',
    'day-trip',
    'aquatic-park',
    'hiking',
  ]),
  description: z.string(),
  location: z.object({
    label: z.string(),       // e.g. "Sirmione" / "Solferino"
    lat: z.number(),
    lon: z.number(),
  }),
  cost: z.object({
    display: z.string(),     // e.g. "€80–120/hr" or "Free" or "€18 adult"
  }),
  durationHours: z.number().optional(),    // approximate
  driveFromSaloMin: z.number().optional(), // minutes by car
  bookingRequired: z.boolean(),
  bookingNote: z.string().optional(),
  url: z.string().url().optional(),
  featured: z.boolean().default(false),
});
```

### Trip metadata
- `trip.endDate` → `2026-07-27`
- `trip.phases` array (NEW, optional):
  ```yaml
  phases:
    - id: dolomites
      label: "Dolomites"
      start: 2026-07-15
      end: 2026-07-20
    - id: garda
      label: "Lake Garda"
      start: 2026-07-20
      end: 2026-07-27
  ```

### Lodging entry: `salo-airbnb.yaml`
```yaml
slug: salo-airbnb
name: Salò AirBnB
location:
  label: Salò
  lat: 45.6063
  lon: 10.5237
checkIn: 2026-07-20
checkOut: 2026-07-27
nights: 7
address: ""           # blank — to fill later
url: ""               # blank — to fill later
notes: ""
```

---

## 3. UI Changes

### Chapter dividers
- Use roman numerals: **PARTE I** / **PARTE II** for phase headings on home page
- Match existing vintage poster aesthetic (Fraunces serif, gold accent rule)

### `/activities/index.astro` (catalog page)
- Hero: vintage label "ATTIVITÀ — LAGO DI GARDA"
- **Featured row** (4 picks): Solferino, Garda Rent Boat (jetski), Vittoriale, Monte Baldo cable car
- **Filter pills** (sticky): All · Water · Culture · Mountain · Scenic · Bike · Wine · Day-trip · Aquatic · Hiking
  - URL param: `?category=water-sports` etc.
- **Poster grid** of activity cards (similar visual rhythm to hike posters)

### `/activities/[slug].astro` (detail page)
- Title + category eyebrow
- Stat block: **Cost · Duration · Drive from Salò · Booking**
- Description body
- GPS link button (opens Apple/Google Maps)
- "Back to catalog" link
- If `bookingRequired === true`: prominent "Book in advance" CTA with `bookingNote`

### Map page (`/map`)
- Auto-fit bounds across both Dolomites and Garda
- Toggle: "Hikes" / "Activities" pin layers (default: both)
- Activity pins use distinct color/icon from hike pins

### Booking checklist additions
4 booking-priority items added to `/checklist`:
1. Jetski rental (Garda Rent Boat, Sirmione)
2. Vittoriale degli Italiani entry
3. Monte Baldo cable car
4. Solferino Red Cross guided tour (if available)

---

## 4. Activities Catalog (24 entries)

### Featured (4)
1. **Solferino Red Cross Memorial Complex** *(culture-history)* — birthplace of the Red Cross; Memorial + Ossuary + Tower
2. **Garda Rent Boat — Jet Ski Rental** *(water-sports)* — Sirmione, ~€80–120/hr
3. **Vittoriale degli Italiani** *(culture-history)* — D'Annunzio's eccentric villa-museum, Gardone Riviera
4. **Monte Baldo cable car** *(mountain-cable-car)* — Malcesine, panoramic rotating gondola

### Water sports (3)
5. Garda Rent Boat — Boat rental (no licence required)
6. SUP/kayak rental (Salò waterfront)
7. Sailing lessons (Riva del Garda — north end)

### Culture & history (5)
8. **Solferino Memorial Tower & Ossuary** *(part of complex above)*
9. **San Martino della Battaglia** *(culture-history)* — twin battle site to Solferino
10. **Castiglione delle Stiviere — International Red Cross Museum** *(culture-history)* — completes the Red Cross trifecta
11. Sirmione — Grotte di Catullo (Roman ruins on the peninsula)
12. Sirmione — Scaligero Castle (medieval moat castle)

### Mountain & cable car (2)
13. Funivia Monte Baldo (above)
14. Tremalzo / Tremosine cable car + scenic plateau

### Scenic (3)
15. Strada della Forra (Tremosine) — gorge road drive
16. Limone sul Garda — lemon groves & lakefront
17. Punta San Vigilio — cypress promontory + tiny harbour

### Bike (2)
18. Garda by Bike — west coast cliff cycle path (Limone → Riva)
19. E-bike rental Salò

### Wine (2)
20. Lugana DOC tasting (Sirmione/Desenzano)
21. Bardolino wine route (east coast)

### Day trip (1)
22. Verona day trip (~1h drive — Arena, Juliet's balcony, old town)

### Aquatic park (1)
23. Gardaland / Caneva Aquapark (~30min drive — for change of pace)

### Hiking (1)
24. Rocca di Manerba — short hike to lake-view ruins

> Each entry will land in `src/content/activities/<slug>.yaml` with full schema fields populated by `emitActivities()` in the migration script.

---

## 5. Implementation Order

### Phase 1 — Foundation (schema + data)
- Add `ActivitySchema` to `src/content/config.ts`
- Extend `trip.yaml` (endDate, phases)
- Add `salo-airbnb.yaml` lodging
- Extend `scripts/migrate-itinerary.mjs` with `emitActivities()` containing all 24 activities
- Run migration → verify 24 YAML files in `src/content/activities/`
- Bump SW cache: `dolomites-v2` → `dolomites-v3`

### Phase 2 — Navigation rewire
- `BottomNav.astro`: replace Checklist with Activities (icon, href `/activities`)
- Ensure `/checklist` still reachable from `/more`
- Add 4 booking items to checklist
- Phase-aware home page logic (date-conditional hero)

### Phase 3 — Activities pages
- Build `/activities/index.astro` (featured row + filter pills + grid)
- Build `/activities/[slug].astro` (stat block + GPS + booking CTA)
- Update map page: auto-fit bounds, toggle pin layers

### Phase 4 — Itinerary integration
- Home page: chapter dividers (PARTE I / PARTE II), Salò lodging card, days 6–13 free-form section
- `/more` reorganized: Phase I / Phase II / Trip-wide sections

### Phase 5 — Polish & deploy
- Verify all 24 GPS pins render on map
- Lighthouse pass on `/activities` (≥95)
- Deploy via Cloudflare Workers Builds
- Hard refresh to confirm SW cache bump took effect

---

## Out of scope
- Restaurant content for Garda (explicit user exclusion)
- Parking content for Garda (explicit user exclusion)
- AirBnB address / URL (blank until user fills later)
- Multi-language / i18n
- User-account features (the existing customize panel uses `localStorage` and stays as-is)
