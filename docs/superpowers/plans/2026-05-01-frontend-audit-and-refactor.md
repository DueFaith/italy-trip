# Frontend Audit & Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a coordinated accessibility / IA / navigation / polish refactor across the existing Dolomites trip site.

**Architecture:** Three independently-shippable phases. **Phase A** (accessibility foundation) is purely additive and ships first. **Phase B** (IA + navigation logic) depends on A's primitives — slims `/day/[date]`, restructures the bottom nav from 5 → 4 items, adds a persistent day-pill scroller, replaces day-walk prev/next on hike pages with trip-order, adds a "Today" banner, polishes the booking checklist and customize page. **Phase C** (polish) layers on Astro view transitions, a PWA manifest, and a Lighthouse pass.

**Tech Stack:** Astro 5 (existing), Tailwind 3 (existing), React (islands only), Zustand (existing), MapLibre GL (existing), Vitest, Playwright. Adds: Astro `<ClientRouter />` for view transitions; static `manifest.webmanifest`.

**Spec:** `docs/superpowers/specs/2026-05-01-frontend-audit-and-refactor-design.md`

---

## Conventions used in this plan

- All file paths are absolute from repo root.
- All commit messages end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- All shell commands assume the repo root and `eval "$(mise activate zsh)"` already run.
- "Verify build" means `pnpm build` exits 0 with no new warnings.
- "Verify check" means `pnpm check` exits 0 with no new errors.
- "Verify tests" means `pnpm test` exits 0 (currently 20 passing).
- After each task that changes user-visible behaviour, also run `pnpm test:e2e` (currently 6 passing) and re-run if any selectors moved.

---

## File Structure

This plan modifies the following files. Files are grouped by phase; within a phase, by category.

### Phase A — Accessibility foundation

| File | Action | Responsibility |
|---|---|---|
| `src/styles/tokens.css` | Modify | Add semantic non-text-gold guidance comment; no token values change |
| `src/styles/global.css` | Modify | Add `:focus-visible` global, `.skip-link` styles, type-scale floor, comment that `--gold` is decorative-only |
| `src/components/BottomNav.astro` | Modify | Bump label size 9.5px → 11px; add `aria-current="page"` (already half-present); enforce ≥56px tap height |
| `src/components/Header.astro` | Modify | 44×44 hit areas; `aria-label` on logo + customize link; bump font sizes |
| `src/layouts/BaseLayout.astro` | Modify | Add `<a class="skip-link" href="#main">` as first body child; wrap content in `<main id="main">` |
| `src/components/BookingChecklist.tsx` | Modify | `aria-label`s; replace gold-text with ink-soft |
| `src/components/CustomizedPill.tsx` | Modify | `aria-label`s |
| `src/components/ShareLinkButton.tsx` | Modify | `aria-label` |
| `src/components/customize/EditHikeButton.tsx` | Modify | `aria-label` |
| `src/components/customize/EditDayButton.tsx` | Modify | `aria-label` |
| `src/pages/index.astro` | Modify | Replace `color: var(--gold)` text uses with `var(--ink-soft)` |
| `src/pages/day/[date].astro` | Modify | Same gold-text → ink-soft sweep |
| `src/pages/hike/[slug].astro` | Modify | Same |
| `src/pages/lodgings.astro` | Modify | Same |
| `src/pages/restaurants.astro` | Modify | Same |
| `src/pages/contingencies.astro` | Modify | Same |
| `src/pages/checklist.astro` | Modify | Same |
| `src/pages/photos.astro` | Modify | Same |
| `src/pages/customize.astro` | Modify | Same |
| `src/pages/more.astro` | Modify | Same |
| `src/pages/hikes/index.astro` | Modify | Same |

### Phase B — IA + navigation logic

| File | Action | Responsibility |
|---|---|---|
| `src/components/BottomNav.astro` | Modify | Drop "Hikes"; 5→4 items; recompute sliding-underline width 20%→25% |
| `src/components/Header.astro` | Modify | Replace "Customize" text link with 44×44 ⚙ gear |
| `src/pages/day/index.astro` | Delete | Day-redirect removed; route lives only as `/day/[date]` |
| `src/pages/day/[date].astro` | Modify | Drop full schedule; keep theme/hikes/driving/lodging/bad-weather + prev/next; add "View full schedule →" link inside hike cards |
| `src/components/DayPillScroller.astro` | Create | New component: sticky horizontal day-pill scroller with `activeDate` prop |
| `src/layouts/BaseLayout.astro` | Modify | Accept optional `activeDayDate` prop; render `<DayPillScroller>` inside `<aside>` when present |
| `src/pages/hike/[slug].astro` | Modify | Add breadcrumb at top; remove "See Day NN" footer; trip-order prev/next; pass `activeDayDate` to BaseLayout |
| `src/pages/index.astro` | Modify | Add today-banner block conditional on `today ∈ trip dates` |
| `src/content/config.ts` | Modify | Add `relatedHikeSlug?: string` to BookingSchema |
| `scripts/migrate-itinerary.mjs` | Modify | Populate `relatedHikeSlug` for parking + cable-car bookings |
| `src/content/bookings.yaml` | Generated | Re-emitted by the migration script |
| `src/components/BookingChecklist.tsx` | Modify | Collapsible confirmation # field; "View hike →" deep-link when `relatedHikeSlug`; hide booking URL when checked |
| `src/components/customize/CustomizePanel.tsx` | Modify | Empty-state hint card |
| `src/pages/customize.astro` | Modify | Promote share button to sticky bottom bar |

### Phase C — Polish

| File | Action | Responsibility |
|---|---|---|
| `src/layouts/BaseLayout.astro` | Modify | Import + render `<ClientRouter />`; `transition:persist` on Header + BottomNav |
| `src/components/Header.astro` | Modify | Add `transition:persist="header"` |
| `src/components/BottomNav.astro` | Modify | Add `transition:persist="bottom-nav"` |
| `public/manifest.webmanifest` | Create | PWA manifest |
| `public/icons/icon-192.png` | Create | PWA icon (192×192) |
| `public/icons/icon-512.png` | Create | PWA icon (512×512) |
| `public/icons/icon-mask-512.png` | Create | PWA maskable icon |
| `public/sw.js` | Modify | Cache key bump v1→v2; add new icons + manifest to pre-cache |

### Tests

| File | Action | Responsibility |
|---|---|---|
| `tests/unit/schemas.test.ts` | Modify | Add test for `relatedHikeSlug` on BookingSchema |
| `tests/e2e/smoke.spec.ts` | Modify | New tests: bottom nav has 4 items; persistent day pills on day & hike pages; today banner conditional |

---

# Phase A — Accessibility foundation (Tasks 1–7)

### Task 1: Update design tokens & global styles for accessibility

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Update `src/styles/tokens.css`**

The token values stay the same; we add a header comment documenting that `--gold` is now non-text-only and `--ink-soft` is the substitute for what was small-text gold. This is informational; no behaviour change yet (the page-level sweeps in Task 6 actually change the colours).

Replace the comment block at the top of the file (the existing `/* Dolomites Trip — Design Tokens ... */` block) with:

```css
/*
 * Dolomites Trip — Design Tokens
 * Aesthetic: Vintage Italian Alpine Travel Poster (Cassandre / Broders / ENIT, 1920s–1950s)
 *
 * Type system:
 *   Display:  "Fraunces" 800–900 italic for hero, 500–600 for section heads.
 *   Body/UI:  "Inter Tight" 300 / 700 only.
 *   Mono:     "JetBrains Mono" 400 with tabular-nums for stats, coords, time.
 *
 * Color rules (post-2026-05-01 audit):
 *   --gold (#D4A24C) is a NON-TEXT TOKEN ONLY. Allowed uses:
 *     - decorative SVG accents
 *     - dashed borders / underlines
 *     - 1-pixel rules
 *     - large display numbers (>= 24px, qualifies as WCAG large text)
 *     - focus outlines (--gold on the ring is decorative, not text)
 *   For small text that previously used gold (eyebrows, mono-cap captions,
 *   ordinals, "View Checklist", "Day NN/NN") use --ink-soft instead — it
 *   passes 4.5:1 contrast on warm-bone bg.
 *
 *   --signal (#A83232) IS approved for text — it passes 4.5:1.
 *   --ink (#0E3B43) on --bg is the safe default; --ink-soft is the muted variant.
 */
```

The rest of the file stays unchanged.

- [ ] **Step 2: Update `src/styles/global.css` — add `:focus-visible`, skip-link, and type-scale floor**

Find the `body { ... }` rule and confirm it has `-webkit-tap-highlight-color: transparent` (it does, as `*` rule). After the `* { -webkit-tap-highlight-color: transparent; }` line, insert:

```css
/* Keyboard focus — gold outline (3:1 against bg, decorative not text) */
:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  border-radius: var(--r-sm);
}
*:focus:not(:focus-visible) { outline: none; }

/* Skip link — visible only when focused */
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
}
.skip-link:focus-visible {
  left: var(--page-x);
  top: 8px;
  background: var(--ink);
  color: var(--bg);
  padding: 10px 14px;
  border-radius: var(--r-sm);
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.06em;
  outline-color: var(--bg);
}
```

- [ ] **Step 3: Update `src/styles/global.css` — bump type scale floor on legacy classes**

Find the `.eyebrow` rule inside `@layer components`. Update:

```css
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;            /* was: 10px — bumped per spec §6 */
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-soft);     /* was: var(--gold) — gold for text fails contrast */
  }
  .eyebrow.accent { color: var(--gold); }   /* opt-in for non-text contexts (rule-adjacent) */
  .eyebrow.signal { color: var(--signal); } /* unchanged */
```

Find `.mono-cap` and bump min size + change default colour:

```css
  .mono-cap {
    font-family: var(--font-mono);
    font-size: 11px;            /* was: 11px (unchanged for default) */
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-soft);     /* unchanged */
  }
  .mono-cap.accent { color: var(--gold); }   /* opt-in for non-text contexts only */
```

- [ ] **Step 4: Verify tests + build**

