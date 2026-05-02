# Tests

Three tiers, each independently runnable.

| Tier | Command | Runtime | What it covers |
|---|---|---|---|
| Unit | `npm test` (also runs integrity) | ~200ms unit + 5–10s build on first run | Pure-logic modules in `src/lib/*` (geo, phase, wordmark, related, tile-math, category-labels), schema validation, migration script builders, localState/share-link/selectors |
| Integrity | runs as part of `npm test` | <1s after build | Walks `dist/**/*.html` with regex helpers in `tests/integrity/parse.ts`. Catches broken internal links, stale wordmarks, bad map links, missing alt-text, schedule-not-rendering, ribbon-missing, day-record consistency. See `tests/integrity/links.test.ts` |
| E2E | `npm run test:e2e` | 30–60s against dev server | Playwright smoke against `npm run dev` (or `pnpm dev` per `playwright.config.ts`). Bottom-nav, page renders, customize flow, drag-drop affordance, share-link |

`npm run test:all` runs all three tiers sequentially after a clean build.

## Adding a new test

- **Unit** — drop a `*.test.ts` or `*.test.mjs` under `tests/unit/`. Vitest picks it up automatically. The mock for `astro:content` at `tests/__mocks__/astro-content.ts` provides `z` and `defineCollection` only — read content YAML directly from disk via `fs.readdirSync('src/content/...')` if you need collection data.
- **Integrity** — add a new `describe` block in `tests/integrity/links.test.ts`. The setup hook in `tests/integrity/setup.ts` ensures `dist/` is fresh before any assertion runs.
- **E2E** — add a new `test('…')` in `tests/e2e/smoke.spec.ts`, or a new `test.describe` group at the bottom.

## Drag-drop policy

Playwright's `dragAndDrop` doesn't reliably trigger `@dnd-kit`'s pointer-event listeners on chrome-headless. We assert the **affordance** in the DOM (chip has `cursor-grab` class + `⋮⋮` grip glyph) and rely on unit tests in `tests/unit/store.test.ts` + `tests/unit/selectors.test.ts` for the actual `moveHikeToDay` state transition.

## Clock freezing

The "today banner is absent outside trip dates" test freezes the clock to 2026-05-02 with `page.clock.install({ time: ... })` so it doesn't silently change meaning when run after Jul 15, 2026.

## Why regex parsing in integrity tests

The original spec called for `cheerio` for HTML parsing. The install failed in the dev environment (npm arborist bug with the existing pnpm-style node_modules). Pivoted to small regex helpers in `tests/integrity/parse.ts` — slightly more verbose but functionally equivalent for the simple invariants we assert (anchors, attributes, class-based element span extraction). Adds zero dependencies.

## What's NOT covered

- Visual regression (Percy/Chromatic)
- Lighthouse CI (manual post-deploy)
- Cross-browser (Chromium-only — matches `playwright.config.ts`)
- Accessibility-tree (axe-core); only `aria-current` + alt-text spot-checks in §3.2 + 3.8
