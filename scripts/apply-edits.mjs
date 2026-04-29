#!/usr/bin/env node
/**
 * Apply a share-link's encoded LocalState to the canonical content files.
 * Usage:
 *   node scripts/apply-edits.mjs '<full-share-link-url>'
 *   node scripts/apply-edits.mjs ./edits.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import LZString from 'lz-string';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/apply-edits.mjs <share-link-url-or-json-path>');
  process.exit(1);
}

let stateJson;
if (arg.startsWith('http')) {
  const url = new URL(arg);
  const encoded = url.searchParams.get('plan');
  if (!encoded) { console.error('No ?plan= param in URL'); process.exit(1); }
  stateJson = LZString.decompressFromEncodedURIComponent(encoded);
} else if (arg.endsWith('.json')) {
  stateJson = fs.readFileSync(arg, 'utf8');
} else {
  console.error('Pass a share-link URL or a path to a .json file.');
  process.exit(1);
}

const state = JSON.parse(stateJson);
console.log(`Loaded state: schemaVersion=${state.schemaVersion}, edits at ${state.lastEditedAt ?? 'unknown'}`);

let touched = 0;

// Apply hike edits
for (const [slug, patch] of Object.entries(state.hikeEdits ?? {})) {
  const file = path.join(ROOT, 'src/content/hikes', `${slug}.md`);
  if (!fs.existsSync(file)) { console.warn(`  ! Hike ${slug} not found, skipping`); continue; }
  const md = fs.readFileSync(file, 'utf8');
  const updated = mergeFrontmatter(md, patch);
  fs.writeFileSync(file, updated);
  console.log(`  ✓ Updated hikes/${slug}.md`);
  touched++;
}

// Apply day edits
for (const [date, patch] of Object.entries(state.dayEdits ?? {})) {
  const dir = path.join(ROOT, 'src/content/days');
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(date));
  if (files.length === 0) { console.warn(`  ! Day ${date} not found, skipping`); continue; }
  const file = path.join(dir, files[0]);
  const md = fs.readFileSync(file, 'utf8');
  const updated = mergeFrontmatter(md, patch);
  fs.writeFileSync(file, updated);
  console.log(`  ✓ Updated days/${files[0]}`);
  touched++;
}

// Add custom hikes
for (const [slug, hike] of Object.entries(state.customHikes ?? {})) {
  const file = path.join(ROOT, 'src/content/hikes', `${slug}.md`);
  fs.writeFileSync(file, `---\n${stringifyYAML(hike)}\n---\n\n`);
  console.log(`  ✓ Added hikes/${slug}.md (custom)`);
  touched++;
}

// Add custom days
for (const [date, day] of Object.entries(state.customDays ?? {})) {
  const slug = `${date}-custom`;
  const file = path.join(ROOT, 'src/content/days', `${slug}.md`);
  fs.writeFileSync(file, `---\n${stringifyYAML(day)}\n---\n\n`);
  console.log(`  ✓ Added days/${slug}.md (custom)`);
  touched++;
}

console.log(`\nDone. ${touched} file(s) modified.`);
console.log('Review with `git diff`, then `git commit` and `git push` to deploy.');

// --- helpers ---

function mergeFrontmatter(md, patch) {
  const m = md.match(/^---\n([\s\S]+?)\n---/);
  if (!m) return md;
  const current = yaml.load(m[1]) ?? {};
  const merged = deepMerge(current, patch);
  return `---\n${stringifyYAML(merged)}\n---${md.slice(m[0].length)}`;
}

function stringifyYAML(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return obj.includes('\n') || obj.includes(': ') ? JSON.stringify(obj) : obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return '\n' + obj.map(x => `${pad}- ${typeof x === 'object' ? stringifyYAML(x, indent + 1).trim().replace(/\n/g, '\n  ') : stringifyYAML(x, indent)}`).join('\n');
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return keys.map(k => {
      const v = obj[k];
      const isComplex = (typeof v === 'object' && v !== null);
      return `${pad}${k}: ${isComplex ? stringifyYAML(v, indent + 1) : stringifyYAML(v, indent)}`;
    }).join('\n');
  }
  return String(obj);
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') {
      out[k] = deepMerge(a[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
