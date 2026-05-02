// Tiny regex-based HTML extraction helpers for integrity tests.
// Cheerio would be cleaner but couldn't be installed in this environment;
// for the simple invariants we assert (link existence, attribute presence,
// targeted text content) regex is sufficient.

import fs from 'node:fs';
import path from 'node:path';

export function extractAttr(html: string, tag: string, attr: string): string[] {
  // Naive but adequate: matches <tag ... attr="value" ...>
  // Doesn't handle attribute values with embedded escaped quotes (we don't need to).
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

// Find every <a href="..."> on a page.
export function extractAnchors(html: string): { href: string; outerHTML: string; inner: string }[] {
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const out: { href: string; outerHTML: string; inner: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const hrefMatch = attrs.match(/\bhref="([^"]*)"/);
    if (!hrefMatch) continue;
    out.push({ href: hrefMatch[1], outerHTML: m[0], inner: m[2] });
  }
  return out;
}

// Find every element matching `<tag class="...CLASSNAME...">`.
// Returns the FULL outerHTML span for each match.
export function extractByClass(html: string, tag: string, cls: string): string[] {
  // Two-step: find opening tag with the class, then walk forward to the
  // matching close tag. For simple non-nested cases (which is what we have)
  // a regex with a class assertion is enough.
  const opener = new RegExp(`<${tag}\\b[^>]*\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = opener.exec(html)) !== null) {
    // From the start of this tag, find a balanced close. For our use cases
    // (.map-ribbon, individual <li>, <div data-activity-card>) the elements
    // are not deeply nested with same-tag children.
    const start = m.index;
    let depth = 1;
    let i = m.index + m[0].length;
    const tagOpen = new RegExp(`<${tag}\\b`, 'gi');
    const tagClose = new RegExp(`</${tag}>`, 'gi');
    while (depth > 0 && i < html.length) {
      tagOpen.lastIndex = i;
      tagClose.lastIndex = i;
      const oNext = tagOpen.exec(html);
      const cNext = tagClose.exec(html);
      if (!cNext) break;
      if (oNext && oNext.index < cNext.index) {
        depth++;
        i = oNext.index + 1;
      } else {
        depth--;
        i = cNext.index + cNext[0].length;
      }
    }
    out.push(html.slice(start, i));
  }
  return out;
}

// Walk dist/ and yield every built page as { route, html }.
export function* allPages(distDir: string): Generator<{ route: string; file: string; html: string }> {
  function* walk(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) yield* walk(p);
      else if (e.name === 'index.html') yield p;
    }
  }
  for (const file of walk(distDir)) {
    const route = '/' + path.relative(distDir, file).replace(/\/index\.html$/, '');
    const normalised = route === '/' || route === '/.' ? '/' : route;
    const html = fs.readFileSync(file, 'utf8');
    yield { route: normalised, file, html };
  }
}

// Parse a YAML frontmatter block from a markdown file's content.
import yaml from 'js-yaml';
export function parseFrontmatter(md: string): Record<string, any> {
  const m = md.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return {};
  return yaml.load(m[1]) as Record<string, any>;
}