Run:
```bash
pnpm test && pnpm build
```
Expected: 20/20 pass, build succeeds. (Pages render with eyebrows now in slate-teal instead of gold; the visual change is intentional and we'll sweep page-level inline gold-text in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/global.css
git commit -m "$(cat <<'EOF'
feat(a11y): tokens + global rules for accessibility-first refactor

- Document --gold as non-text-only in tokens.css header.
- .eyebrow and .mono-cap defaults shift gold→ink-soft for contrast;
  .accent opt-in retains gold for non-text contexts.
- Add global :focus-visible (gold outline) and .skip-link styles.
- Mono-cap min size bumped to 11px (Phase A spec §6).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: BaseLayout — skip-link + main landmark

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Add the skip link as the first body element**

The current BaseLayout is:

```astro
---
import '@/styles/global.css';
import Header from '@/components/Header.astro';
import BottomNav from '@/components/BottomNav.astro';
import ReceiveShareLink from '@/components/ReceiveShareLink';
import RegisterServiceWorker from '@/components/RegisterServiceWorker.astro';
const { title = 'Dolomites Trip', headerTitle, bodyClass } = Astro.props as {
  title?: string;
  headerTitle?: string;
  bodyClass?: string;
};
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#F1E9D2" />
    <meta name="theme-color" content="#14282B" media="(prefers-color-scheme: dark)" />
    <title>{title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="preload"
      as="style"
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..900;1,9..144,500..900&display=swap"
      onload="this.onload=null;this.rel='stylesheet'"
    />
  </head>
  <body class={bodyClass}>
    <Header title={headerTitle} />
    <main class="mx-auto" style="max-width: var(--max-content);"><slot /></main>
    <BottomNav />
    <ReceiveShareLink client:load />
    <RegisterServiceWorker />
  </body>
</html>
```

Replace the `<body>` block with:

```astro
  <body class={bodyClass}>
    <a href="#main" class="skip-link">Skip to main content</a>
    <Header title={headerTitle} />
    <main id="main" class="mx-auto" style="max-width: var(--max-content);"><slot /></main>
    <BottomNav />
    <ReceiveShareLink client:load />
    <RegisterServiceWorker />
  </body>
```

- [ ] **Step 2: Build + manual keyboard test**

```bash
pnpm build && pnpm dev
```

Open `http://localhost:4321/`. Press Tab once. Expected: a small gold-bordered "Skip to main content" link appears at the top-left of the viewport. Press Enter. The page jumps focus to the `<main>` element.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "$(cat <<'EOF'
feat(a11y): add skip-to-main link and main landmark

Skip link is the first interactive element on every page; visually
hidden until focused. Lands focus on <main id="main"> when activated.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: BottomNav — accessibility-only changes (label size, aria-current)

**Files:**
- Modify: `src/components/BottomNav.astro`

This task only touches accessibility properties; the 5→4 item refactor happens in Phase B (Task 8).

- [ ] **Step 1: Read the current file**

Current contents of `src/components/BottomNav.astro` end with the per-item label rendered as:

```astro
          <span
            class="font-mono"
            style={`font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; ${active ? 'font-weight: 700;' : ''}`}
          >{it.label}</span>
```

- [ ] **Step 2: Bump label size to 11px**

Replace that span with:

```astro
          <span
            class="font-mono"
            style={`font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; ${active ? 'font-weight: 700;' : ''}`}
          >{it.label}</span>
```

- [ ] **Step 3: Confirm `aria-current` is set on the active link**

Find the `<a>` inside the items.map block. It should already have `aria-current={active ? 'page' : undefined}`. If not, add it. (Per the spec, current code at line ~58 of BottomNav.astro already has this; verify.)

- [ ] **Step 4: Verify ≥56px tap height**

The `<div class="relative grid">` containing items already has `style="...; height: 64px;"` and each `<a>` has `min-height: 56px`. Confirm both unchanged; no edit needed.

- [ ] **Step 5: Build + visual check**

```bash
pnpm build
grep -E "(font-size: 11px|aria-current)" dist/index.html | head -10
```
Expected: bottom-nav labels report 11px in inline style; the active link has `aria-current="page"`.

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomNav.astro
git commit -m "$(cat <<'EOF'
feat(a11y): bottom-nav label size 9.5→11px, confirm aria-current

Hits the spec §6 type-scale floor. aria-current already present on
active item; verified.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Header — accessibility (44×44 hits, aria-labels, sizes)

**Files:**
- Modify: `src/components/Header.astro`

- [ ] **Step 1: Read current Header**

Current file:

```astro
---
import CustomizedPill from '@/components/CustomizedPill';
const { title } = Astro.props as { title?: string };
const wordmark = (title ?? 'Dolomites').toUpperCase();
---
<header class="sticky top-0 z-30">
  <div
    class="flex items-center justify-between"
    style="
      padding: 14px var(--page-x) 12px;
      background: color-mix(in srgb, var(--bg) 70%, transparent);
      backdrop-filter: blur(12px) saturate(140%);
      -webkit-backdrop-filter: blur(12px) saturate(140%);
      border-bottom: 1px solid var(--hairline);
    "
  >
    <a href="/" class="flex items-baseline gap-2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 19 L9 7 L13.5 14 L16 10 L22 19 Z" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" fill="none" />
        <circle cx="9" cy="7" r="0.9" fill="var(--gold)" />
      </svg>
      <span
        class="font-mono"
        style="font-size: 12px; letter-spacing: 0.22em; color: var(--ink); font-weight: 400;"
      >{wordmark}</span>
      <span
        class="font-mono"
        style="font-size: 9.5px; letter-spacing: 0.18em; color: var(--gold); margin-left: 2px;"
      >· '26</span>
    </a>
    <div class="flex items-center gap-3">
      <CustomizedPill client:load />
      <a
        href="/customize"
        class="font-mono"
        style="font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); padding: 8px 4px;"
      >Customize</a>
    </div>
  </div>
</header>
```

- [ ] **Step 2: Replace the entire file**

```astro
---
import CustomizedPill from '@/components/CustomizedPill';
const { title } = Astro.props as { title?: string };
const wordmark = (title ?? 'Dolomites').toUpperCase();
---
<header class="sticky top-0 z-30">
  <div
    class="flex items-center justify-between"
    style="
      padding: 8px var(--page-x);
      background: color-mix(in srgb, var(--bg) 70%, transparent);
      backdrop-filter: blur(12px) saturate(140%);
      -webkit-backdrop-filter: blur(12px) saturate(140%);
      border-bottom: 1px solid var(--hairline);
      min-height: 56px;
    "
  >
    {/* Logo / wordmark — 44×44 hit area; visual is the SVG + text inside */}
    <a
      href="/"
      aria-label="Home"
      class="flex items-center gap-2"
      style="padding: 10px 4px; min-height: 44px;"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 19 L9 7 L13.5 14 L16 10 L22 19 Z" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" fill="none" />
        <circle cx="9" cy="7" r="0.9" fill="var(--gold)" />
      </svg>
      <span
        class="font-mono"
        style="font-size: 12px; letter-spacing: 0.22em; color: var(--ink); font-weight: 400;"
      >{wordmark}</span>
      <span
        class="font-mono"
        style="font-size: 11px; letter-spacing: 0.18em; color: var(--ink-soft); margin-left: 2px;"
      >· '26</span>
    </a>
    <div class="flex items-center gap-3">
      <CustomizedPill client:load />
      <a
        href="/customize"
        aria-label="Customize"
        class="font-mono"
        style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); padding: 12px 8px; min-height: 44px; min-width: 44px; display: inline-flex; align-items: center;"
      >Customize</a>
    </div>
  </div>
</header>
```

The two structural changes:
1. Both anchors have `min-height: 44px` and adequate padding to give a 44×44 hit area.
2. `aria-label` added to both; "· '26" colour shifts gold→ink-soft (gold text fails contrast).
3. Mono caps bumped 10.5/9.5 → 11px (spec §6 floor).

- [ ] **Step 3: Verify build + visual**

```bash
pnpm build && grep -A1 "aria-label=\"Home\"" dist/index.html | head -3
```
Expected: home link has `aria-label="Home"`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.astro
git commit -m "$(cat <<'EOF'
feat(a11y): header 44×44 hit areas, aria-labels, gold-text fix

- Logo and Customize link both expand to 44×44 hit area.
- aria-label on the logo anchor (Home) and Customize anchor.
- "· '26" tagline colour shifts gold→ink-soft (gold text is 2.1:1).
- Mono caps bumped to 11px (spec §6 type-scale floor).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: React island components — aria-labels + tap targets

**Files:**
- Modify: `src/components/CustomizedPill.tsx`
- Modify: `src/components/ShareLinkButton.tsx`
- Modify: `src/components/customize/EditHikeButton.tsx`
- Modify: `src/components/customize/EditDayButton.tsx`
- Modify: `src/components/BookingChecklist.tsx`

- [ ] **Step 1: `CustomizedPill.tsx` — add aria-label and ensure 44×44 close button**

In `src/components/CustomizedPill.tsx`, find the trigger button:

```tsx
      <button onClick={() => setOpen(!open)} className="text-[11px] bg-forest text-white px-2 py-1 rounded-full">
        Customized · {editCount}
      </button>
```

Replace with:

```tsx
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Customized · ${editCount} edits — tap to view options`}
        className="text-[11px] bg-forest text-white px-3 py-2 rounded-full"
        style={{ minHeight: 32, minWidth: 44 }}
      >
        Customized · {editCount}
      </button>
```

(Note: 32px is OK here because this button only ever exists alongside other 44px tap targets in the header — WCAG 2.5.8 allows smaller targets when surrounded by adequate spacing.)

Find the Reset button inside the popover:

```tsx
          <button
            onClick={() => {
              if (confirm('Reset all customizations?')) {
                state.reset();
                setOpen(false);
              }
            }}
            className="mt-2 text-forest underline decoration-dotted"
          >
            Reset to plan
          </button>
```

Replace with:

```tsx
          <button
            onClick={() => {
              if (confirm('Reset all customizations?')) {
                state.reset();
                setOpen(false);
              }
            }}
            className="mt-2 text-forest underline decoration-dotted"
            style={{ minHeight: 44, padding: '8px 0' }}
          >
            Reset to plan
          </button>
```

- [ ] **Step 2: `ShareLinkButton.tsx` — add aria-label**

Find the button:

```tsx
    <button onClick={onClick} className="bg-forest text-white px-4 py-2 rounded text-sm font-semibold w-full">
      {copied ? 'Copied!' : 'Share my plan'}
    </button>
```

Replace with:

```tsx
    <button
      onClick={onClick}
      aria-label="Copy share link to clipboard"
      className="bg-forest text-white px-4 py-3 rounded text-sm font-semibold w-full"
      style={{ minHeight: 44 }}
    >
      {copied ? 'Copied!' : 'Share my plan'}
    </button>
```

(Padding adjusts py-2→py-3, height ≥44px.)

- [ ] **Step 3: `customize/EditHikeButton.tsx` — add aria-label**

Find the trigger button:

```tsx
      <button onClick={() => setOpen(true)} className="text-xs text-forest font-semibold underline decoration-dotted">
        Edit details
      </button>
```

Replace with:

```tsx
      <button
        onClick={() => setOpen(true)}
        aria-label="Edit hike details"
        className="text-xs text-forest font-semibold underline decoration-dotted"
        style={{ minHeight: 44, padding: '10px 0' }}
      >
        Edit details
      </button>
```

- [ ] **Step 4: `customize/EditDayButton.tsx` — add aria-label**

Find the trigger button:

```tsx
      <button onClick={() => setOpen(true)} className="text-xs text-forest font-semibold underline decoration-dotted">
        Edit day
      </button>
```

Replace with:

```tsx
      <button
        onClick={() => setOpen(true)}
        aria-label="Edit day details"
        className="text-xs text-forest font-semibold underline decoration-dotted"
        style={{ minHeight: 44, padding: '10px 0' }}
      >
        Edit day
      </button>
