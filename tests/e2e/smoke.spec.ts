import { test, expect } from '@playwright/test';

test('home page renders core elements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /The Dolomites/i })).toBeVisible();
  await expect(page.getByText('Days to go')).toBeVisible();
  await expect(page.getByText('Booked')).toBeVisible();
});

test('day page renders schedule and weather', async ({ page }) => {
  await page.goto('/day/2026-07-16');
  await expect(page.getByText(/Schedule/i)).toBeVisible();
  await expect(page.getByRole('main').getByText('Hikes', { exact: true })).toBeVisible();
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
