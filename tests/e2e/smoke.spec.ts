import { test, expect } from '@playwright/test';
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const bookings = yaml.load(fs.readFileSync(path.join(ROOT, 'src/content/bookings.yaml'), 'utf8')) as Array<unknown>;
const activities = fs.readdirSync(path.join(ROOT, 'src/content/activities')).filter((f) => f.endsWith('.yaml'));

test('home page renders core elements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Italia '26/i })).toBeVisible();
  await expect(page.getByText('Days Until Departure')).toBeVisible();
  await expect(page.getByText(/Booked/)).toBeVisible();
});

test('day page renders schedule, hikes, and driving', async ({ page }) => {
  await page.goto('/day/2026-07-17');
  await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible();
  // At least one HH:MM row in the schedule list
  await expect(page.locator('main ol li').filter({ hasText: /\d\d:\d\d/ }).first()).toBeVisible();
  // Hikes section still renders (uses an "eyebrow" h2 — match by role/heading + text)
  await expect(page.getByRole('main').getByRole('heading', { name: /^Hikes?$/ }).first()).toBeVisible();
});

test('hike page renders stats', async ({ page }) => {
  await page.goto('/hike/tre-cime');
  await expect(page.getByText('Trailhead', { exact: true })).toBeVisible();
  await expect(page.getByText('km', { exact: true }).first()).toBeVisible();
});

test('map page mounts', async ({ page }) => {
  await page.goto('/map');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 5000 });
});

test('checklist renders one row per booking', async ({ page }) => {
  await page.goto('/checklist');
  await expect(page.getByRole('heading', { name: 'Flights' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lodging' })).toBeVisible();
  await expect(page.locator('main input[type="checkbox"]')).toHaveCount(bookings.length);
});

test('customize page renders', async ({ page }) => {
  await page.goto('/customize');
  await expect(page.getByRole('heading', { name: /Customize/i })).toBeVisible();
});

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

test('hike page prev/next walks trip order across day boundaries', async ({ page }) => {
  // From Lago di Braies (Day 4, hike #3 in trip order):
  // prev should be Sorapis (Day 3), next should be Cadini (Day 4 same day)
  await page.goto('/hike/lago-di-braies');
  await expect(page.getByText('Lake Sorapis via Passo Tre Croci', { exact: false })).toBeVisible();
  await expect(page.getByText('Cadini di Misurina viewpoint', { exact: false }).first()).toBeVisible();
});

test('today banner is absent outside trip dates (May 2026)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-05-02T10:00:00Z') });
  await page.goto('/');
  await expect(page.getByText(/Today · Day/)).toHaveCount(0);
});

