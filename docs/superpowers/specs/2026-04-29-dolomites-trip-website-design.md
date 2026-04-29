# Dolomites Trip Website — Design Spec

**Status:** Draft for approval
**Author:** Claude (with Kevin Sundberg)
**Date:** 2026-04-29
**Trip dates:** Wed Jul 15 → Mon Jul 20, 2026
**Repo:** `/Users/kevinsundberg/code/italy/italy-trip`

---

## 1. Purpose & primary jobs

A static website that serves as both:

1. **Pre-trip planning hub** — track booking checklist, refine the itinerary, make open decisions.
2. **On-trip phone companion** — schedules, hike details, GPS, restaurants, contingencies, accessible from a phone with patchy reception.

Secondary: shareable URL for travel companions (read-only). Not a polished portfolio piece — utility comes first; visual quality just needs to be "not embarrassing to share."

**Audience:** Kevin (planner) + 1-2 travel companions (light viewers). No multi-user editing or sync.

## 2. Scope

### In scope (v1)

- Trip overview, day-by-day pages, hike detail pages.
- Booking checklist (persisted per-device).
- Interactive map of trailheads, lodgings, parking (MapLibre + OpenStreetMap).
- Weather widget per hike day (Open-Meteo, no API key).
- **Full local editing**: edit hikes, edit days (incl. dates), add new hikes, add new days, drag-rearrange.
- **Share-link**: copy a URL with your local edits encoded — companions click it to see your version.
- Photo gallery scaffold (empty in v1, populated post-trip).
- Mobile-first responsive design, Trail Atlas visual style.
- Light offline support via service worker.

### Out of scope (v1)

- **Lake Garda section** (Jul 20–27). Data model accommodates it; pages not built.
- Inline editing of lodgings, restaurants, contacts. (Edit source files for those.)
- Authentication, user accounts.
- Multi-device state sync.
- Real-time deploy from browser ("publish my edits"). Edits stay local; canonical updates via `git push`.
- Granular "reset just X" UI. One global "Reset to plan" button only.
- Undo/redo. Reset is the only undo.
- Automated email/calendar/booking integrations.
- PWA install prompt, push notifications.

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 5** + TypeScript strict | Content-first SSG; near-zero JS by default; islands for interactive bits; first-class typed content collections. |
| Styling | **Tailwind CSS** | Mobile-first utility CSS; ships only used classes. |
| Map | **MapLibre GL JS** + OpenStreetMap tiles | Free, no API key, vector tiles, mobile performant. |
| Weather | **Open-Meteo** (`api.open-meteo.com`) | Free, no API key, browser-callable, accurate for Alpine forecasts. |
| Drag-and-drop | **@dnd-kit/core** | ~12kb, accessible, touch-friendly. Lazy-loaded on `/customize` only. |
| Local state | **Zustand** + persist middleware | ~1kb, minimal API, automatic localStorage persistence. |
| Hosting | **Cloudflare Pages** | Free, fast, custom-domain-ready, auto-deploys on `git push`. |
| Toolchain | **mise** for Node + pnpm versions | Already in repo (`mise.toml`). Add Node 22 + pnpm 9. |
| Tests | **Playwright** (one smoke test) + `astro check` | Schema validation catches most issues; smoke test covers SSR + hydration. |

## 4. Content model

Astro Content Collections with Zod schemas. The current `dolomites-garda-itinerary.md` is migrated **once** into these collections; from then on you edit the structured files. The original markdown remains in the repo as a reference doc only.

```
src/content/
  config.ts                    # Zod schemas for all collections
  trip.yaml                    # name, dates, travelers
  days/
    2026-07-15-arrival.md
    2026-07-16-tre-cime.md
    2026-07-17-sorapis.md
    2026-07-18-braies-cadini.md
    2026-07-19-seceda.md
    2026-07-20-alpe-di-siusi.md
  hikes/
    tre-cime.md
    sorapis.md
    lago-di-braies.md
    cadini.md
    seceda-firenze.md
    alpe-di-siusi-family.md
  lodgings/
    baita-fraina.yaml
    pension-kircher-sepp.yaml
  restaurants/
    cortina.yaml
    eisacktal.yaml
    ortisei.yaml
  bookings.yaml                # 11 booking items
```

### 4.1 Schema sketches (Zod, abbreviated)

