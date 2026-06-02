import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');

/**
 * Walk dist/ and return every built route.
 * `/` for index.html, `/foo/` for foo/index.html, etc.
 */
function listBuiltRoutes(): string[] {
  const routes: string[] = [];
  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
      } else if (entry.name === 'index.html') {
        routes.push(prefix === '' ? '/' : `/${prefix}`);
      }
    }
  }
  walk(DIST, '');
  return routes.sort();
}

const ROUTES = listBuiltRoutes();

test.describe('Site-wide crawl', () => {
  for (const route of ROUTES) {
    test(`route ${route} loads cleanly`, async ({ page, baseURL }) => {
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        // Drop network-resource failures — C2 covers same-origin; cross-origin is out of our control.
        if (text.startsWith('Failed to load resource:')) return;
        consoleErrors.push(text);
      });

      page.on('response', (response) => {
        const url = response.url();
        // Only flag same-origin failures. Cross-origin (OSM tiles, etc) is out of our control.
        if (baseURL && !url.startsWith(baseURL)) return;
        if (response.status() >= 400) {
          failedRequests.push(`${response.status()} ${url}`);
        }
      });

      await page.goto(route);
      try {
        await page.waitForLoadState('networkidle', { timeout: 15_000 });
      } catch {
        // Tolerate networkidle timeout — lazy components (WeatherWidget) can hold connections.
      }

      // C1: no console.error
      expect(consoleErrors, `Console errors on ${route}:\n${consoleErrors.join('\n')}`).toEqual([]);

      // C2: no same-origin 4xx/5xx
      expect(failedRequests, `Failed same-origin requests on ${route}:\n${failedRequests.join('\n')}`).toEqual([]);

      // C3: every internal href points at a built route
      const hrefs = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => a.getAttribute('href') ?? '').filter((h) => h.startsWith('/') && !h.startsWith('//'))
      );
      const builtSet = new Set(ROUTES);
      const brokenInternal = hrefs.filter((h) => {
        const stripped = h.split('?')[0].split('#')[0];
        if (stripped === '') return false;
        const normalized = stripped.endsWith('/') ? stripped : `${stripped}/`;
        const root = stripped === '/' ? '/' : normalized;
        return !builtSet.has(root);
      });
      expect(brokenInternal, `Broken internal links on ${route}:\n${brokenInternal.join('\n')}`).toEqual([]);

      // C4: every img either renders or is explicitly decorative (alt="")
      const brokenImages = await page.$$eval('img', (imgs) =>
        imgs
          .filter((img) => img.naturalWidth === 0 && img.getAttribute('alt') !== '')
          .map((img) => img.getAttribute('src') ?? '<no src>')
      );
      expect(brokenImages, `Broken images on ${route}:\n${brokenImages.join('\n')}`).toEqual([]);

      // C5: external <a> have target=_blank and rel containing 'noopener'
      const externalIssues = await page.$$eval('a[href^="http"]', (anchors) =>
        anchors
          .filter((a) => {
            const href = a.getAttribute('href') ?? '';
            try {
              const u = new URL(href);
              if (u.host === location.host) return false;
              // Astro dev-toolbar links — only present in `astro dev`, never in production build.
              if (/(^|\.)astro\.build$/.test(u.host)) return false;
              if (u.host === 'github.com' && u.pathname.startsWith('/withastro')) return false;
            } catch {
              return false;
            }
            const target = a.getAttribute('target');
            const rel = a.getAttribute('rel') ?? '';
            return target !== '_blank' || !rel.includes('noopener');
          })
          .map((a) => a.getAttribute('href') ?? '')
      );
      expect(externalIssues, `External links missing target=_blank or rel=noopener on ${route}:\n${externalIssues.join('\n')}`).toEqual([]);

      // C6: exactly one <h1> (excluding Astro dev-toolbar h1s, only present in `astro dev`)
      const h1Count = await page.evaluate(() =>
        Array.from(document.querySelectorAll('h1')).filter((h) => !h.closest('astro-dev-toolbar')).length
      );
      expect(h1Count, `Wrong h1 count on ${route} (expected 1, got ${h1Count})`).toBe(1);
    });
  }
});