```

- [ ] **Step 5: `BookingChecklist.tsx` — confirm checkbox has accessible name**

Find the hidden `<input type="checkbox">` inside each booking row. It currently has `aria-label={b.label}` — verify present. If missing, add it. (Should be present per the existing implementation.)

- [ ] **Step 6: Build + run unit tests**

```bash
pnpm build && pnpm test
```
Expected: build succeeds, 20/20 unit tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/CustomizedPill.tsx src/components/ShareLinkButton.tsx src/components/customize/EditHikeButton.tsx src/components/customize/EditDayButton.tsx src/components/BookingChecklist.tsx
git commit -m "$(cat <<'EOF'
feat(a11y): aria-labels and ≥44px tap targets on React islands

Touched: CustomizedPill, ShareLinkButton, EditHikeButton, EditDayButton.
Confirmed BookingChecklist input already labelled.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Page-level gold-text → ink-soft sweep

**Files:** all `src/pages/**/*.astro` containing `color: var(--gold)` for *text* uses.

This is a mechanical sweep. The rule: any `style="..."` containing `color: var(--gold)` is checked; if the element is text content (heading, span, p, anchor with text), change to `color: var(--ink-soft)`. Decorative SVG fills, dashed-border rules, gradient stops keep `--gold`.

- [ ] **Step 1: Identify gold-text uses**

```bash
grep -rn "color: var(--gold)" src/pages/ src/components/customize/CustomizePanel.tsx
```
Expected output: a list of every gold-text occurrence. Skim the list; for each, decide if it's text colour (replace with `--ink-soft`) or a decorative context (keep).

- [ ] **Step 2: Replace gold-text with ink-soft across pages**

In each of the following files, replace `color: var(--gold)` with `color: var(--ink-soft)` **only** in spans/headings/paragraphs that are pure text. Do NOT replace in:
- `stroke="var(--gold)"` on SVG (decorative)
- `background: var(--gold)` (decorative)
- `border-color: var(--gold)`, `border-bottom: 1px dashed var(--gold)` (decorative)
- `<linearGradient>` `stop-color`
- The `.eyebrow.accent` opt-in (intentional non-text gold context)

Files to sweep (all in `src/pages/`):
- `index.astro`
- `day/[date].astro`
- `hike/[slug].astro`
- `lodgings.astro`
- `restaurants.astro`
- `contingencies.astro`
- `checklist.astro`
- `photos.astro`
- `customize.astro`
- `more.astro`
- `hikes/index.astro`

Plus `src/components/customize/CustomizePanel.tsx`.

For each file: open it, find every `color: var(--gold)`, judge if it's text vs. decorative, replace text uses.

Examples of changes:

In `src/pages/index.astro`:
```diff
-      <span class="mono-cap" style="font-size: 9.5px; color: var(--gold); letter-spacing: 0.18em;">
-        Day {String(days.findIndex(d => d.data.date === day.data.date) + 1).padStart(2, '0')}
-      </span>
+      <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); letter-spacing: 0.18em;">
+        Day {String(days.findIndex(d => d.data.date === day.data.date) + 1).padStart(2, '0')}
+      </span>
```

(Also bumps the size to the 11px floor — Phase A spec §6.)

In all `mono-cap` style declarations across pages with `color: var(--gold)`: switch to `color: var(--ink-soft)`. Note that when the text is right next to a gold rule or gold border, you can opt into `class="mono-cap accent"` in lieu of inline `color:` — but that's not required for this task; switching to `var(--ink-soft)` is fine everywhere.

For stat captions inside `.poster-stats` — `<div class="mono-cap" style="font-size: 8.5px; color: var(--gold); ...">km</div>` — these are very small (8.5px) decorative captions on a heavily-decorated card. The spec §6 floor is 11px, so:
- Bump font-size 8.5px → **10px** (compromise — still small, still legible, doesn't look like body text).
- Switch colour to `var(--ink-soft)`.

The pattern across the codebase:
```diff
-          <div class="mono-cap" style="font-size: 8.5px; color: var(--gold); margin-top: 4px;">km</div>
+          <div class="mono-cap" style="font-size: 10px; color: var(--ink-soft); margin-top: 4px;">km</div>
```

Apply consistently to all four labels in each `.poster-stats` block (km, m gain, hours, grade).

- [ ] **Step 3: Bump small mono-caps to 11px floor where they are not already 10/11**

Search for `font-size: 9` / `font-size: 9.5px` / `font-size: 9px` across `src/pages/`. Bump any text-bearing element to 11px. (Decorative ticket-rail labels — 9px on `.ticket-label` — can stay 10px.)

```bash
grep -rn "font-size: 9" src/pages/
```

For each result, judge text vs. decorative; bump text to 11px.

- [ ] **Step 4: Build, then visually scan key pages**

```bash
pnpm build
```

Expected: 24 pages, no errors. Then:

```bash
grep -c "color: var(--gold)" dist/index.html
grep -c "color: var(--ink-soft)" dist/index.html
```

Expected: gold-text count drops sharply on home; ink-soft count rises. (Exact numbers depend on the pre-/post-state but the sweep should remove 10+ occurrences.)

- [ ] **Step 5: Run tests + e2e smoke**

```bash
pnpm test && pnpm test:e2e
```
Expected: 20/20 unit, 6/6 e2e pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages src/components/customize/CustomizePanel.tsx
git commit -m "$(cat <<'EOF'
feat(a11y): page-level gold-text → ink-soft sweep

Per spec §6: --gold is a non-text token (passes 3:1 only on large
display elements). All small text uses (eyebrows, mono-caps, ordinals,
stat captions) shift to --ink-soft (~6.7:1, AA passing).

Decorative gold uses preserved: SVG strokes/fills, dashed underlines,
1px rules, gradient stops, focus outline, large display numbers.

Stat captions inside .poster-stats also bumped 8.5px → 10px (still
under the 11px floor but less aggressive than before; counts as
decorative captions adjacent to large numbers).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Heading hierarchy audit & fixes per page

**Files:** every `src/pages/**/*.astro` with multiple headings.

The rule: each page has exactly one `<h1>`. Sections within the page are `<h2>`. Items inside sections are `<h3>`. Any place using `<h3>` directly under `<h1>` without an `<h2>` in between is wrong.

- [ ] **Step 1: Audit each page**

For each page below, list its headings in order and confirm hierarchy. Files to check: `index.astro`, `day/[date].astro`, `hike/[slug].astro`, `lodgings.astro`, `restaurants.astro`, `contingencies.astro`, `checklist.astro`, `photos.astro`, `customize.astro`, `more.astro`, `hikes/index.astro`.

Quick command:
```bash
for f in src/pages/index.astro src/pages/day/\[date\].astro src/pages/hike/\[slug\].astro src/pages/lodgings.astro src/pages/restaurants.astro src/pages/contingencies.astro src/pages/checklist.astro src/pages/photos.astro src/pages/customize.astro src/pages/more.astro src/pages/hikes/index.astro; do
  echo "=== $f ==="
  grep -E "^\s*<h[1-6]" "$f" | head -20
done
```

Expected output: a per-file list of headings.

- [ ] **Step 2: Fix violations**

The most common pattern that needs fixing: a section opens with `<p class="eyebrow">Section Name</p>` (a paragraph styled as a label) followed by `<h3>Item Name</h3>` cards. This skips H2.

Where this happens, **replace the `<p class="eyebrow">` with an `<h2 class="eyebrow">`** so the hierarchy is H1 → H2 → H3 with the H2 visually rendered as a small caps eyebrow.

Add this CSS (in `src/styles/global.css`, inside the `@layer components` block, near the other `.eyebrow` rules):

```css
  /* Allow .eyebrow on actual heading elements (h2/h3) without breaking the look */
  h2.eyebrow, h3.eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-soft);
    margin: 0;
  }
```

Then, on each page, audit the eyebrow tags:
- An eyebrow that introduces a *section* (group of items) → use `<h2 class="eyebrow">`.
- An eyebrow that's a *label inside a card* (e.g., "DAY 04 · SAT 18 JUL" inside a hike-poster) → keep as `<p>` or `<span>`. Not a heading.

Concrete fixes per page (representative; apply pattern):

In `src/pages/index.astro`:
- Section "The 6 Hikes": `<p class="eyebrow with-rule">The {hikesInOrder.length} Hikes</p>` → `<h2 class="eyebrow with-rule">The {hikesInOrder.length} Hikes</h2>`
- Section "Itinerary": `<p class="eyebrow with-rule">Itinerary</p>` → `<h2 class="eyebrow with-rule">Itinerary</h2>`
- "First up" (not present anymore in the latest version, skip)
- "A Trip To" eyebrow (it's the H1's eyebrow, not a section header) → keep as `<p>`

In `src/pages/day/[date].astro`:
- "Hikes" eyebrow → `<h2 class="eyebrow">{hikes.length === 1 ? 'Hike' : 'Hikes'}</h2>`
- "Driving", "Lodging", "If The Weather Turns" eyebrows → all `<h2 class="eyebrow">`
- (The Schedule section is being removed in Phase B — no need to fix its heading.)

In `src/pages/hike/[slug].astro`:
- Part I sections: "Trailhead", "Parking", "Route Highlights", "Food on the Trail", "Hazards & Tips", "If The Weather Turns" → all `<h2 class="eyebrow">`.
- Part II already has `<h2>` for the day theme (good).
- Within Part II: "Schedule", "Weather", "Driving", "Where You Sleep", "Also Today" eyebrows → these are H3s under the Part II H2.
  - Convert these to `<h3 class="eyebrow">`.

In `src/pages/lodgings.astro`, `restaurants.astro`, `contingencies.astro`, `customize.astro`, `more.astro`, `photos.astro`, `hikes/index.astro`, `checklist.astro`: each section eyebrow becomes `<h2 class="eyebrow">`.

- [ ] **Step 3: Build + smoke heading order**

```bash
pnpm build
# Sanity check: home page heading sequence
grep -oE "<h[1-6]" dist/index.html | head -10
# Expected: <h1, <h2, <h2, <h2, ... (H1 once, H2s for sections; H3s for items inside sections)
```

- [ ] **Step 4: Run tests + e2e**

```bash
pnpm test && pnpm test:e2e
```
Expected: still 20/20 + 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/pages src/styles/global.css
git commit -m "$(cat <<'EOF'
feat(a11y): heading hierarchy fix — H1 / H2 / H3 chain on every page

Section-introducing eyebrows promoted from <p class="eyebrow"> to
<h2 class="eyebrow">. Item eyebrows inside cards stay <p> / <span>
since they're labels, not headings.

Hike page Part II nests its sub-eyebrows ("Schedule", "Driving",
"Where You Sleep", etc.) as <h3> under the Part II <h2>.

Adds h2.eyebrow / h3.eyebrow rules to global.css so the heading
elements render with the same compact mono-caps look.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

# Phase B — IA + navigation logic (Tasks 8–18)

### Task 8: BottomNav — 5 → 4 items

**Files:**
- Modify: `src/components/BottomNav.astro`

- [ ] **Step 1: Update items array and underline width**

Find:

```astro
const items = [
  { href: '/',       label: 'Home',  icon: 'home' },
  { href: '/day',    label: 'Day',   icon: 'day' },
  { href: '/map',    label: 'Map',   icon: 'map' },
  { href: '/hikes',  label: 'Hikes', icon: 'hikes' },
  { href: '/more',   label: 'More',  icon: 'more' },
] as const;
```

Replace with:

```astro
const items = [
  { href: '/',          label: 'Home',      icon: 'home' },
  { href: '/map',       label: 'Map',       icon: 'map' },
  { href: '/checklist', label: 'Checklist', icon: 'checklist' },
  { href: '/more',      label: 'More',      icon: 'more' },
] as const;
```

- [ ] **Step 2: Update grid template + underline width**

Find:

```astro
  <div
    class="relative grid"
    style="grid-template-columns: repeat(5, 1fr); height: 64px;"
  >
    {/* Sliding gold underline — width = 20% (one of five tabs) */}
    <span
      aria-hidden="true"
      style={`
        position: absolute;
        top: 0;
        height: 2px;
        width: 20%;
        background: var(--gold);
        transform: translateX(${activeIndex * 100}%);
        transition: transform 320ms cubic-bezier(0.2, 0.7, 0.1, 1);
      `}
    ></span>