```ts
// trip
{
  name: string,                       // "Dolomites"
  startDate: ISODate,                 // 2026-07-15
  endDate: ISODate,                   // 2026-07-20
  travelers: string[],                // ["Kevin", "+ party"]
  flights: {
    outbound: FlightLeg[],            // CPH→ZRH→VCE
    return: FlightLeg[]               // VCE→VIE→CPH
  },
  rentalCar: {
    provider: string,                 // "Greenmotion"
    confirmationNumber: string,       // "798336606"
    model: string,                    // "Peugeot 308 or similar"
    pickup: { time: ISODateTime, location: string, address: string, phone: string },
    dropoff: { time: ISODateTime, location: string },
    insurance: string,
    cost: { amount: number, currency: string }
  }
}

// day (frontmatter + body for prose)
{
  date: ISODate,                      // canonical date
  theme: string,                      // "First and most iconic hike"
  driving: { distanceKm: number, durationMin: number, notes?: string },
  schedule: Array<{ time: HHMM, action: string }>,
  hikeSlugs: string[],                // refs to hikes
  lodgingSlug: string,                // ref to lodging where you sleep that night
  weatherFor: { lat: number, lon: number, label: string }, // location to query
  badWeatherOption?: string
}
// body = prose: extra notes, anything not structured

// hike
{
  slug: string,                       // "tre-cime"
  name: string,                       // "Tre Cime di Lavaredo"
  region: string,                     // "Veneto"
  alltrailsUrl: url,
  distanceKm: number,
  elevationGainM: number,
  movingTimeHours: { min: number, max: number },
  totalTimeHours: { min: number, max: number },
  difficulty: 'easy' | 'moderate' | 'hard',
  rating: { stars: number, reviews: number } | null,
  type: 'loop' | 'out-and-back' | 'point-to-point',
  trailhead: { name: string, lat: number, lon: number, addr?: string },
  parking: {
    name: string, costEur: number, mustBook: bool,
    bookingUrl?: url, bookingOpensDaysBefore?: number,
    capacity?: string, alternative?: string
  },
  cableCar?: { name: string, url: url, costEur: number, mustBook: bool },
  routeHighlights: string[],          // bullets
  foodOnTrail: Array<{ name: string, notes: string }>,
  hazards: string[],
  badWeatherOption?: string,
  body: markdown                      // longer prose
}

// lodging
{
  slug: string,
  name: string, location: string,
  checkIn: ISODateTime, checkOut: ISODateTime,
  nights: number,
  phone?: string, email?: string,
  address: string, lat: number, lon: number,
  bookingUrl?: url,
  notes?: string
}

// booking item
{
  id: string,
  label: string,                      // "Tre Cime parking — Thu Jul 16, 07:00 slot"
  category: 'flight' | 'car' | 'lodging' | 'parking' | 'cable-car' | 'restaurant' | 'other',
  status: 'booked' | 'pending-window' | 'not-needed',
  bookingOpens?: ISODate,
  bookingUrl?: url,
  costEur?: number,
  confirmationNumber?: string,
  notes?: string
}

// restaurant (grouped per file)
{
  area: string,                       // "Cortina d'Ampezzo"
  items: Array<{
    name: string,
    type: string,                     // "modern mountain food"
    priceRange: '$' | '$$' | '$$$',
    needsReservation: bool,
    phone?: string, address?: string,
    lat?: number, lon?: number,
    notes?: string
  }>
}
```

### 4.2 Real-data corrections baked into the migration

The migration script applies these corrections vs. the current markdown doc:

| Field | Was | Is | Source |
|---|---|---|---|
| Greenmotion pickup time | 13:00 | **15:00** | Booking confirmation #798336606 |
| Greenmotion conf number | — | **798336606** | Booking confirmation |
| Greenmotion model | — | **Peugeot 308 or similar (auto)** | Booking confirmation |
| Greenmotion cost | — | **6284 SEK** (5259 + 1025 insurance) | Booking confirmation |
| LX 1267 departure | — | **CPH 09:40** | Booking |
| LX 1662 departure | 12:50 | **12:55** | Booking |
| Return flight 1 | missing | **OS 548 VCE 19:10 → VIE 20:15** (op. Air Dolomiti) | Booking |
| Return flight 2 | missing | **OS 989 VIE 21:00 → CPH 22:40** | Booking |
| Hotel booking links | missing | **booking.com URLs for both hotels** | User |

The Day 1 schedule shifts: airport pickup ~15:00, depart airport ~15:30, Cortina ~19:30 (was 19:00). Otherwise unchanged.

## 5. Routes