test.describe('navigation / render', () => {
  test('/activities renders cards, featured, and filter pills', async ({ page }) => {
    await page.goto('/activities');
    // Featured cards
    const featured = page.locator('[data-featured-section] .hike-poster');
    await expect(featured).toHaveCount(4);
    // Catalog cards (only non-featured shown by default; featured are hidden inline)
    const allCards = page.locator('[data-activity-card]');
    await expect(allCards).toHaveCount(activities.length);
    // 1 'All' + 9 categories
    const pills = page.locator('.activity-pill');
    await expect(pills).toHaveCount(10);
  });

  test('clicking the Water Sports pill filters the grid and updates the URL', async ({ page }) => {
    await page.goto('/activities');
    await page.locator('.activity-pill[data-category="water-sports"]').click();
    await expect(page).toHaveURL(/\?category=water-sports/);
    await expect(page.locator('#grid-heading')).toHaveText('All matching');
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
    await expect(page.locator('a').filter({ hasText: /Back to catalog/ })).toBeVisible();
  });

  test('/lodgings/baita-fraina renders ribbon, address, and contact buttons', async ({ page }) => {
    await page.goto('/lodgings/baita-fraina');
    await expect(page.locator('.map-ribbon')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Address' })).toBeVisible();
    await expect(page.locator('a[href^="https://maps.apple.com"]')).toHaveCount(1);
    await expect(page.locator('a[href^="https://www.google.com/maps"]')).toHaveCount(1);
  });

  test('/lodgings lists 3 lodgings in chronological order', async ({ page }) => {
    await page.goto('/lodgings');
    const cards = page.locator('main a[href^="/lodgings/"]');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText(/Baita Fraina/);
    await expect(cards.nth(1)).toContainText(/Kircher Sepp/);
    await expect(cards.nth(2)).toContainText(/Salò/);
  });

  test('day pill scroller has a Phase I/II divider', async ({ page }) => {
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

  test('header wordmark is the trip brand on every page', async ({ page }) => {
    const expected = "ITALIA '26";
    for (const path of ['/', '/day/2026-07-22', '/lodgings/salo-airbnb', '/map']) {
      await page.goto(path);
      await expect(page.locator('header span.font-mono').first()).toHaveText(expected);
    }
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
    await expect(page.locator('a').filter({ hasText: /Browse all \d+ activities/ })).toBeVisible();
  });

  test('schedule renders on /day/2026-07-17 with at least 5 HH:MM rows', async ({ page }) => {
    await page.goto('/day/2026-07-17');
    const rows = page.locator('main ol li').filter({ hasText: /\d\d:\d\d/ });
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
  });
});

test.describe('customize / edit flow', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch {}
    });
  });

  test('/customize renders How To banner + 6 hikes + 13 days', async ({ page }) => {
    await page.goto('/customize');
    await expect(page.getByText('How To Customize')).toBeVisible();
    await expect(page.locator('main').locator('h2').filter({ hasText: 'Hikes' })).toBeVisible();
    const dayCards = page.locator('main a[href^="/day/"], main a[href^="/custom-day"]');
    await expect(dayCards).toHaveCount(13);
  });

  test('+ New Hike button reveals HikeForm and add submits', async ({ page }) => {
    await page.goto('/customize');
    await page.getByRole('button', { name: /Add new hike/i }).click();
    // Fill the first text input (HikeForm has a name field; default type=text has no attribute)
    await page.locator('form input:not([type])').first().fill('Test Hike From E2E');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('main').getByText('Test Hike From E2E')).toBeVisible();
  });

  test('+ New Day button reveals form and add submits', async ({ page }) => {
    await page.goto('/customize');
    await page.getByRole('button', { name: /Add new day/i }).click();
    await page.locator('input[type="date"]').fill('2026-08-01');
    // The theme input is the text field in the day form
    await page.locator('input[type="text"]').first().fill('E2E Test Day');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('main').getByText('E2E Test Day')).toBeVisible();
  });

  test('custom hikes have a Delete button; canonical hikes do not', async ({ page }) => {
    await page.goto('/customize');
    await page.getByRole('button', { name: /Add new hike/i }).click();
    await page.locator('form input:not([type])').first().fill('Custom Hike Delete Test');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('main').getByText('Custom Hike Delete Test')).toBeVisible();
    // Custom hike row has a Delete button
    await expect(page.getByRole('button', { name: /Delete Custom Hike Delete Test/ })).toBeVisible();
  });

  test('clicking Delete removes a custom hike', async ({ page }) => {
    await page.goto('/customize');
    await page.getByRole('button', { name: /Add new hike/i }).click();
    await page.locator('form input:not([type])').first().fill('Delete Me');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('main').getByText('Delete Me')).toBeVisible();
    await page.getByRole('button', { name: /Delete Delete Me/ }).click();
    await expect(page.locator('main').getByText('Delete Me')).toHaveCount(0);
  });

  test('CustomizedPill becomes visible after first edit', async ({ page }) => {
    await page.goto('/customize');
    // Pill is hidden initially (no edits yet)
    await expect(page.locator('header').filter({ hasText: /customized/i })).toHaveCount(0);
    await page.getByRole('button', { name: /Add new hike/i }).click();
    await page.locator('form input:not([type])').first().fill('Pill Trigger');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.locator('header').filter({ hasText: /customized/i })).toBeVisible();
  });

  test('drag-drop affordance: chips have cursor-grab + ⋮⋮ glyph', async ({ page }) => {
    await page.goto('/customize');
    const chips = page.locator('span[class*="cursor-grab"]');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(chips.nth(i)).toContainText('⋮⋮');
    }
  });

  test('share-link generates ?s= URL after edits', async ({ page }) => {
    test.skip(true, 'ShareLinkButton copies URL to clipboard (?plan=) without navigating, so page.url() is unchanged after click. Test as written cannot pass against current behavior.');
    await page.goto('/customize');
    await page.getByRole('button', { name: /Add new hike/i }).click();
    await page.locator('form input:not([type])').first().fill('Share Test');
    await page.getByRole('button', { name: 'Save' }).first().click();
    const shareBtn = page.getByRole('button', { name: /Share/i }).first();
    if (await shareBtn.count() === 0) {
      test.skip(true, 'ShareLinkButton not present — skip until rendered');
    }
    await shareBtn.click();
    expect(page.url()).toMatch(/\?s=/);
  });
});

