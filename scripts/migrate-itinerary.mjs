#!/usr/bin/env node
/**
 * One-time migration: dolomites-garda-itinerary.md → src/content/*
 * Idempotent: running again overwrites generated files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'dolomites-garda-itinerary.md');

// --- Helpers ---

const slugify = (s) => s.toLowerCase()
  .replace(/[àáäâ]/g, 'a').replace(/[èéëê]/g, 'e').replace(/[ìíïî]/g, 'i')
  .replace(/[òóöô]/g, 'o').replace(/[ùúüû]/g, 'u')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Map known hike names (and common prefixes) to canonical slugs
const HIKE_SLUG_MAP = {
  'tre cime di lavaredo': 'tre-cime',
  'tre cime': 'tre-cime',
  'lake sorapis': 'sorapis',
  'lago sorapis': 'sorapis',
  'sorapis': 'sorapis',
  'lago di braies': 'lago-di-braies',
  'cadini di misurina': 'cadini',
  'cadini': 'cadini',
  'seceda → rifugio firenze → col raiser loop': 'seceda-firenze',
  'seceda → rifugio firenze → col raiser': 'seceda-firenze',
  'seceda': 'seceda-firenze',
  'alpe di siusi family tour': 'alpe-di-siusi-family',
  'alpe di siusi': 'alpe-di-siusi-family',
};

/**
 * Normalise a hike name string to a canonical slug.
 * Strips parenthetical suffixes like "(RECOMMENDED)" and trailing
 * qualifiers like "loop", "via …", "lake …", "viewpoint" before
 * attempting a map lookup.
 */
const normaliseHikeName = (s) => {
  // Strip parenthetical suffixes e.g. "(RECOMMENDED)"
  let cleaned = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const lower = cleaned.toLowerCase().trim();

  // Exact match first
  if (HIKE_SLUG_MAP[lower]) return HIKE_SLUG_MAP[lower];

  // Try progressively shorter prefixes by stripping trailing words
  // This handles "Tre Cime di Lavaredo loop", "Lake Sorapis via …", etc.
  const words = lower.split(/\s+/);
  for (let len = words.length - 1; len >= 1; len--) {
    const prefix = words.slice(0, len).join(' ');
    if (HIKE_SLUG_MAP[prefix]) return HIKE_SLUG_MAP[prefix];
  }

  return slugify(cleaned);
};

// --- Parsers ---