```

Replace with:

```astro
  <div
    class="relative grid"
    style="grid-template-columns: repeat(4, 1fr); height: 64px;"
  >
    {/* Sliding gold underline — width = 25% (one of four tabs) */}
    <span
      aria-hidden="true"
      style={`
        position: absolute;
        top: 0;
        height: 2px;
        width: 25%;
        background: var(--gold);
        transform: translateX(${activeIndex * 100}%);
        transition: transform 320ms cubic-bezier(0.2, 0.7, 0.1, 1);
      `}
    ></span>
```

- [ ] **Step 3: Add the 'checklist' icon and remove 'day'/'hikes' icon variants**

Find the per-item icon block. Currently includes `it.icon === 'day'`, `it.icon === 'hikes'`, etc. Remove the `'day'` and `'hikes'` icon blocks (no longer in nav). Add a new `'checklist'` icon block:

```astro
          {it.icon === 'checklist' && (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="3" width="14" height="18" rx="1.5" stroke={stroke} stroke-width="1.5" fill="none" />
              <path d="M9 9 L11 11 L15 7" stroke={accent || stroke} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M9 14 H15 M9 17 H13" stroke={stroke} stroke-width="1.25" stroke-linecap="round" />
            </svg>
          )}
```

(The existing `'home'`, `'map'`, `'more'` icon blocks stay unchanged.)

If the `'home'` icon block conditionally uses `<circle ... fill="var(--gold)" />` only when active, add a similar gold accent to the `'checklist'` icon. Pattern:

```astro
          {it.icon === 'checklist' && (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="3" width="14" height="18" rx="1.5" stroke={stroke} stroke-width="1.5" fill="none" />
              <path d="M9 9 L11 11 L15 7" stroke={active ? 'var(--gold)' : stroke} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M9 14 H15 M9 17 H13" stroke={stroke} stroke-width="1.25" stroke-linecap="round" />
            </svg>
          )}
```

- [ ] **Step 4: Build & verify nav has 4 items**

```bash
pnpm build && grep -E "(Home|Map|Checklist|More)</span>" dist/index.html | head -5
```
Expected: 4 nav labels rendered; "Day" and "Hikes" no longer appear in dist/index.html nav.

- [ ] **Step 5: Update the e2e test that depends on nav**

In `tests/e2e/smoke.spec.ts`, find the test that checks nav (if any) — currently there isn't a dedicated nav test. Add one:

```ts
test('bottom nav has 4 items: home, map, checklist, more', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: /primary/i });
  // Each item is an <a> with text and an aria-current state
  await expect(nav.getByText('Home', { exact: true })).toBeVisible();
  await expect(nav.getByText('Map', { exact: true })).toBeVisible();
  await expect(nav.getByText('Checklist', { exact: true })).toBeVisible();
  await expect(nav.getByText('More', { exact: true })).toBeVisible();
  await expect(nav.getByText('Day', { exact: true })).toHaveCount(0);
  await expect(nav.getByText('Hikes', { exact: true })).toHaveCount(0);
});
```

(Append to the existing `tests/e2e/smoke.spec.ts`.)

- [ ] **Step 6: Run e2e**

```bash
pnpm test:e2e
```
Expected: 7/7 pass (was 6, +1 new nav test).

- [ ] **Step 7: Commit**

```bash
git add src/components/BottomNav.astro tests/e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
feat(nav): bottom nav 5 → 4 items, drop /day and /hikes

Per spec §4 IA: Home / Map / Checklist / More.
Sliding-underline width 20% → 25%.
Adds custom checklist SVG glyph (1.5px stroke clipboard with tick).

E2E: new smoke test asserts the 4 expected items are present and the
removed items (Day, Hikes) do not appear in the nav.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Header — replace "Customize" text link with gear icon

**Files:**
- Modify: `src/components/Header.astro`

- [ ] **Step 1: Replace the customize anchor**

Find the existing customize link:

```astro
      <a
        href="/customize"
        aria-label="Customize"
        class="font-mono"
        style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-soft); padding: 12px 8px; min-height: 44px; min-width: 44px; display: inline-flex; align-items: center;"
      >Customize</a>
```

Replace with:

```astro
      <a
        href="/customize"
        aria-label="Customize"
        style="display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 10px; color: var(--ink-soft);"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 15.5 a3.5 3.5 0 1 0 0 -7 a3.5 3.5 0 1 0 0 7 z" stroke="currentColor" stroke-width="1.5" />
          <path d="M19.4 15 a1 1 0 0 0 0.2 1.1 l 0.07 0.07 a2 2 0 1 1 -2.83 2.83 l -0.07 -0.07 a1 1 0 0 0 -1.1 -0.2 1 1 0 0 0 -0.6 0.92 V20 a2 2 0 1 1 -4 0 v -0.1 a1 1 0 0 0 -0.65 -0.92 1 1 0 0 0 -1.1 0.2 l -0.07 0.07 a2 2 0 1 1 -2.83 -2.83 l 0.07 -0.07 a1 1 0 0 0 0.2 -1.1 1 1 0 0 0 -0.92 -0.6 H4 a2 2 0 1 1 0 -4 h 0.1 a1 1 0 0 0 0.92 -0.65 1 1 0 0 0 -0.2 -1.1 l -0.07 -0.07 a2 2 0 1 1 2.83 -2.83 l 0.07 0.07 a1 1 0 0 0 1.1 0.2 H9 a1 1 0 0 0 0.6 -0.92 V4 a2 2 0 1 1 4 0 v 0.1 a1 1 0 0 0 0.6 0.92 1 1 0 0 0 1.1 -0.2 l 0.07 -0.07 a2 2 0 1 1 2.83 2.83 l -0.07 0.07 a1 1 0 0 0 -0.2 1.1 V9 a1 1 0 0 0 0.92 0.6 H20 a2 2 0 1 1 0 4 h -0.1 a1 1 0 0 0 -0.92 0.6 z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </a>
```

This is a standard 22×22 gear glyph rendered inline with 1.5px stroke matching the rest of the icon set. The 44×44 hit area is preserved by the wrapper anchor's min-width/height + padding.

- [ ] **Step 2: Build + verify gear renders**

```bash
pnpm build && grep -c "Customize" dist/index.html
```
Expected: only `aria-label="Customize"` appears in the rendered HTML for the header (the visible text "Customize" is gone — replaced by the SVG).

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.astro
git commit -m "$(cat <<'EOF'
feat(nav): replace header "Customize" text link with ⚙ gear icon

22×22 gear glyph in the existing 1.5px-stroke vintage line-icon
style; aria-label="Customize"; 44×44 hit area preserved.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Delete /day root redirect

**Files:**
- Delete: `src/pages/day/index.astro`

- [ ] **Step 1: Confirm no inbound links remain**

```bash
grep -rn "href=\"/day\"" src/
```
Expected: no results. (The "Day" item was already removed from the bottom nav in Task 8.)

If any unexpected references appear, update them to point at a specific date instead.

- [ ] **Step 2: Delete the file**

```bash
rm src/pages/day/index.astro
```

- [ ] **Step 3: Build to confirm 23 pages**

```bash
pnpm build 2>&1 | tail -5
```
Expected: "23 page(s) built" (was 24).

- [ ] **Step 4: Commit**

```bash
git add -A src/pages/day/
git commit -m "$(cat <<'EOF'
chore(nav): remove /day root redirect

The /day → today's-day redirect was a leftover from the 5-item nav.
With Phase B's 4-item nav, /day is no longer linked from anywhere;
days are reached via /day/[date] from the home itinerary or via
the persistent day-pill scroller (Task 12).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Slim /day/[date] — remove schedule timeline

**Files:**
- Modify: `src/pages/day/[date].astro`

- [ ] **Step 1: Remove the Schedule section**

Find the section that starts:

```astro
  {/* Schedule */}
  {day.data.schedule.length > 0 && (
    <section class="stagger" style="padding: 6px var(--page-x) 18px;">
      <ol style="list-style: none; ... ">
        {day.data.schedule.map(...)}
      </ol>
    </section>
  )}
```

**Delete the entire `{/* Schedule */}` block.**

- [ ] **Step 2: Add a "View full schedule" callout inside each hike card**

In the Hikes section, find where hikes are rendered as `.hike-poster` cards (added in the prior design pass). After the `<div class="poster-stats">...</div>` closing tag and before the closing `</a>`, add:

```astro
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--hairline); display: flex; align-items: center; gap: 6px; color: var(--ink-soft);">
              <span class="mono-cap" style="font-size: 10px;">View Full Schedule</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12 H19 M14 6 L20 12 L14 18" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
              </svg>
            </div>
```

This makes the "tap a hike for the full operational picture" hint explicit and gives the user a concrete reason to drill in.

- [ ] **Step 3: Confirm the rest of the day page is intact**

The page should still render: hero (Day stamp + theme + EditDayButton), Hikes, Driving, Lodging, Bad-Weather, prev/next nav.

- [ ] **Step 4: Build**

```bash
pnpm build
```
Expected: 23 pages, no errors. The /day/2026-07-16 page now lacks the schedule timeline.

- [ ] **Step 5: Update e2e — day page no longer has Schedule**

In `tests/e2e/smoke.spec.ts`, find:

```ts
test('day page renders schedule and weather', async ({ page }) => {
  await page.goto('/day/2026-07-16');
  await expect(page.getByText(/Schedule/i)).toBeVisible();
  await expect(page.getByText(/Hikes/i)).toBeVisible();
});
```

Replace with:

```ts
test('day page renders hikes and driving (schedule lives on hike page now)', async ({ page }) => {
  await page.goto('/day/2026-07-16');
  await expect(page.getByRole('main').getByText('Hikes', { exact: true })).toBeVisible();
  // Schedule section was moved to the hike page in spec §4 — ensure it's NOT here
  await expect(page.locator('main').getByText('Schedule', { exact: true })).toHaveCount(0);
});
```

- [ ] **Step 6: Run e2e**

```bash
pnpm test:e2e
```
Expected: 7/7 pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/day/\[date\].astro tests/e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
feat(ia): slim /day/[date] — schedule canonical lives on hike page

Per spec §4: the day page becomes a "day at-a-glance" view (theme,
hikes, driving, lodging, bad-weather, prev/next). The full schedule
timeline now lives only on the hike page Part II.

Each hike card on the day page gets a "View Full Schedule →" line
to direct users to the hike page where the schedule lives.

E2E updated: day page asserts NO Schedule section, hike page still
has it (per existing test).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Create DayPillScroller component

**Files:**
- Create: `src/components/DayPillScroller.astro`

- [ ] **Step 1: Create the component**

```astro
---
/*
 * DayPillScroller — sticky horizontal day-pill scroller.
 * Used as <aside aria-label="Day navigation"> below the page header on
 * /day/[date] and /hike/[slug] so users can jump to any day from any page.
 *
 * Props:
 *   activeDate — ISO date (YYYY-MM-DD) of the day matching the current page.
 *                The matching pill gets aria-current="true" and the gold border.
 */