| Route | Purpose |
|---|---|
| `/` | Home — Trail Atlas style. Trip name, countdown, stat row (days/hikes/booked), "First up" hike card, day-pill scroller, day cards, booking progress. |
| `/day/[date]` | Day detail — schedule timeline, hikes (referenced), driving notes, food, hazards, contingency, weather widget. Editable in customize mode. URL e.g. `/day/2026-07-16`. |
| `/hike/[slug]` | Hike detail — AllTrails link, distance/gain/time, route highlights, food, hazards, GPS, parking info, photos (post-trip). |
| `/lodgings` | Hotel quick-reference — addresses, phone tap-to-call, check-in times, GPS, notes (1-lane road etc.). Single scrollable list. |
| `/restaurants` | Grouped by area (Cortina, Eisacktal, Ortisei, Trail rifugios). |
| `/checklist` | Booking checklist — checkboxes, optional confirmation # field, deep links to booking URLs. Persisted in localStorage. |
| `/contingencies` | Weather decision rules + per-zone rainy-day backups. |
| `/photos` | Gallery — empty placeholder for v1, scaffolded so per-day or per-hike albums drop in cleanly. |
| `/map` | Full-screen interactive map. Pins for trailheads, parking, lodgings, restaurants. Tap pin → mini-card linking to relevant page. |
| `/customize` | Edit mode — drag hikes between days, edit start times, edit hike facts, add new hike, add new day, change day dates. Single page, mobile-friendly. |

**Mobile bottom nav (5 slots):** `Home · Day · Map · Hikes · More`

- "Day" defaults to today's day if inside trip dates, else first upcoming day.
- "More" expands to `Lodgings · Restaurants · Checklist · Contingencies · Photos · Customize · Settings`.

## 6. Interactivity model — full local editing

### 6.1 State shape

Local edits stored as a diff layered on top of canonical content. Persisted to `localStorage` via Zustand persist middleware.

```ts
type LocalState = {
  trip?: Partial<Trip>                          // override trip-level fields
  hikeEdits: Record<string, Partial<Hike>>      // canonical slug → field overrides
  dayEdits: Record<string, Partial<Day>>        // canonical date → field overrides (incl. date moves, hike list)
  customHikes: Record<string, Hike>             // user-created hikes (full)
  customDays: Record<string, Day>               // user-created days (full)
  bookings: Record<string, BookingState>        // checklist state per item
  schemaVersion: 1
  lastEditedAt?: ISODateTime
}
```

Day pages render via a `getEffectiveDay(canonicalDate)` selector that merges canonical + edits. Same for hikes.

### 6.2 What you can edit

UX pattern: **edit-in-place on entity pages**, **add-new on `/customize`**. Editing an existing hike happens on its hike page; creating a brand-new hike happens on `/customize`. Same for days.


| Capability | UI |
|---|---|
| Edit hike facts (distance, gain, GPS, AllTrails URL, route, food, hazards, etc.) | Hike page → "Edit details" → form. Same Zod schema validates inputs. |
| Add a new hike | `/customize` → "+ New hike" → full form. Auto-generates slug. Assignable to any day. |
| Edit day metadata (theme, schedule rows, driving notes) | Day page → "Edit day" toggle → inline editing. |
| Move a hike between days | Drag in `/customize`. |
| Change a day's date | `/customize` → tap day → date picker. **Warning shown:** "Lodging dates are booked separately — your hotel check-in/out won't shift." |
| Add a new day | `/customize` → "+ New day". |
| Delete custom day/hike | Long-press / overflow menu on `/customize`. |
| Edit booking checklist items | `/checklist`, inline. |

### 6.3 UX rules

1. **"Customized" pill** appears in the header whenever any local edits exist. Tap → popover showing change count and a single "Reset to plan" button.
2. **Companions see canonical.** When local edits exist, a small banner on home: *"You have local edits. These don't sync — to share them, use the share-link button."*
3. **Date-change warning.** Sticky banner explains lodging dates don't shift.
4. **Add-content forms are real forms** (not free-text JSON editors) — same fields as canonical, same Zod validation, same friendly error messages.

### 6.4 Share-link

A "Share my plan" button on `/customize` (and accessible from the header pill):

1. Encodes current `LocalState` as URL-safe base64 (compressed via LZ-string for shorter URLs).
2. Generates a URL like `https://<domain>/?plan=<encoded>`.
3. Copies to clipboard. Toast: "Share link copied."

When someone opens a URL with `?plan=…`:

1. Page parses the encoded state.
2. Modal: "Kevin shared a customized version of this trip. Adopt it?" with "Yes, use this plan" and "No, show original."
3. If yes: write to localStorage, strip query param, render the customized version. From now on this device shows Kevin's plan (with the same Customized pill + reset).
4. If no: ignore, render canonical.