test('Seceda hike page renders the Lift Access card with booking warning', async ({ page }) => {
  await page.goto('/hike/seceda-firenze');

  // The Lift Access heading is present.
  await expect(page.getByRole('heading', { name: 'Lift Access' })).toBeVisible();

  // The cable car name renders (as a link).
  await expect(page.getByRole('link', { name: /Ortisei.*Furnes.*Seceda cableway/i })).toBeVisible();

  // The booking pill is rendered with the warning text + window note.
  const pill = page.locator('text=Booking required').first();
  await expect(pill).toBeVisible();
  await expect(page.locator('text=opens 30d before')).toBeVisible();

  // The Reserve link points to seceda.it/en/tickets.
  const reserve = page.getByRole('link', { name: 'Reserve' }).first();
  await expect(reserve).toHaveAttribute('href', 'https://www.seceda.it/en/tickets');
});

test('clicking "Full map" on a hike page focuses that hike on /map', async ({ page }) => {
  await page.goto('/hike/tre-cime');
  await page.getByRole('link', { name: /open full map/i }).click();
  await page.waitForURL(/\/map\?focus=hike-tre-cime/);

  // Wait for MapLibre to hydrate.
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 10_000 });

  // When ?focus= is honored, MapView filters pins down to just the focused one.
  // MapLibre renders each pin as a .maplibregl-marker element — expect exactly 1.
  await expect(page.locator('.maplibregl-marker')).toHaveCount(1);
});

test('/customize mounts with at least one draggable day card and no errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/customize');
  await page.waitForLoadState('networkidle');

  // The drag affordance uses `cursor: grab` on a chip + a ⋮⋮ glyph (CustomizePanel.tsx).
  // We don't actually drag — we just confirm the component mounted with affordances.
  const dragHandles = page.locator('.cursor-grab');
  await expect(dragHandles.first()).toBeVisible();
  expect(await dragHandles.count(), 'at least one drag-grab affordance').toBeGreaterThan(0);

  expect(consoleErrors, `Console errors on /customize:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('ShareLinkButton writes a ?plan= URL to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/customize');
  await page.waitForLoadState('networkidle');

  const shareButton = page.getByRole('button', { name: 'Copy share link to clipboard' });
  await expect(shareButton).toBeVisible();
  await shareButton.click();

  // After click, button text flips to "Copied!" for 2s.
  await expect(shareButton).toHaveText('Copied!');

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText, 'clipboard should contain a share URL').toMatch(/\?plan=.+/);
});

test('Edit-hike modal opens, lets you change the name, and persists across reload', async ({ page }) => {
  await page.goto('/hike/tre-cime');
  await page.waitForLoadState('networkidle');

  const editButton = page.getByRole('button', { name: 'Edit hike details' });
  await expect(editButton).toBeVisible();
  await editButton.click();

  // Modal contains a HikeForm. The first text input is the Name field.
  const nameInput = page.locator('form input').first();
  await expect(nameInput).toBeVisible();
  const originalName = await nameInput.inputValue();
  const sentinel = `TEST-${Date.now()}`;

  await nameInput.fill(sentinel);
  await page.getByRole('button', { name: 'Save' }).click();

  // Modal closes; the heading reflects the new name.
  await expect(page.locator('h1')).toContainText(sentinel);

  // Reload and confirm persistence via localStorage (zustand persist).
  await page.reload();
  await expect(page.locator('h1')).toContainText(sentinel);

  // Cleanup — revert via the edit modal so we don't poison subsequent runs.
  await page.getByRole('button', { name: 'Edit hike details' }).click();
  const nameInputAfter = page.locator('form input').first();
  await nameInputAfter.fill(originalName);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('h1')).toContainText(originalName);
});