import { getDays } from '@/lib/content';

const { activeDate } = Astro.props as { activeDate: string };
const days = await getDays();

const fmtDay = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric' });
const fmtMon = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
---
<aside
  aria-label="Day navigation"
  style="
    position: sticky;
    top: 56px;
    z-index: 20;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(10px) saturate(140%);
    -webkit-backdrop-filter: blur(10px) saturate(140%);
    border-bottom: 1px solid var(--hairline);
  "
>
  <div
    class="day-pill-scroll"
    style="
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scroll-snap-type: x proximity;
      padding: 10px var(--page-x);
      margin: 0;
      -webkit-overflow-scrolling: touch;
    "
  >
    {days.map((d) => {
      const isActive = d.data.date === activeDate;
      return (
        <a
          href={`/day/${d.data.date}`}
          class:list={['day-pill', isActive ? 'is-active' : '']}
          style="scroll-snap-align: start;"
          aria-current={isActive ? 'true' : undefined}
        >
          <span style="font-weight: 700;">{fmtDay(d.data.date)}</span>
          <span style="opacity: 0.7;">{fmtMon(d.data.date)}</span>
        </a>
      );
    })}
  </div>
</aside>
```

The component uses the existing `.day-pill` class from `global.css` for the pills themselves; only the wrapping `<aside>` and the scroller container are new styling.

- [ ] **Step 2: Build (component is created but not yet referenced anywhere)**

```bash
pnpm build
```
Expected: 23 pages still build. The component exists but is unused; this is fine.

- [ ] **Step 3: Commit**

```bash
git add src/components/DayPillScroller.astro
git commit -m "$(cat <<'EOF'
feat(nav): create DayPillScroller component

Sticky <aside> below the page header that renders the 6 days as
horizontally-scrollable pills. activeDate prop marks the matching
pill with aria-current="true" and gold border.

Wired into BaseLayout in Task 13.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Wire DayPillScroller through BaseLayout + day + hike pages

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/day/[date].astro`
- Modify: `src/pages/hike/[slug].astro`

- [ ] **Step 1: Update BaseLayout to accept and render DayPillScroller**

In `src/layouts/BaseLayout.astro`, replace the frontmatter block:

```astro
---
import '@/styles/global.css';
import Header from '@/components/Header.astro';
import BottomNav from '@/components/BottomNav.astro';
import ReceiveShareLink from '@/components/ReceiveShareLink';
import RegisterServiceWorker from '@/components/RegisterServiceWorker.astro';
const { title = 'Dolomites Trip', headerTitle, bodyClass } = Astro.props as {
  title?: string;
  headerTitle?: string;
  bodyClass?: string;
};
---
```

with:

```astro
---
import '@/styles/global.css';
import Header from '@/components/Header.astro';
import BottomNav from '@/components/BottomNav.astro';
import DayPillScroller from '@/components/DayPillScroller.astro';
import ReceiveShareLink from '@/components/ReceiveShareLink';
import RegisterServiceWorker from '@/components/RegisterServiceWorker.astro';
const { title = 'Dolomites Trip', headerTitle, bodyClass, activeDayDate } = Astro.props as {
  title?: string;
  headerTitle?: string;
  bodyClass?: string;
  activeDayDate?: string;
};
---
```

In the `<body>` block, render `<DayPillScroller>` between the header and main when `activeDayDate` is provided:

```astro
  <body class={bodyClass}>
    <a href="#main" class="skip-link">Skip to main content</a>
    <Header title={headerTitle} />
    {activeDayDate && <DayPillScroller activeDate={activeDayDate} />}
    <main id="main" class="mx-auto" style="max-width: var(--max-content);"><slot /></main>
    <BottomNav />
    <ReceiveShareLink client:load />
    <RegisterServiceWorker />
  </body>
```

- [ ] **Step 2: Pass activeDayDate from /day/[date]**

In `src/pages/day/[date].astro`, find the `<BaseLayout>` opening tag:

```astro
<BaseLayout title={`Day ${dayIndex + 1} — ${day.data.theme}`}>
```

Replace with:

```astro
<BaseLayout title={`Day ${dayIndex + 1} — ${day.data.theme}`} activeDayDate={day.data.date}>
```

- [ ] **Step 3: Pass activeDayDate from /hike/[slug]**

In `src/pages/hike/[slug].astro`, find:

```astro
<BaseLayout title={hike.data.name}>
```

Replace with:

```astro
<BaseLayout title={hike.data.name} activeDayDate={dayForHike?.data.date}>
```

(Already-fetched `dayForHike` is in scope from earlier.)

- [ ] **Step 4: Build & verify scroller appears**

```bash
pnpm build && grep -c 'aria-label="Day navigation"' dist/day/2026-07-16/index.html
```
Expected: 1.

- [ ] **Step 5: Verify home page does NOT show the scroller**

```bash
grep -c 'aria-label="Day navigation"' dist/index.html
```
Expected: 0. (Home doesn't pass `activeDayDate`.)

- [ ] **Step 6: Add e2e test**

In `tests/e2e/smoke.spec.ts`, append:

```ts
test('persistent day-pill scroller appears on day and hike pages', async ({ page }) => {
  await page.goto('/day/2026-07-16');
  await expect(page.getByRole('complementary', { name: /day navigation/i })).toBeVisible();

  await page.goto('/hike/tre-cime');
  await expect(page.getByRole('complementary', { name: /day navigation/i })).toBeVisible();
});

test('day-pill scroller is absent from home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: /day navigation/i })).toHaveCount(0);
});
```

- [ ] **Step 7: Run e2e**

```bash
pnpm test:e2e
```
Expected: 9/9 pass (was 7, +2 new).

- [ ] **Step 8: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/day/\[date\].astro src/pages/hike/\[slug\].astro tests/e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
feat(nav): wire DayPillScroller into BaseLayout via activeDayDate prop

BaseLayout accepts an optional activeDayDate; when present, renders
DayPillScroller as a sticky <aside> between Header and <main>.
Day pages and hike pages pass it; home/map/checklist/etc don't.

E2E: 2 new tests asserting scroller presence on day + hike pages,
absence on home.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Hike page — trip-order prev/next + breadcrumb

**Files:**
- Modify: `src/pages/hike/[slug].astro`

- [ ] **Step 1: Add the breadcrumb at the top of the hero**

In `src/pages/hike/[slug].astro`, find the hero section that begins:

```astro
  {/* Hero */}
  <section class="stagger" style="padding: 24px var(--page-x) 12px;">
    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
      {dayForHike && (
        <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft); font-weight: 700;">
          Day {String(dayIndex + 1).padStart(2, '0')} / {String(totalDays).padStart(2, '0')}
        </span>
      )}
      <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft);">·</span>
      <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft);">{hike.data.region}</span>
      <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft);">·</span>
      <span class="mono-cap" style="font-size: 10px; color: var(--ink-soft);">{hike.data.type.replace('-', ' ')}</span>
    </div>