URL size: typical edit set ~1-3 KB, well within all browser URL limits.

### 6.5 Apply edits to canonical (optional script)

`scripts/apply-edits.mjs <link-or-file>` — local-only helper. Reads a share-link URL or `LocalState` JSON, rewrites the matching content files. Used when Kevin decides to make a customized plan canonical: paste link, run script, `git push`. Not exposed in the UI.

## 7. Visual direction — Trail Atlas

Selected from three options. Mockup file persisted at `.superpowers/brainstorm/55523-1777490195/content/visual-style.html`.

**Palette**

- Background warm off-white (`#fbfaf6`) and parchment (`#f0ede2`)
- Primary deep forest (`#2d4a3e`)
- Secondary sage (`#5a6b4d`, `#6b7e5c`)
- Text near-black (`#1f2937`), muted brown (`#6b6258`)
- Accent border (`#e6e1d2`)

**Type**

- Body: system sans (`-apple-system, system-ui, ...`) for consistency with iOS/Android; sets `font-feature-settings: 'ss01', 'cv11'` if available.
- Headings: same family, weight 600-700, slightly tighter tracking.
- Numbers in stat blocks: weight 700, deep forest color, larger size.
- No serif (Editorial style was rejected).

**Components**

- Stat row (3 cards: days-to-go, hikes, booked) — used on home and inside day list.
- Day-pill scroller (horizontal, sticky on mobile day pages).
- "Next up" / "First up" featured card with mountain-gradient image placeholder.
- White cards with `1px solid #e6e1d2` borders, 10-12px radius.
- Bottom nav with deep forest background.

**Density**

- Mid-density: between dashboard (B) and editorial (A). Generous on home, tighter on day/hike pages.

**Photography**

- Photos are post-trip. Until then, use CSS gradients keyed to elevation (low = sage green; high = slate; ridge = warm sand).

## 8. Migration plan

### 8.1 One-time content migration

Script: `scripts/migrate-itinerary.mjs`

1. Reads `dolomites-garda-itinerary.md`.
2. Parses sections (Day 1-6, hike detail blocks, lodgings, bookings, restaurants).
3. Emits structured files matching `src/content/` layout above.
4. Applies the real-data corrections from §4.2.
5. Validates output against Zod schemas.
6. Idempotent: running twice produces the same output (overwrites).

After migration, `dolomites-garda-itinerary.md` stays in the repo as a reference doc (not wired into the site). Can be deleted later.

### 8.2 Apply-edits helper

Script: `scripts/apply-edits.mjs <share-link-or-json>`

- Decodes share-link (or accepts JSON path).
- Rewrites affected content files.
- Reports a summary diff.
- User then runs `git diff` to review and `git push` to deploy.

## 9. Quality, performance, offline

### 9.1 Testing

- **Zod schemas** validate all content at build time. Build fails on missing GPS, broken hike refs, bad dates, etc.
- **`astro check`** in CI for TypeScript correctness.
- **One Playwright smoke test**: site loads, day page renders, map mounts, weather widget shows, customize page renders. Run on each push via Cloudflare Pages preview.
- **No unit tests in v1.**

### 9.2 Performance budget

- Lighthouse mobile: ≥95 performance, 100 accessibility, 100 best-practices, 100 SEO.
- Initial JS payload (home, day, hike pages): < 50 KB compressed.
- Map page lazy-loads MapLibre (~150 KB) only on navigation to `/map`.
- `/customize` lazy-loads dnd-kit (~12 KB) on demand.
- Astro `<Image>` for all photos (auto-optimized, lazy-loaded, AVIF/WebP).
- Fonts: system stack (no web-font load).

### 9.3 Offline

Light, opportunistic. Not a full PWA.

- Service worker registered at `/sw.js`, caches static HTML + assets after first visit.
- Map tiles cached opportunistically (visit a day once → tiles for that area available offline).
- Weather widget: gracefully shows last-known forecast with a stale indicator if offline.
- No install prompt; no push notifications.
- Service worker updates on each deploy (skipWaiting).

### 9.4 Accessibility

- Keyboard nav across all pages.
- Drag-and-drop has keyboard alternatives (dnd-kit provides this).
- Color contrast ≥ AA throughout the Trail Atlas palette.
- Mobile tap targets ≥ 44×44 px.
- Map has a skip-link to bypass.

## 10. Deploy & domain