export function parseDays(md) {
  const dayBlocks = md.split(/\n### DAY \d+ — /).slice(1);
  const days = [];

  for (const block of dayBlocks) {
    // Header line: "Wed, Jul 15: Arrival → Cortina"
    const headerMatch = block.match(/^(\w+), (\w+ \d+): (.+?)\n/);
    if (!headerMatch) continue;
    const [, weekday, monthDay, theme] = headerMatch;
    const date = monthDayToISO(monthDay, '2026');

    // Schedule rows: lines like "| 07:00 | Action |" inside #### Schedule
    const schedSection = block.match(/#### Schedule\n([\s\S]+?)(?=\n#### |\n### |\n---)/);
    const schedule = [];
    if (schedSection) {
      for (const m of schedSection[1].matchAll(/\|\s*(\d{2}:\d{2})\s*\|\s*([^|]+?)\s*\|/g)) {
        schedule.push({ time: m[1], action: m[2].trim() });
      }
    }

    // Driving line near top: "**Driving:** ~50 km return (~1h 30m)"
    const drivingMatch = block.match(/\*\*Driving:\*\*\s*~?(\d+)\s*km[^(]*(?:\(~?(\d+)h(?:\s*(\d+)m)?\)|\(~?(\d+)\s*min\))/i);
    let driving = { distanceKm: 0, durationMin: 0 };
    if (drivingMatch) {
      const km = parseInt(drivingMatch[1], 10);
      const h = drivingMatch[2] ? parseInt(drivingMatch[2], 10) : 0;
      const m = drivingMatch[3] ? parseInt(drivingMatch[3], 10) : drivingMatch[4] ? parseInt(drivingMatch[4], 10) : 0;
      driving = { distanceKm: km, durationMin: h * 60 + m };
    }

    // Hike refs: look for "#### Hike:" / "#### Hike A:" / "#### Hike B:" headings
    const hikeSlugs = [];
    for (const m of block.matchAll(/####\s+Hike(?:\s+[A-Z])?:\s+(.+?)\n/g)) {
      const slug = normaliseHikeName(m[1]);
      if (!hikeSlugs.includes(slug)) hikeSlugs.push(slug);
    }
    // Day 6 special-case: theme line mentions Alpe di Siusi
    if (theme.toLowerCase().includes('alpe di siusi') && hikeSlugs.length === 0) {
      hikeSlugs.push('alpe-di-siusi-family');
    }

    // Lodging
    const lodgingMatch = block.match(/\*\*Lodging:\*\*\s*([^(\n]+)/);
    const lodgingSlug = lodgingMatch
      ? slugify(lodgingMatch[1].split('(')[0].trim())
      : 'baita-fraina';

    // Weather location
    const weatherMatch = lodgingMatch?.[1]?.toLowerCase().includes('kircher')
      ? { lat: 46.6109, lon: 11.5226, label: 'Barbiano' }
      : { lat: 46.5237, lon: 12.1528, label: 'Cortina' };

    days.push({
      date,
      theme: theme.trim(),
      driving,
      schedule,
      hikeSlugs,
      lodgingSlug,
      weatherFor: weatherMatch,
      _rawBlock: block,
    });
  }

  return days;
}

function monthDayToISO(monthDay, year) {
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
                   Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const m = monthDay.match(/(\w+) (\d+)/);
  if (!m) throw new Error(`Bad monthDay: ${monthDay}`);
  return `${year}-${months[m[1]]}-${m[2].padStart(2, '0')}`;
}

export function parseHikes(md) {
  // Each hike has a "#### Hike:" or "#### Hike A:" / "Hike B:" heading followed by detail block
  const hikes = [];
  const hikeBlocks = md.split(/\n#### Hike(?:\s+[A-Z])?:\s+/).slice(1);

  for (const block of hikeBlocks) {
    const nameLine = block.split('\n')[0].trim();
    const slug = normaliseHikeName(nameLine);
    if (hikes.find(h => h.slug === slug)) continue; // dedupe

    const distanceMatch = block.match(/\*\*Distance:\*\*\s*([\d.]+)\s*km/i);
    const gainMatch = block.match(/\*\*Elevation gain:\*\*\s*~?(\d+)\s*m/i);
    const timeMatch = block.match(/\*\*Time:\*\*\s*(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)h/i);
    const ratingMatch = block.match(/\*\*Difficulty:\*\*\s*(\w+)[^(]*\(([\d.]+)★(?:,\s*([\d,]+))?/i);
    const trailheadMatch = block.match(/\*\*Trailhead:\*\*\s*([^,\n]+),\s*([\d.]+),\s*([\d.]+)/);
    const alltrailsMatch = block.match(/\*\*AllTrails:\*\*\s*`(https?:\/\/[^\s`]+)`/i);
    const typeMatch = block.match(/\|\s*(Loop|Out & back|Out-and-back|Point-to-point)\s*\|/i)
                   || block.match(/\b(Loop|Out & back|Out-and-back|Point-to-point)\b/i);

    const region = block.toLowerCase().includes('south tyrol') ? 'South Tyrol' : 'Veneto';

    hikes.push({
      slug,
      name: nameLine,
      region,
      alltrailsUrl: alltrailsMatch?.[1],
      distanceKm: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
      elevationGainM: gainMatch ? parseInt(gainMatch[1], 10) : 0,
      movingTimeHours: { min: timeMatch ? parseFloat(timeMatch[1]) : 1, max: timeMatch ? parseFloat(timeMatch[2]) : 2 },
      totalTimeHours: { min: timeMatch ? parseFloat(timeMatch[1]) : 1, max: timeMatch ? parseFloat(timeMatch[2]) + 1 : 3 },
      difficulty: ratingMatch ? ratingMatch[1].toLowerCase().includes('easy') ? 'easy'
                  : ratingMatch[1].toLowerCase().includes('hard') ? 'hard' : 'moderate' : 'moderate',
      rating: ratingMatch?.[2] ? { stars: parseFloat(ratingMatch[2]), reviews: ratingMatch[3] ? parseInt(ratingMatch[3].replace(/,/g, ''), 10) : 0 } : null,
      type: typeMatch ? (typeMatch[1].toLowerCase().includes('loop') ? 'loop'
                         : typeMatch[1].toLowerCase().includes('point') ? 'point-to-point' : 'out-and-back') : 'loop',
      trailhead: trailheadMatch
        ? { name: trailheadMatch[1].trim(), lat: parseFloat(trailheadMatch[2]), lon: parseFloat(trailheadMatch[3]) }
        : { name: 'Unknown', lat: 0, lon: 0 },
      parking: parseParking(block),
      routeHighlights: parseListAfter(block, 'Route highlights'),
      foodOnTrail: parseFoodOnTrail(block),
      hazards: parseListAfter(block, 'Hazards & tips'),
      badWeatherOption: parseSection(block, 'Bad weather option'),
      _rawBlock: block,
    });
  }

  return hikes;
}

function parseParking(block) {
  const costMatch = block.match(/\*\*Cost:\*\*\s*€?([\d.]+|Free)/i);
  const bookingMatch = block.match(/\*\*Booking:\*\*\s*([^\n]+)/i);
  const urlMatch = block.match(/`(https?:\/\/[^\s`]+pass\.[^\s`]+|https?:\/\/[^\s`]+parking[^\s`]+)`/i);
  return {
    name: 'Trailhead parking',
    costEur: costMatch && costMatch[1] !== 'Free' ? parseFloat(costMatch[1]) : 0,
    mustBook: /mandatory/i.test(bookingMatch?.[1] ?? ''),
    bookingUrl: urlMatch?.[1],
    bookingOpensDaysBefore: /30 days before/i.test(block) ? 30 : undefined,
  };
}

function parseListAfter(block, heading) {
  const re = new RegExp(`####.*${heading}\\s*\\n([\\s\\S]+?)(?=\\n####|\\n###|\\n---)`, 'i');
  const m = block.match(re);
  if (!m) return [];
  return m[1].split('\n').filter(l => l.match(/^[-*]\s/)).map(l => l.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
}

function parseFoodOnTrail(block) {
  const re = /####\s+Food on the trail\s*\n([\s\S]+?)(?=\n####|\n###|\n---)/i;
  const m = block.match(re);
  if (!m) return [];
  const items = [];
  for (const line of m[1].split('\n')) {
    const im = line.match(/^[-*]\s+\*\*([^*]+)\*\*[^:]*:\s*(.+)$/) || line.match(/^[-*]\s+\*\*([^*]+)\*\*\s*(.*)$/);
    if (im) items.push({ name: im[1].trim(), notes: im[2].trim() });
  }
  return items;
}

function parseSection(block, heading) {
  const re = new RegExp(`####\\s+${heading}\\s*\\n([\\s\\S]+?)(?=\\n####|\\n###|\\n---)`, 'i');
  return block.match(re)?.[1].trim();
}

export function parseBookings(md) {
  // Booking Status Tracker section, table rows
  const section = md.match(/## 9\. Booking Status Tracker[\s\S]+?(?=\n## )/);
  if (!section) return [];
  const rows = [...section[0].matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm)];
  // Skip header & separator rows
  const items = [];
  let id = 1;
  for (const row of rows) {
    const label = row[1].trim();
    const status = row[2].trim();
    if (!label || label.startsWith('---') || label.toLowerCase() === 'item') continue;
    items.push({
      id: `b-${id++}`,
      label: label.replace(/\*\*/g, ''),
      category: inferCategory(label),
      status: status.includes('✅') ? 'booked' : status.includes('❌') ? 'not-needed' : 'pending-window',
      notes: status.replace(/[✅⏳❌]/g, '').trim() || undefined,
    });
  }
  return items;
}

function inferCategory(label) {
  const l = label.toLowerCase();
  if (l.includes('lx ') || l.includes('os ') || l.includes('flight')) return 'flight';
  if (l.includes('rental') || l.includes('greenmotion') || l.includes('car')) return 'car';
  if (l.includes('parking')) return 'parking';
  if (l.includes('cable car') || l.includes('seceda')) return 'cable-car';
  if (l.includes('hotel') || l.includes('baita') || l.includes('kircher') || l.includes('airbnb')) return 'lodging';
  if (l.includes('dinner') || l.includes('restaurant')) return 'restaurant';
  return 'other';
}

// --- Main ---

export async function runMigration() {
  const md = fs.readFileSync(SOURCE, 'utf8');
  const days = parseDays(md);
  const hikes = parseHikes(md);
  const bookings = parseBookings(md);
  console.log(`Parsed ${days.length} days, ${hikes.length} hikes, ${bookings.length} bookings.`);
  // Emit functions added in subsequent tasks
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(e => { console.error(e); process.exit(1); });
}