```

Replace the `<div>` with the `Day NN/NN`, region, type strip with this two-row layout:

```astro
    {/* Breadcrumb back to the day overview */}
    {dayForHike && (
      <a
        href={`/day/${dayForHike.data.date}`}
        style="display: inline-flex; align-items: center; gap: 6px; color: var(--ink-soft); padding: 8px 0; min-height: 44px;"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 6 L9 12 L15 18" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="mono-cap" style="font-size: 11px;">
          Day {String(dayIndex + 1).padStart(2, '0')} · {new Date(dayForHike.data.date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
        </span>
      </a>
    )}
    {/* Region · type meta */}
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
      <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft);">{hike.data.region}</span>
      <span style="color: var(--gold); opacity: 0.6;">·</span>
      <span class="mono-cap" style="font-size: 11px; color: var(--ink-soft);">{hike.data.type.replace('-', ' ')}</span>
    </div>
```

- [ ] **Step 2: Compute trip-order hike list and prev/next**

In the frontmatter of `src/pages/hike/[slug].astro`, after the existing `dayForHike` / `dayIndex` / `totalDays` / `dayLodging` / `otherHikes` block, add:

```ts
// Trip-order list of all hikes; used for prev/next that walks across day boundaries
const allHikesInTripOrder: Array<{ slug: string; name: string; date: string; dayIndex: number }> = [];
for (let di = 0; di < days.length; di++) {
  const d = days[di];
  for (const slug of d.data.hikeSlugs) {
    const h = await getHike(slug);
    if (!h) continue;
    allHikesInTripOrder.push({ slug, name: h.data.name, date: d.data.date, dayIndex: di });
  }
}
const currentTripIdx = allHikesInTripOrder.findIndex((h) => h.slug === hike.slug);
const prevHike = currentTripIdx > 0 ? allHikesInTripOrder[currentTripIdx - 1] : null;
const nextHike = currentTripIdx >= 0 && currentTripIdx < allHikesInTripOrder.length - 1
  ? allHikesInTripOrder[currentTripIdx + 1]
  : null;
```

- [ ] **Step 3: Replace the day-page footer link with trip-order prev/next**

Find the existing footer (added in the Part II section):

```astro
      {/* Day-page link footer */}
      <section style="padding: 8px var(--page-x) 28px; text-align: center;">
        <a
          href={`/day/${dayForHike.data.date}`}
          class="mono-cap"
          ...
        >
          See Day {dayIndex + 1} On Its Own
          ...
        </a>
      </section>
```

Replace with:

```astro
      {/* Trip-order prev/next — walks all 6 hikes regardless of day boundaries */}
      <nav aria-label="Hike navigation" style="
        padding: 28px var(--page-x);
        display: flex;
        justify-content: space-between;
        align-items: stretch;
        gap: 12px;
        border-top: 1px dashed var(--hairline);
        margin-top: 12px;
      ">
        {prevHike ? (
          <a href={`/hike/${prevHike.slug}`} style="
            flex: 1;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 12px;
            min-height: 44px;
            color: var(--ink-soft);
            border: 1px solid var(--hairline);
            border-radius: var(--r-sm);
            background: var(--bg-paper);
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex: 0 0 auto;">
              <path d="M15 6 L9 12 L15 18" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span style="display: flex; flex-direction: column; min-width: 0;">
              <span class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">Previous Hike</span>
              <span style="font-family: var(--font-display); font-weight: 600; font-size: 14px; color: var(--ink); line-height: 1.15; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{prevHike.name}</span>
            </span>
          </a>
        ) : <span style="flex: 1;"></span>}
        {nextHike ? (
          <a href={`/hike/${nextHike.slug}`} style="
            flex: 1;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 14px 12px;
            min-height: 44px;
            color: var(--ink-soft);
            border: 1px solid var(--hairline);
            border-radius: var(--r-sm);
            background: var(--bg-paper);
            justify-content: flex-end;
            text-align: right;
          ">
            <span style="display: flex; flex-direction: column; align-items: flex-end; min-width: 0;">
              <span class="mono-cap" style="font-size: 9.5px; color: var(--ink-soft);">Next Hike</span>
              <span style="font-family: var(--font-display); font-weight: 600; font-size: 14px; color: var(--ink); line-height: 1.15; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{nextHike.name}</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex: 0 0 auto;">
              <path d="M9 6 L15 12 L9 18" stroke="var(--gold)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
        ) : <span style="flex: 1;"></span>}
      </nav>
```

- [ ] **Step 4: Build + spot-check Lago di Braies**

```bash
pnpm build && grep -E "(Previous Hike|Next Hike|Lake Sorapis|Cadini di Misurina)" dist/hike/lago-di-braies/index.html | head -5
```
Expected: prev = Lake Sorapis, next = Cadini di Misurina (the trip-order succession across days).

- [ ] **Step 5: Add e2e test for trip-order prev/next**

In `tests/e2e/smoke.spec.ts`, append:

```ts
test('hike page prev/next walks trip order across day boundaries', async ({ page }) => {
  // From Lago di Braies (Day 4, hike #3 in trip order):
  // prev should be Sorapis (Day 3), next should be Cadini (Day 4 same day)
  await page.goto('/hike/lago-di-braies');
  await expect(page.getByText('Lake Sorapis via Passo Tre Croci', { exact: false })).toBeVisible();
  await expect(page.getByText('Cadini di Misurina viewpoint', { exact: false })).toBeVisible();
});
```

- [ ] **Step 6: Run e2e**

```bash
pnpm test:e2e
```
Expected: 10/10 pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/hike/\[slug\].astro tests/e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
feat(nav): hike page — breadcrumb + trip-order prev/next

- Adds a tappable breadcrumb at top of hero ("← Day 04 · Sat 18 Jul")
  pointing back to the day-overview page.
- Replaces the "See Day NN On Its Own" footer with a real prev/next
  nav that walks all 6 hikes in trip order — so from Lago di Braies
  you go forward to Cadini (same day) and backward to Sorapis (prior
  day) seamlessly.

E2E: new test asserts the cross-day succession on the Lago di Braies
page.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Today banner on home page (trip-dates conditional)

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Compute today's hike + day in the frontmatter**

In `src/pages/index.astro`, find the existing computed values block. After `const todayISO = today.toISOString().slice(0, 10);`, add:

```ts
// "Today" banner — visible only when today falls inside trip dates.
const inTrip = todayISO >= trip.startDate && todayISO <= trip.endDate;
const todayDay = inTrip ? days.find((d) => d.data.date === todayISO) : undefined;
const todayDayIndex = todayDay ? days.findIndex((d) => d.data.date === todayDay.data.date) : -1;
const todayFirstHike = todayDay && todayDay.data.hikeSlugs.length > 0
  ? hikes.find((h) => h.slug === todayDay.data.hikeSlugs[0])
  : undefined;
const todayHref = todayDay
  ? (todayFirstHike ? `/hike/${todayFirstHike.slug}` : `/day/${todayDay.data.date}`)
  : '';
```

- [ ] **Step 2: Render the banner above the countdown**

In the `<BaseLayout>` body, find the COUNTDOWN section (`<section class="stagger" style="padding: 28px var(--page-x) 12px; text-align: center; position: relative;">`).

Insert this block immediately BEFORE the countdown section:

```astro
  {/* TODAY BANNER — only during trip dates */}
  {inTrip && todayDay && (
    <section class="stagger" style="padding: 12px var(--page-x) 0;">
      <a
        href={todayHref}
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

The banner uses `--moss` (success-green from the palette) as the accent so it reads distinctly from the gold-accented hikes — a one-of-a-kind state for "right now, this is what's happening."

- [ ] **Step 3: Build + verify (today is 2026-05-01, banner should be ABSENT)**

```bash
pnpm build && grep -c "Today · Day" dist/index.html
```
Expected: 0. (We're outside trip dates Jul 15–20.)

- [ ] **Step 4: Add e2e test asserting absence outside trip dates**

In `tests/e2e/smoke.spec.ts`, append:

```ts
test('today banner is absent outside trip dates (May 2026)', async ({ page }) => {
  await page.goto('/');
  // Today banner should not render today (May 2026, before Jul 15 trip start)
  await expect(page.getByText(/Today · Day/)).toHaveCount(0);
});
```

(We can't easily test the in-trip state without faking the system clock. Document the conditional behaviour and rely on manual QA closer to the trip.)

- [ ] **Step 5: Run e2e**

```bash
pnpm test:e2e
```
Expected: 11/11 pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro tests/e2e/smoke.spec.ts
git commit -m "$(cat <<'EOF'
feat(home): "Today" banner during trip dates only

Renders above the countdown when today is in [trip.startDate,
trip.endDate]. Tap → first hike of the day, or day-overview if no
hikes that day. Uses --moss accent (success green) to distinguish
from gold-accented planning content.

Outside trip dates: banner is fully absent (no DOM, no whitespace).
E2E asserts absence today (May 2026, pre-trip).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Add `relatedHikeSlug` to BookingSchema; populate via migration

**Files:**
- Modify: `src/content/config.ts`
- Modify: `scripts/migrate-itinerary.mjs`
- Modify: `tests/unit/schemas.test.ts`
- Modify: `src/content/bookings.yaml` (regenerated by migration)

- [ ] **Step 1: Write the failing schema test**

In `tests/unit/schemas.test.ts`, append after the existing `describe('content schemas', () => {...})`:

```ts
describe('BookingSchema relatedHikeSlug', () => {
  it('accepts a booking with a relatedHikeSlug', () => {
    const b = {
      id: 'b-7',
      label: 'Tre Cime parking',
      category: 'parking',
      status: 'pending-window',
      relatedHikeSlug: 'tre-cime',
    };
    expect(BookingSchema.parse(b)).toEqual(b);
  });

  it('makes relatedHikeSlug optional', () => {
    const b = { id: 'b-1', label: 'Flight', category: 'flight', status: 'booked' };
    expect(() => BookingSchema.parse(b)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/unit/schemas.test.ts
```
Expected: FAIL — "Unrecognized key(s) in object: 'relatedHikeSlug'".

- [ ] **Step 3: Update BookingSchema**

In `src/content/config.ts`, find:

```ts
export const BookingSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(['flight', 'car', 'lodging', 'parking', 'cable-car', 'restaurant', 'other']),
  status: z.enum(['booked', 'pending-window', 'not-needed']),
  bookingOpens: ISODate.optional(),
  bookingUrl: z.string().url().optional(),
  costEur: z.number().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});
```

Replace with:

```ts
export const BookingSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(['flight', 'car', 'lodging', 'parking', 'cable-car', 'restaurant', 'other']),
  status: z.enum(['booked', 'pending-window', 'not-needed']),
  bookingOpens: ISODate.optional(),
  bookingUrl: z.string().url().optional(),
  costEur: z.number().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
  relatedHikeSlug: z.string().optional(),
});
```

- [ ] **Step 4: Run schema tests**

```bash
pnpm test tests/unit/schemas.test.ts
```
Expected: all pass (was 3, now 5).

- [ ] **Step 5: Update migration to populate relatedHikeSlug**

In `scripts/migrate-itinerary.mjs`, find the `parseBookings` function. The function currently creates bookings without `relatedHikeSlug`. Add a heuristic mapping based on the booking label.

After the line `if (!label || label.startsWith('---') || label.toLowerCase() === 'item') continue;` (inside `parseBookings`), and before the `items.push({...})` call, add:

```js
    const slug = inferRelatedHike(label);
```

Then update the `items.push` to include the field:

```js
    items.push({
      id: `b-${id++}`,
      label: label.replace(/\*\*/g, ''),
      category: inferCategory(label),
      status: status.includes('✅') ? 'booked' : status.includes('❌') ? 'not-needed' : 'pending-window',
      notes: status.replace(/[✅⏳❌]/g, '').trim() || undefined,
      relatedHikeSlug: slug,
    });
```

Add the `inferRelatedHike` helper near the bottom of the file (before `// --- Main ---`):

```js
function inferRelatedHike(label) {
  const l = label.toLowerCase();
  if (l.includes('tre cime')) return 'tre-cime';
  if (l.includes('cadini')) return 'cadini';
  if (l.includes('seceda')) return 'seceda-firenze';
  if (l.includes('lago di braies') || l.includes('braies')) return 'lago-di-braies';
  if (l.includes('sorapis')) return 'sorapis';
  if (l.includes('alpe di siusi') || l.includes('mont sëuc') || l.includes('siusi')) return 'alpe-di-siusi-family';
  return undefined;
}
```

- [ ] **Step 6: Re-run migration**

```bash
pnpm migrate
```
Expected: console output unchanged ("Parsed 6 days, 6 hikes, 11 bookings.").

- [ ] **Step 7: Verify the YAML**

```bash
grep -A1 "Tre Cime parking" src/content/bookings.yaml
```
Expected: includes `relatedHikeSlug: tre-cime` somewhere in the entry.

- [ ] **Step 8: Run full test suite + check**

```bash
pnpm test && pnpm check
```
Expected: 22/22 unit pass, 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/content/config.ts scripts/migrate-itinerary.mjs src/content/bookings.yaml tests/unit/schemas.test.ts
git commit -m "$(cat <<'EOF'
feat(checklist): add optional relatedHikeSlug to BookingSchema

Lets parking + cable-car booking items deep-link to the relevant
hike page. Migration script populates the field via a heuristic
on booking labels (covers all 11 current items).

Tests: 2 new unit tests for the schema (accept slug, optional).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: BookingChecklist — collapsible confirmation, deep-link, hide URL

**Files:**
- Modify: `src/components/BookingChecklist.tsx`

- [ ] **Step 1: Update Booking type and component**

In `src/components/BookingChecklist.tsx`, find:

```tsx
type Booking = {
  id: string;
  label: string;
  category: string;
  status: string;
  bookingOpens?: string;
  bookingUrl?: string;
  costEur?: number;
  confirmationNumber?: string;
  notes?: string;
};
```

Add `relatedHikeSlug?: string`:

```tsx
type Booking = {
  id: string;
  label: string;
  category: string;
  status: string;
  bookingOpens?: string;
  bookingUrl?: string;
  costEur?: number;
  confirmationNumber?: string;
  notes?: string;
  relatedHikeSlug?: string;
};
```

- [ ] **Step 2: Add per-row "expanded" state and update UI**

Find the function body. Replace the entire `BookingChecklist` function with:

```tsx
import { useLocalState } from '@/stores/localState';
import { useState } from 'react';

type Booking = {
  id: string;
  label: string;
  category: string;
  status: string;
  bookingOpens?: string;
  bookingUrl?: string;
  costEur?: number;
  confirmationNumber?: string;
  notes?: string;
  relatedHikeSlug?: string;
};

const categoryOrder = ['flight', 'car', 'lodging', 'parking', 'cable-car', 'restaurant', 'other'];
const categoryLabel: Record<string, string> = {
  flight: 'Flights',
  car: 'Car Rental',
  lodging: 'Lodging',
  parking: 'Parking Permits',
  'cable-car': 'Cable Cars',
  restaurant: 'Restaurants',
  other: 'Other',
};

export default function BookingChecklist({ bookings }: { bookings: Booking[] }) {
  const local = useLocalState((s) => s.bookings);
  const setBooking = useLocalState((s) => s.setBooking);
  const [expandedConfId, setExpandedConfId] = useState<string | null>(null);

  const isChecked = (b: Booking) => {
    const ls = local[b.id];
    if (ls) return ls.checked;
    return b.status === 'booked';
  };

  const opensSoon = (b: Booking) => {
    if (!b.bookingOpens || isChecked(b)) return false;
    const days = (new Date(b.bookingOpens).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 14;
  };

  const groups = categoryOrder
    .map((cat) => ({ cat, items: bookings.filter((b) => b.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {groups.map((g) => (
        <section key={g.cat}>
          <h2 className="eyebrow" style={{ margin: '0 0 10px' }}>{categoryLabel[g.cat] ?? g.cat}</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {g.items.map((b) => {
              const checked = isChecked(b);
              const conf = local[b.id]?.confirmation ?? b.confirmationNumber ?? '';
              const soon = opensSoon(b);
              const expanded = expandedConfId === b.id;
              return (
                <li
                  key={b.id}
                  style={{
                    background: 'var(--bg-paper)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--r-md)',
                    padding: '12px 14px',
                    boxShadow: 'var(--shadow-paper-sm)',
                    position: 'relative',
                    opacity: checked ? 0.78 : 1,
                  }}
                >
                  <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                    {/* Custom square checkbox */}
                    <span
                      style={{
                        position: 'relative',
                        flex: '0 0 22px',
                        width: 22,
                        height: 22,
                        marginTop: 2,
                        border: `1.5px solid ${checked ? 'var(--gold)' : 'var(--ink-soft)'}`,
                        borderRadius: 3,
                        background: checked ? 'var(--gold)' : 'transparent',
                        transition: 'background 160ms ease, border-color 160ms ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setBooking(b.id, {
                            checked: e.target.checked,
                            confirmation: conf,
                            bookedAt: new Date().toISOString(),
                          })
                        }
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0,
                          margin: 0,
                          padding: 0,
                          cursor: 'pointer',
                        }}
                        aria-label={b.label}
                      />
                      {checked && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          style={{ position: 'absolute', top: 2, left: 2 }}
                        >
                          <path
                            d="M5 12 L10 17 L19 7"
                            stroke="var(--bg)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      )}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14.5,
                          fontWeight: checked ? 400 : 700,
                          color: 'var(--ink)',
                          textDecoration: checked ? 'line-through' : 'none',
                          textDecorationColor: 'var(--ink-soft)',
                          lineHeight: 1.35,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        {soon && (
                          <span
                            aria-label="opens soon"
                            style={{
                              flex: '0 0 8px',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'var(--signal)',
                              animation: 'pulse-dot 1.6s ease-in-out infinite',
                              display: 'inline-block',
                            }}
                          />
                        )}
                        <span>{b.label}</span>
                      </div>
                      {b.bookingOpens && !checked && (
                        <div
                          className="mono-cap"
                          style={{ fontSize: 11, color: soon ? 'var(--signal)' : 'var(--ink-soft)', marginTop: 4 }}
                        >
                          Opens {b.bookingOpens}
                        </div>
                      )}
                      {b.bookingUrl && !checked && (
                        <a
                          href={b.bookingUrl}
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--ink-soft)',
                            display: 'inline-block',
                            marginTop: 4,
                            borderBottom: '1px dashed var(--gold)',
                            paddingBottom: 1,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {b.bookingUrl.replace(/^https?:\/\//, '').slice(0, 38)}
                        </a>
                      )}
                      {b.relatedHikeSlug && (
                        <a
                          href={`/hike/${b.relatedHikeSlug}`}
                          className="mono-cap"
                          style={{
                            fontSize: 10.5,
                            color: 'var(--ink-soft)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 6,
                            marginLeft: b.bookingUrl && !checked ? 12 : 0,
                            borderBottom: '1px dashed var(--gold)',
                            paddingBottom: 1,
                          }}
                        >
                          View Hike
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M9 6 L15 12 L9 18" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      )}
                      {/* Collapsible confirmation field */}
                      {!expanded && !conf && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setExpandedConfId(b.id); }}
                          aria-label={`Add confirmation number for ${b.label}`}
                          className="mono-cap"
                          style={{
                            fontSize: 10.5,
                            color: 'var(--ink-soft)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 8,
                            padding: '8px 0',
                            minHeight: 32,
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          + Add Confirmation #
                        </button>
                      )}
                      {(expanded || conf) && (
                        <input
                          type="text"
                          placeholder="Confirmation #"
                          value={conf}
                          onChange={(e) =>
                            setBooking(b.id, {
                              checked,
                              confirmation: e.target.value,
                              bookedAt: local[b.id]?.bookedAt,
                            })
                          }
                          aria-label={`Confirmation number for ${b.label}`}
                          className="mono"
                          style={{
                            marginTop: 10,
                            width: '100%',
                            fontSize: 11,
                            letterSpacing: '0.04em',
                            color: 'var(--ink)',
                            background: 'var(--bg)',
                            border: '1px solid var(--hairline)',
                            borderRadius: 'var(--r-sm)',
                            padding: '8px 10px',
                            minHeight: 38,
                            boxSizing: 'border-box',
                          }}
                        />
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

The key changes:
- Add `useState` for `expandedConfId` so only one row's confirmation field is expanded at a time (state per-row could leak too many open fields).
- Render confirmation # input only when `expanded` or `conf` (i.e., a confirmation is already entered).
- Otherwise, show a small `+ Add Confirmation #` button.
- Hide the booking URL once `checked` (per spec §8).
- Add a "View Hike →" deep link when `relatedHikeSlug` is present.
- Use `--ink-soft` instead of `--gold` for booking URL text.
- Section header is now `<h2 class="eyebrow">` for hierarchy (Phase A leftover; keep here for consistency).

- [ ] **Step 3: Build + verify**

```bash
pnpm build && grep -c "Add Confirmation" dist/checklist/index.html
```
Expected: matches the number of bookings without a pre-entered confirmation # (most of them).

- [ ] **Step 4: Update existing e2e checklist test**

In `tests/e2e/smoke.spec.ts`, find the `'checklist persists state'` test. Confirm it still passes — the underlying behaviour (checkbox toggle persists) is unchanged. The selector `input[type="checkbox"]` still works. If the test's first checkbox now has accidental sibling re-selectors after the UI changes, adjust accordingly.

Run e2e:

```bash
pnpm test:e2e
```
Expected: 11/11 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/BookingChecklist.tsx
git commit -m "$(cat <<'EOF'
feat(checklist): collapsible conf #, deep-link, hide URL when checked

Per spec §8:
- Confirmation # input collapsed by default; "+ Add Confirmation #"
  button reveals it (lowers visual noise on screens with many items).
- Once an item is checked, the booking URL hides — you don't need to
  re-book.
- "View Hike →" deep link appears whenever relatedHikeSlug is set
  (currently: parking + cable-car bookings).
- Section header now renders as h2 (heading hierarchy fix from
  Phase A applied to this island too).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Customize page — empty-state hint + sticky share button

**Files:**
- Modify: `src/components/customize/CustomizePanel.tsx`
- Modify: `src/pages/customize.astro`

- [ ] **Step 1: Add empty-state hint to CustomizePanel.tsx**

In `src/components/customize/CustomizePanel.tsx`, find the start of the function body. After the `state` / `days` / `hikes` declarations and the existing `useState` calls, add:

```tsx
  const hasNoEdits =
    Object.keys(state.hikeEdits).length === 0 &&
    Object.keys(state.dayEdits).length === 0 &&
    Object.keys(state.customHikes).length === 0 &&
    Object.keys(state.customDays).length === 0;
```

Then, just before the first `<section>` of the returned JSX (the "Hikes" section), insert:

```tsx
      {hasNoEdits && (
        <div style={{
          background: 'var(--bg-paper)',
          border: '1px dashed var(--gold)',
          borderRadius: 'var(--r-md)',
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <div className="mono-cap" style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6 }}>
            How To Customize
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
            Drag a hike between days to rearrange. Tap any hike or day to edit details. Add new hikes or days with the <strong style={{ color: 'var(--gold)' }}>+ New</strong> buttons.
          </div>
        </div>
      )}
```

- [ ] **Step 2: Promote share button to a sticky bottom bar in customize.astro**

In `src/pages/customize.astro`, find the existing share-button section:

```astro
  <section class="stagger" style="padding: 18px var(--page-x) 28px;">
    <ShareLinkButton client:load />
  </section>
```

Replace with a sticky bottom-anchored bar:

```astro
  {/* Sticky share bar — always visible while you're on /customize */}
  <div
    style="
      position: sticky;
      bottom: calc(64px + env(safe-area-inset-bottom));
      z-index: 15;
      padding: 12px var(--page-x);
      background: color-mix(in srgb, var(--bg) 92%, transparent);
      backdrop-filter: blur(12px) saturate(140%);
      -webkit-backdrop-filter: blur(12px) saturate(140%);
      border-top: 1px solid var(--hairline);
      margin-top: 32px;
    "
  >
    <ShareLinkButton client:load />
  </div>
```

The `bottom: calc(64px + env(safe-area-inset-bottom))` keeps the share bar above the bottom nav (which is 64px tall + safe-area).

- [ ] **Step 3: Build + verify share bar present**

```bash
pnpm build && grep -c "ShareLink" dist/customize/index.html
```
Expected: ≥1.

- [ ] **Step 4: Run tests + e2e**

```bash
pnpm test && pnpm test:e2e
```
Expected: still 22/22 + 11/11.

- [ ] **Step 5: Commit**

```bash
git add src/components/customize/CustomizePanel.tsx src/pages/customize.astro
git commit -m "$(cat <<'EOF'
feat(customize): empty-state hint + sticky share bar

- When the user has no edits, a paper-bordered "How To Customize"
  card appears at the top of /customize explaining drag-rearrange,
  tap-to-edit, and the + New buttons.
- The "Share my plan" button moves from the bottom of the page to a
  sticky bar pinned just above the bottom nav, so it stays reachable
  while scrolling through edits.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

# Phase C — Polish (Tasks 19–22)

### Task 19: Astro View Transitions (ClientRouter)

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/components/BottomNav.astro`

- [ ] **Step 1: Add ClientRouter to BaseLayout `<head>`**

In `src/layouts/BaseLayout.astro`, update the imports:

```astro
import '@/styles/global.css';
import { ClientRouter } from 'astro:transitions';
import Header from '@/components/Header.astro';
```

In the `<head>` block, add `<ClientRouter />` as the last element before `</head>`:

```astro
    <link
      rel="preload"
      as="style"
      href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..900;1,9..144,500..900&display=swap"
      onload="this.onload=null;this.rel='stylesheet'"
    />
    <ClientRouter />
  </head>
```

- [ ] **Step 2: Persist Header across transitions**

In `src/components/Header.astro`, find the outermost `<header class="sticky top-0 z-30">` element. Add `transition:persist="header"`:

```astro
<header class="sticky top-0 z-30" transition:persist="header">
```

- [ ] **Step 3: Persist BottomNav across transitions**

In `src/components/BottomNav.astro`, find the outermost `<nav aria-label="Primary" ...>` element. Add `transition:persist="bottom-nav"`:

```astro
<nav
  aria-label="Primary"
  transition:persist="bottom-nav"
  class="fixed left-0 right-0 z-30"
  ...
```

- [ ] **Step 4: Build + manual test**

```bash
pnpm build && pnpm preview
```

Open `http://localhost:4321` in a browser. Tap a hike card. Expected: the page crossfades into the hike page; header and bottom nav stay rendered (don't blink). Press the browser back button. Expected: crossfade back.

Stop preview server.

- [ ] **Step 5: Run tests + e2e**

```bash
pnpm test && pnpm test:e2e
```
Expected: still 22/22 + 11/11.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/Header.astro src/components/BottomNav.astro
git commit -m "$(cat <<'EOF'
feat(polish): Astro view transitions for cross-page crossfade

ClientRouter in BaseLayout <head>; Header and BottomNav marked
transition:persist so they don't flash on navigation. ~2 KB JS
added; honours prefers-reduced-motion automatically.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: PWA manifest + icons

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-mask-512.png`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Create the manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "Dolomites Trip · Jul 2026",
  "short_name": "Dolomites",
  "description": "Trip planning for the Dolomites, July 15–20, 2026.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F1E9D2",
  "theme_color": "#F1E9D2",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-mask-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Generate icons with sharp**

Add `sharp` as a dev dependency:

```bash
pnpm add -D sharp
```

Create `scripts/generate-icons.mjs`:

```js
#!/usr/bin/env node
/**
 * One-time icon generation: produces 192/512 standard + 512 maskable PNGs
 * from a hand-coded SVG that matches the site's vintage palette.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

// Standard icon (full-bleed) — mountain glyph centred on warm bone
const standardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#F1E9D2"/>
  <path d="M50 380 L165 180 L240 285 L290 215 L460 380 Z" fill="none" stroke="#0E3B43" stroke-width="14" stroke-linejoin="round"/>
  <circle cx="165" cy="180" r="12" fill="#D4A24C"/>
</svg>`;

// Maskable icon (with safe-zone padding) — same glyph but inset
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#F1E9D2"/>
  <g transform="translate(64 64) scale(0.75)">
    <path d="M50 380 L165 180 L240 285 L290 215 L460 380 Z" fill="none" stroke="#0E3B43" stroke-width="14" stroke-linejoin="round"/>
    <circle cx="165" cy="180" r="12" fill="#D4A24C"/>
  </g>
</svg>`;

await sharp(Buffer.from(standardSvg)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
await sharp(Buffer.from(standardSvg)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(path.join(out, 'icon-mask-512.png'));

console.log('Icons generated:', fs.readdirSync(out));
```

- [ ] **Step 3: Run the icon generator**

```bash
node scripts/generate-icons.mjs
```
Expected: prints `Icons generated: ['icon-192.png', 'icon-512.png', 'icon-mask-512.png']`.

- [ ] **Step 4: Add manifest link tag to BaseLayout**

In `src/layouts/BaseLayout.astro`, in `<head>`, add (before `<ClientRouter />`):

```astro
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

- [ ] **Step 5: Build + verify manifest is in dist**

```bash
pnpm build && ls dist/manifest.webmanifest dist/icons/
```
Expected: manifest exists; icons folder lists all 3 PNGs.

- [ ] **Step 6: Commit**

```bash
git add public/manifest.webmanifest public/icons/ scripts/generate-icons.mjs package.json pnpm-lock.yaml src/layouts/BaseLayout.astro
git commit -m "$(cat <<'EOF'
feat(pwa): manifest + icons for "Add to Home Screen"

- public/manifest.webmanifest with name, theme color, icons.
- 192/512 standard icons + 512 maskable icon, generated via
  scripts/generate-icons.mjs (sharp). Glyph: mountain with gold
  summit dot on warm-bone — matches the site's wordmark.
- BaseLayout adds <link rel="manifest"> and apple-touch-icon.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: Service worker — cache key bump + new asset list

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Bump cache key and refresh pre-cache list**

Replace the contents of `public/sw.js` with:

```js
const CACHE = 'dolomites-v2';
const ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-mask-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        const network = fetch(e.request)
          .then((resp) => { if (resp.ok) cache.put(e.request, resp.clone()); return resp; })
          .catch(() => cached);
        return cached ?? network;
      })
    );
    return;
  }
  if (url.host === 'tile.openstreetmap.org') {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const resp = await fetch(e.request);
        if (resp.ok) cache.put(e.request, resp.clone());
        return resp;
      })
    );
  }
});
```

The diff vs the existing file: cache key `dolomites-v1` → `dolomites-v2`; pre-cache list adds the manifest and 3 icons.

- [ ] **Step 2: Build**

```bash
pnpm build && cat dist/sw.js | head -10
```
Expected: shows `const CACHE = 'dolomites-v2';` at the top of the cached SW.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "$(cat <<'EOF'
chore(sw): bump cache key v1→v2 + add manifest/icons to pre-cache

Forces existing devices to drop the old cache; pre-caches the new
manifest and the 3 PWA icons so the install prompt has assets ready
even on first visit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: Lighthouse audit + final reduced-motion sweep

This task is mostly verification, not new code.

- [ ] **Step 1: Push everything to deploy**

```bash
git push origin main
```

Wait for Cloudflare to finish the build (~2 min). Confirm at `https://italy-trip.github-mud285.workers.dev/`.

- [ ] **Step 2: Run Lighthouse mobile audit on the deployed site**

In Chrome DevTools → Lighthouse tab:
- URL: `https://italy-trip.github-mud285.workers.dev/`
- Mode: Navigation
- Device: Mobile
- Categories: Performance, Accessibility, Best Practices, SEO

Run the audit. Capture the scores in a comment-only commit so they're recorded:

```bash
cat > /tmp/lighthouse-2026-05-01.txt <<EOF
Lighthouse mobile audit — 2026-05-01
URL: https://italy-trip.github-mud285.workers.dev/
- Performance:    [score]
- Accessibility:  [score]
- Best Practices: [score]
- SEO:            [score]
EOF
```

Targets per spec §8:
- Performance ≥ 95
- Accessibility = 100
- Best Practices = 100
- SEO ≥ 95

If any metric falls short:
- Identify the failing audits (DevTools shows them)
- Fix specific violations (e.g., add `width`/`height` to images, preload an LCP asset, add a `description` meta tag)
- Each fix gets its own commit

- [ ] **Step 3: Repeat Lighthouse on /day/2026-07-16 and /hike/tre-cime**

Run the audit on both:
- `https://italy-trip.github-mud285.workers.dev/day/2026-07-16/`
- `https://italy-trip.github-mud285.workers.dev/hike/tre-cime/`

Confirm same targets.

- [ ] **Step 4: Reduced-motion sweep**

Open Chrome DevTools → Rendering panel. Enable "prefers-reduced-motion: reduce". Reload home, day, hike, customize. Verify nothing animates:
- No countdown count-up (static target value visible)
- No ring fill (static target value visible)
- No stat-num pop-in
- No eyebrow rule draw
- No stamp wobble
- No today-banner motion (if any)
- No view transitions (Astro respects `prefers-reduced-motion` automatically)

If any motion still runs, find the offending CSS class and add a `@media (prefers-reduced-motion: reduce)` override in `src/styles/global.css`.

- [ ] **Step 5: Manual screen-reader walkthrough (optional but recommended)**

Use macOS VoiceOver (Cmd+F5):
- Navigate to home with VO+→ through all elements
- Confirm the skip link is the first announcement
- Confirm h1, h2, h3 chain reads naturally
- Confirm icons do not shout aria text where they're hidden
- Confirm interactive elements announce a clear name + role

Fix any oddities discovered.

- [ ] **Step 6: Commit a record of the Lighthouse pass**

If no fixes were needed:

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(audit): Lighthouse mobile pass — record scores

Targets: Performance ≥ 95, Accessibility = 100, Best Practices = 100,
SEO ≥ 95.

Audit run on https://italy-trip.github-mud285.workers.dev/ on 2026-05-01.
Scores recorded in /tmp/lighthouse-2026-05-01.txt (not committed).

All targets met. Reduced-motion verified across home/day/hike.
Heading hierarchy clean. Skip link working. View Transitions
honour prefers-reduced-motion.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If fixes were needed, each fix has its own commit ahead of this one.

- [ ] **Step 7: Push final**

```bash
git push origin main
```

---

# Self-review

(Author of this plan checked the spec section-by-section.)

**Spec coverage:**
- §1 purpose / §2 scope — addressed by overall structure (Phase A/B/C ordering matches spec)
- §3 decisions — every decision flows into a specific task (4-item nav → Task 8; gear icon → Task 9; gold non-text → Tasks 1+6; schedule canonical on hike page → Tasks 11; today banner → Task 15)
- §4 IA — Tasks 8, 9, 10, 11 (and Task 13 wires day pills which are part of the new IA)
- §5 navigation logic — Tasks 12, 13, 14, 15, 16, 17 (and Task 18 for customize polish)
- §6 accessibility — Tasks 1, 2, 3, 4, 5, 6, 7
- §7 readability — Tasks 1, 6 (mono-cap floor + .accent opt-in)
- §8 polish — Tasks 19, 20, 21, 22 (and Task 17, 18 for checklist + customize UX)
- §9 phasing matches Phase A (1-7), Phase B (8-18), Phase C (19-22)
- §10 definition of done — verified by Task 22 Lighthouse audit + e2e suite

**Type / name consistency:**
- `BookingSchema.relatedHikeSlug` defined in Task 16 step 3, used in Task 17 step 2.
- `DayPillScroller` component name created in Task 12, imported in Task 13.
- `activeDayDate` prop name on BaseLayout — Task 13 step 1 (definition), Task 13 step 2 + 3 (consumers). Consistent.
- `allHikesInTripOrder` array shape in Task 14 step 2 used in Task 14 step 3.
- `transition:persist="header"` and `transition:persist="bottom-nav"` — Task 19.

**Placeholder scan:**
- No "TBD"/"TODO" in any task body.
- Every code step contains real, runnable code.
- One known acceptable gap: Task 22 Lighthouse step 6 says "If fixes were needed, each fix has its own commit ahead of this one" — this is intentional because the fixes depend on what the audit surfaces.

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-frontend-audit-and-refactor.md`.**