- **Cloudflare Pages** connected to GitHub repo.
- Auto-deploy on `git push origin main`.
- Free `*.pages.dev` subdomain by default.
- Custom domain optional and additive; out of scope for v1.
- Build command: `pnpm build`. Output: `dist/`.
- Build time ~30-60s; deploy ~10s.
- Preview deployments on every branch / PR.

## 11. Project layout

```
italy-trip/
├── src/
│   ├── content/
│   │   ├── config.ts            # Zod schemas
│   │   ├── days/                # 6 day .md files
│   │   ├── hikes/               # 6 hike .md files
│   │   ├── lodgings/            # 2 .yaml files
│   │   ├── restaurants/         # 3 .yaml files (by area)
│   │   ├── bookings.yaml
│   │   └── trip.yaml
│   ├── components/
│   │   ├── MapView.astro        # MapLibre island
│   │   ├── WeatherWidget.tsx    # client island, Open-Meteo
│   │   ├── DayPage.astro
│   │   ├── HikePage.astro
│   │   ├── BookingChecklist.tsx # client island, persists to localStorage
│   │   ├── CustomizedPill.tsx   # header indicator
│   │   ├── ShareLinkModal.tsx
│   │   └── ...
│   ├── stores/
│   │   ├── localState.ts        # Zustand store
│   │   ├── selectors.ts         # getEffectiveDay, getEffectiveHike
│   │   └── shareLink.ts         # encode/decode (+ LZ-string compression)
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PageLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── day/[date].astro
│   │   ├── hike/[slug].astro
│   │   ├── lodgings.astro
│   │   ├── restaurants.astro
│   │   ├── checklist.astro
│   │   ├── contingencies.astro
│   │   ├── photos.astro
│   │   ├── map.astro
│   │   └── customize.astro
│   └── styles/
│       └── global.css           # Tailwind + Trail Atlas tokens
├── scripts/
│   ├── migrate-itinerary.mjs
│   └── apply-edits.mjs
├── tests/
│   └── smoke.spec.ts
├── public/
│   ├── photos/                  # post-trip drops here
│   ├── icons/
│   └── sw.js
├── docs/
│   └── superpowers/specs/       # this file
├── dolomites-garda-itinerary.md # original, kept as reference
├── astro.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── playwright.config.ts
├── mise.toml                    # node, pnpm
└── .gitignore
```

## 12. Open decisions / flags

| Flag | Note |
|---|---|
| **GitHub PAT exposure** | A personal access token was pasted in chat earlier in the brainstorm. It must be revoked at https://github.com/settings/tokens. New token not needed if `gh` CLI is set up; `mise.toml` declares `gh = "latest"` but it's not yet installed (`mise install` will fix). |
| **Lake Garda extension** | Out of scope for v1; data model accommodates additive days. Plan to extend post-trip when content exists. |
| **Custom domain** | Not in v1. Easy to add later via Cloudflare Pages custom domain. |
| **Cadini scheduling decision** | The current itinerary plans Cadini on Jul 18 (with Braies). Section 10 of the doc flags an alternative: Cadini on Jul 16 (with Tre Cime, sharing the toll booking) and Braies alone on Jul 18. The site's `customize` mode lets Kevin try both arrangements without committing. This stays a decision for Kevin, not the site. |
| **Photos UX** | Scaffolded only. Concrete UX (album per day vs. per hike, lightbox lib, etc.) deferred to a separate post-trip spec. |

## 13. Non-goals (explicitly)

- This is not a generic "trip planner" template. It's specifically about *this* trip. Reusability for future trips is not pursued in v1, even though the data model would support it with minimal renaming.
- This is not a CMS. The customize mode is for one user's personal scratchpad of edits; multi-user editing or shared persistence is not built.
- This is not a full PWA. Service worker is light, no install prompt, no notifications.
- This is not optimized for SEO discovery. The trip is for friends and family who have the URL — no marketing copy, no Open Graph tags beyond default.

## 14. Definition of done (v1)

- All 6 days, all 6 hikes, both lodgings, restaurants, and 11 booking items rendered from structured content.
- Mobile bottom nav works; all routes reachable.
- Map page shows pins for every trailhead, lodging, parking lot.
- Weather widget renders for every day with a `weatherFor` location.
- Booking checklist persists across reloads.
- `/customize` allows: edit hike facts, add new hike, edit day, change day date (with warning), add new day, drag-rearrange. All persists.
- Share-link generates URL; opening it on a second device offers to adopt the plan.
- Service worker caches assets; map page works offline after first visit.
- Lighthouse mobile score ≥95 / 100 / 100 / 100.
- Deployed to Cloudflare Pages on `git push`.
- One Playwright smoke test passes in CI.
