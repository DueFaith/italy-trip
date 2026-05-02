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
  await expect(page.getByRole('heading', { name: /The Dolomites/i })).toBeVisible();
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
