import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { allPages, extractAnchors, extractAttr, extractByClass, parseFrontmatter } from './parse';
import { getWordmark } from '@/lib/wordmark';

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const ACTIVITIES_DIR = path.join(ROOT, 'src/content/activities');
const LODGINGS_DIR = path.join(ROOT, 'src/content/lodgings');
const HIKES_DIR = path.join(ROOT, 'src/content/hikes');
const DAYS_DIR = path.join(ROOT, 'src/content/days');

function listSlugs(dir: string, ext: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => f.replace(new RegExp(`${ext}$`), ''));
}

describe('§3.1 internal-link resolution', () => {
  it('every internal href resolves to a built file', () => {
    const broken: { source: string; target: string }[] = [];
    for (const { route, html } of allPages(DIST)) {
      for (const { href } of extractAnchors(html)) {
        if (!href.startsWith('/') || href.startsWith('//')) continue;
        const stripped = href.split('?')[0].split('#')[0];
        if (stripped === '') continue;
        const target =
          stripped === '/' ? path.join(DIST, 'index.html') : path.join(DIST, stripped, 'index.html');
        if (!fs.existsSync(target)) {
          broken.push({ source: route, target: stripped });
        }
      }
    }
    expect(broken, `Broken internal links: ${JSON.stringify(broken, null, 2)}`).toEqual([]);
  });
});

