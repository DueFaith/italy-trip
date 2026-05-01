import { test, expect } from '@playwright/test';

test('home page renders core elements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The Dolomites/i })).toBeVisible();
  await expect(page.getByText('Days to go')).toBeVisible();
  await expect(page.getByText('Booked')).toBeVisible();
});

test('day page renders hikes and driving (schedule lives on hike page now)', async ({ page }) => {
  await page.goto('/day/2026-07-16');
  await expect(page.getByRole('main').getByText(/Hike/i)).toBeVisible();
  // Schedule section was moved to the hike page in spec §4 — ensure it's NOT here
  await expect(page.locator('main').getByText('Wake, breakfast', { exact: false })).toHaveCount(0);
  // The "View Full Schedule" callout inside hike cards stays
  await expect(page.locator('main').getByText('View Full Schedule', { exact: true })).toBeVisible();
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

test('checklist persists state', async ({ page }) => {
  await page.goto('/checklist');
  // Wait for React hydration — the checkbox onChange is wired after client:load
  const firstCheckbox = page.locator('input[type="checkbox"]').first();
  await firstCheckbox.waitFor({ state: 'attached' });
  // Give Zustand/persist a moment to rehydrate from localStorage
  await page.waitForTimeout(300);
  const wasChecked = await firstCheckbox.isChecked();
  await firstCheckbox.click();
  // Wait for the localStorage write to complete before reloading
  await page.waitForTimeout(100);
  await page.reload();
  // Wait for re-hydration after reload
  await page.locator('input[type="checkbox"]').first().waitFor({ state: 'attached' });
  await page.waitForTimeout(300);
  const nowChecked = await page.locator('input[type="checkbox"]').first().isChecked();
  expect(nowChecked).toBe(!wasChecked);
});

test('customize page renders', async ({ page }) => {
  await page.goto('/customize');
  await expect(page.getByRole('heading', { name: /Customize/i })).toBeVisible();
});

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