describe('§3.2 bottom-nav consistency', () => {
  const expectedHrefs = ['/', '/map', '/activities', '/more'];

  it('every page has the 4-item bottom nav with correct hrefs in order', () => {
    for (const { route, html } of allPages(DIST)) {
      // Find the <nav aria-label="Primary"> block then extract its anchor hrefs in order
      const navMatch = html.match(/<nav\b[^>]*\baria-label="Primary"[\s\S]*?<\/nav>/);
      expect(navMatch, `nav not found on ${route}`).not.toBeNull();
      const navHtml = navMatch![0];
      const navHrefs: string[] = [];
      const re = /<a\b[^>]*\bhref="([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(navHtml)) !== null) navHrefs.push(m[1]);
      expect(navHrefs, `nav hrefs on ${route}`).toEqual(expectedHrefs);
    }
  });

  it('at most one nav item has aria-current="page"', () => {
    for (const { route, html } of allPages(DIST)) {
      const navMatch = html.match(/<nav\b[^>]*\baria-label="Primary"[\s\S]*?<\/nav>/);
      if (!navMatch) continue;
      const navHtml = navMatch[0];
      const currentCount = (navHtml.match(/aria-current="page"/g) ?? []).length;
      expect(currentCount, `aria-current count on ${route}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('§3.3 header wordmark — property check', () => {
  it('the rendered wordmark matches getWordmark for every page', () => {
    const mismatches: { route: string; expected: string; actual: string }[] = [];
    for (const { route, html } of allPages(DIST)) {
      const ctx: Parameters<typeof getWordmark>[0] = { pathname: route };
      if (route.startsWith('/day/')) {
        const date = route.replace('/day/', '');
        const dayFile = fs.readdirSync(DAYS_DIR).find((f) => f.startsWith(date));
        if (dayFile) {
          const fm = parseFrontmatter(fs.readFileSync(path.join(DAYS_DIR, dayFile), 'utf8'));
          ctx.dayLodgingSlug = fm.lodgingSlug;
        }
      }
      if (route.startsWith('/lodgings/') && route !== '/lodgings') {
        ctx.lodgingId = route.replace('/lodgings/', '');
      }
      const expected = getWordmark(ctx).toUpperCase();
      // Header wordmark renders inside the logo <a aria-label="Home"> ... <span class="font-mono">WORDMARK</span></a>
      const wordmarkMatch = html.match(
        /<a[^>]*\baria-label="Home"[\s\S]*?<span\b[^>]*\bclass="font-mono"[^>]*>([^<]+)<\/span>/,
      );
      const actual = wordmarkMatch ? wordmarkMatch[1].trim() : '';
      if (actual !== expected) {
        mismatches.push({ route, expected, actual });
      }
    }
    expect(mismatches, `Wordmark mismatches: ${JSON.stringify(mismatches, null, 2)}`).toEqual([]);
  });
});

describe('§3.4 map-link format', () => {
  it('every Google Maps link uses ?api=1&query= with at least 3 letters', () => {
    const bad: { source: string; href: string }[] = [];
    for (const { route, html } of allPages(DIST)) {
      for (const { href } of extractAnchors(html)) {
        if (!href.startsWith('https://www.google.com/maps')) continue;
        const m = href.match(/[?&]query=([^&]+)/);
        const decoded = m ? decodeURIComponent(m[1]) : '';
        if (!m || !/[A-Za-z]{3,}/.test(decoded)) bad.push({ source: route, href });
      }
    }
    expect(bad, `Bad Google Maps links: ${JSON.stringify(bad, null, 2)}`).toEqual([]);
  });

  it('every Apple Maps link has a q= parameter with at least 3 letters', () => {
    const bad: { source: string; href: string }[] = [];
    for (const { route, html } of allPages(DIST)) {
      for (const { href } of extractAnchors(html)) {
        if (!href.startsWith('https://maps.apple.com')) continue;
        const m = href.match(/[?&]q=([^&]+)/);
        const decoded = m ? decodeURIComponent(m[1]) : '';
        if (!m || !/[A-Za-z]{3,}/.test(decoded)) bad.push({ source: route, href });
      }
    }
    expect(bad, `Bad Apple Maps links: ${JSON.stringify(bad, null, 2)}`).toEqual([]);
  });
});

describe('§3.6 day record consistency', () => {
  const lodgingSlugs = new Set(listSlugs(LODGINGS_DIR, '.yaml'));
  const hikeSlugs = new Set(listSlugs(HIKES_DIR, '.md'));

  it('every day lodgingSlug references a real lodging', () => {
    const bad: { file: string; lodgingSlug: string }[] = [];
    for (const f of fs.readdirSync(DAYS_DIR).filter((f) => f.endsWith('.md'))) {
      const fm = parseFrontmatter(fs.readFileSync(path.join(DAYS_DIR, f), 'utf8'));
      if (!lodgingSlugs.has(fm.lodgingSlug)) bad.push({ file: f, lodgingSlug: fm.lodgingSlug });
    }
    expect(bad).toEqual([]);
  });

  it('every hikeSlugs[] entry references a real hike', () => {
    const bad: { file: string; hikeSlug: string }[] = [];
    for (const f of fs.readdirSync(DAYS_DIR).filter((f) => f.endsWith('.md'))) {
      const fm = parseFrontmatter(fs.readFileSync(path.join(DAYS_DIR, f), 'utf8'));
      for (const h of fm.hikeSlugs ?? []) {
        if (!hikeSlugs.has(h)) bad.push({ file: f, hikeSlug: h });
      }
    }
    expect(bad).toEqual([]);
  });

  it('day count equals the trip span (endDate - startDate + 1 days)', () => {
    const trip = yaml.load(fs.readFileSync(path.join(ROOT, 'src/content/trip.yaml'), 'utf8')) as {
      startDate: string;
      endDate: string;
    };
    const expected =
      Math.floor(
        (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000,
      ) + 1;
    const actual = fs.readdirSync(DAYS_DIR).filter((f) => f.endsWith('.md')).length;
    expect(actual).toBe(expected);
  });
});

describe('§3.7 service-worker cache key', () => {
  it('dist/sw.js declares a dolomites-vN cache version', () => {
    const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
    const m = sw.match(/['"]dolomites-v(\d+)['"]/);
    expect(m, 'sw.js missing dolomites-vN cache key').not.toBeNull();
    expect(parseInt(m![1], 10)).toBeGreaterThan(0);
  });
});

describe('§3.8 image alt text on detail pages', () => {
  it('every <img> on detail-page routes has an alt attribute', () => {
    const missing: { route: string; src: string }[] = [];
    for (const { route, html } of allPages(DIST)) {
      const isDetail =
        route.startsWith('/hike/') ||
        route.startsWith('/day/') ||
        (route.startsWith('/activities/') && route !== '/activities') ||
        (route.startsWith('/lodgings/') && route !== '/lodgings');
      if (!isDetail) continue;
      // For each <img>, check it has an alt attribute (empty alt="" is fine).
      const imgRe = /<img\b[^>]*>/g;
      let m: RegExpExecArray | null;
      while ((m = imgRe.exec(html)) !== null) {
        const tag = m[0];
        if (!/\balt="/i.test(tag)) {
          const srcMatch = tag.match(/\bsrc="([^"]*)"/);
          missing.push({ route, src: srcMatch ? srcMatch[1] : tag });
        }
      }
    }
    expect(missing, `Imgs missing alt: ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });
});

describe('§3.9 schedule renders on day pages', () => {
  it('every day with non-empty schedule renders a Schedule heading + at least one HH:MM row', () => {
    const issues: { route: string; reason: string }[] = [];
    for (const f of fs.readdirSync(DAYS_DIR).filter((f) => f.endsWith('.md'))) {
      const fm = parseFrontmatter(fs.readFileSync(path.join(DAYS_DIR, f), 'utf8'));
      if (!fm.schedule || fm.schedule.length === 0) continue;
      const route = `/day/${fm.date}`;
      const file = path.join(DIST, `day/${fm.date}/index.html`);
      if (!fs.existsSync(file)) {
        issues.push({ route, reason: 'built page missing' });
        continue;
      }
      const html = fs.readFileSync(file, 'utf8');
      // Find <h2> ... Schedule ... </h2>
      const hasHeading = /<h2\b[^>]*>[^<]*Schedule[^<]*<\/h2>/.test(html);
      if (!hasHeading) issues.push({ route, reason: 'no Schedule heading' });
      // At least one <li> ... HH:MM ... </li> in the page (look in main, but the
      // simple regex just checks the file body has an li with a time pattern)
      const hasTimeRow = /<li\b[^>]*>[\s\S]*?\d\d:\d\d[\s\S]*?<\/li>/.test(html);
      if (!hasTimeRow) issues.push({ route, reason: 'no HH:MM row' });
    }
    expect(issues, `Schedule rendering issues: ${JSON.stringify(issues, null, 2)}`).toEqual([]);
  });
});

describe('§3.10 map ribbon presence on detail pages', () => {
  it('every detail-page route has exactly one .map-ribbon with an OSM tile <img>', () => {
    const missing: { route: string; reason: string }[] = [];
    for (const { route, html } of allPages(DIST)) {
      const isDetail =
        route.startsWith('/hike/') ||
        route.startsWith('/day/') ||
        (route.startsWith('/activities/') && route !== '/activities') ||
        (route.startsWith('/lodgings/') && route !== '/lodgings');
      if (!isDetail) continue;
      const ribbons = extractByClass(html, 'div', 'map-ribbon');
      if (ribbons.length !== 1) {
        missing.push({ route, reason: `expected 1 ribbon, got ${ribbons.length}` });
        continue;
      }
      const ribbon = ribbons[0];
      const imgSrcs = extractAttr(ribbon, 'img', 'src');
      const hasOsmTile = imgSrcs.some((s) => /tile\.openstreetmap\.org/.test(s));
      if (!hasOsmTile) {
        missing.push({ route, reason: `ribbon img src not an OSM tile: ${imgSrcs.join(',')}` });
      }
    }
    expect(missing, `Ribbon issues: ${JSON.stringify(missing, null, 2)}`).toEqual([]);
  });
});

describe('§3.5 activity-card destinations', () => {
  it('every <a href="/activities/SLUG"> points at a real activity file', () => {
    const slugs = new Set(listSlugs(ACTIVITIES_DIR, '.yaml'));
    const broken: { source: string; href: string }[] = [];
    for (const { route, html } of allPages(DIST)) {
      for (const { href } of extractAnchors(html)) {
        if (!href.startsWith('/activities/')) continue;
        const slug = href.replace(/^\/activities\//, '').replace(/\/?$/, '');
        if (slug && !slugs.has(slug)) broken.push({ source: route, href });
      }
    }
    expect(broken, `Broken activity links: ${JSON.stringify(broken, null, 2)}`).toEqual([]);
  });

  it('the catalog grid card count equals the activity collection size', () => {
    const collectionSize = listSlugs(ACTIVITIES_DIR, '.yaml').length;
    const indexFile = path.join(DIST, 'activities/index.html');
    const html = fs.readFileSync(indexFile, 'utf8');
    // Cards have the data-activity-card attribute on a <div>
    const cards = (html.match(/<div\b[^>]*\bdata-activity-card\b/g) ?? []).length;
    expect(cards).toBe(collectionSize);
  });

  it('each catalog card has a data-category matching its YAML', () => {
    const yamlByslug = new Map<string, string>();
    for (const slug of listSlugs(ACTIVITIES_DIR, '.yaml')) {
      const data = yaml.load(
        fs.readFileSync(path.join(ACTIVITIES_DIR, `${slug}.yaml`), 'utf8'),
      ) as { category: string };
      yamlByslug.set(slug, data.category);
    }
    const html = fs.readFileSync(path.join(DIST, 'activities/index.html'), 'utf8');
    // Match each <div data-activity-card data-category="..."> ... </div>
    // and look up the inner <a href="/activities/SLUG">.
    // Cards open with: <div data-activity-card data-category="..."  ...>
    const cardOpen = /<div\b[^>]*\bdata-activity-card\b[^>]*\bdata-category="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g;
    const mismatches: { slug: string; html: string; yaml: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = cardOpen.exec(html)) !== null) {
      const htmlCat = m[1];
      const inner = m[2];
      const hrefMatch = inner.match(/href="\/activities\/([^"\/]+)"/);
      const slug = hrefMatch ? hrefMatch[1] : '';
      const yamlCat = yamlByslug.get(slug);
      if (yamlCat && yamlCat !== htmlCat) mismatches.push({ slug, html: htmlCat, yaml: yamlCat });
    }
    expect(mismatches).toEqual([]);
  });
});
