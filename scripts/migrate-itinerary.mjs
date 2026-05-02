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

function toYAML(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') {
    // Quote strings that contain characters YAML would misinterpret
    // Also quote ISO date (YYYY-MM-DD) and ISO datetime strings so YAML parses them as strings
    // Empty strings must be quoted so YAML doesn't parse them as null
    if (obj === '') return '""';
    if (obj.includes('\n') || obj.includes(': ') || obj.startsWith('- ')
        || obj.includes('*') || obj.includes('#') || obj.includes('{') || obj.includes('}')
        || obj.includes('[') || obj.includes(']') || obj.includes(',') || obj.includes('|')
        || obj.includes('>') || obj.includes('?') || obj.startsWith('!') || obj.startsWith('@')
        || obj.startsWith('`') || obj.startsWith('"') || obj.startsWith("'")
        || /^\d{4}-\d{2}-\d{2}/.test(obj)
        || /^\+\d/.test(obj)
        || /^\d+$/.test(obj)) {
      return JSON.stringify(obj);
    }
    return obj;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return '\n' + obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        // Render object items: first key goes inline after "- ", rest aligned to same column
        const keys = Object.keys(item).filter(k => !k.startsWith('_') && item[k] !== undefined);
        if (keys.length === 0) return `${pad}- {}`;
        const childPad = pad + '  '; // 2 spaces after "- " prefix
        const lines = keys.map((k, i) => {
          const val = item[k];
          const isComplex = (typeof val === 'object' && val !== null);
          const rendered = isComplex ? toYAML(val, indent + 2).replace(/\n/g, '\n' + childPad) : toYAML(val, indent);
          const prefix = i === 0 ? `${pad}- ` : `${childPad}`;
          return `${prefix}${k}: ${rendered}`;
        });
        return lines.join('\n');
      }
      return `${pad}- ${toYAML(item, indent)}`;
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).filter(k => !k.startsWith('_') && obj[k] !== undefined);
    if (keys.length === 0) return '{}';
    return '\n' + keys.map(k => {
      const val = obj[k];
      const isComplex = (typeof val === 'object' && val !== null);
      return `${pad}${k}: ${isComplex ? toYAML(val, indent + 1) : toYAML(val, indent)}`;
    }).join('\n');
  }
  return String(obj);
}

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
 * Parse a "Xh Ym" or "Xh" or "Y min" duration string into total minutes.
 *   "55 min" → 55
 *   "1h"     → 60
 *   "1h 0m"  → 60
 *   "2h 15m" → 135
 */
function parseDurationToMinutes(s) {
  const hMatch = s.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/i);
  if (hMatch) {
    return parseInt(hMatch[1], 10) * 60 + (hMatch[2] ? parseInt(hMatch[2], 10) : 0);
  }
  const mMatch = s.match(/(\d+)\s*min/i);
  if (mMatch) return parseInt(mMatch[1], 10);
  return 0;
}

/**
 * Parse a "**Drive legs:**" block from a day's markdown section.
 * Format expected, one line per leg:
 *   - {from} → {to} — {km} km / {duration}
 * Returns an array of { from, to, distanceKm, durationMin } objects.
 */
export function parseDriveLegs(block) {
  // Find the "**Drive legs:**" line and read subsequent "- ..." lines until a blank
  // line, a heading, or another bold label appears.
  const m = block.match(/\*\*Drive legs:\*\*\s*\n([\s\S]+?)(?=\n\*\*|\n#{1,6} |\n---|\n\n)/);
  if (!m) return [];
  const body = m[1];
  const legs = [];
  for (const line of body.split('\n')) {
    // " - From → To — 25 km / 45 min "  (em dash before km)
    const lm = line.match(/^\s*-\s+(.+?)\s*→\s*(.+?)\s*—\s*([\d.]+)\s*km\s*\/\s*(.+?)\s*$/);
    if (lm) {
      legs.push({
        from: lm[1].trim(),
        to: lm[2].trim(),
        distanceKm: parseFloat(lm[3]),
        durationMin: parseDurationToMinutes(lm[4]),
      });
    }
  }
  return legs;
}

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

    // Drive legs are defined in a "**Drive legs:**" block per day.
    // The legacy "**Driving:** Xkm (Yh Zm)" prose summary is no longer parsed.
    const legs = parseDriveLegs(block);
    const driving = { legs };

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

    // Distance: accept optional "~" prefix (e.g. "~4 km" for Cadini)
    const distanceMatch = block.match(/\*\*Distance:\*\*\s*~?\s*([\d.]+)\s*km/i);
    const gainMatch = block.match(/\*\*Elevation gain:\*\*\s*~?(\d+)\s*m/i);
    const timeMatch = block.match(/\*\*Time:\*\*\s*(\d+(?:\.\d+)?)[–-](\d+(?:\.\d+)?)h/i);
    const ratingMatch = block.match(/\*\*Difficulty:\*\*\s*(\w+)[^(]*\(([\d.]+)★(?:,\s*([\d,]+))?/i);
    // Trailhead: some hikes use "**Trailhead:**" (Tre Cime, Sorapis, Braies, Cadini),
    // others use "**Start/end:**" (Seceda, Alpe di Siusi). Try both.
    const trailheadMatch =
      block.match(/\*\*Trailhead:\*\*\s*([^,\n]+),\s*([\d.]+),\s*([\d.]+)/) ||
      block.match(/\*\*Start\/end:\*\*\s*([^,\n]+),\s*([\d.]+),\s*([\d.]+)/);
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
    const slug = inferRelatedHike(label);
    items.push({
      id: `b-${id++}`,
      label: label.replace(/\*\*/g, ''),
      category: inferCategory(label),
      status: status.includes('✅') ? 'booked' : status.includes('❌') ? 'not-needed' : 'pending-window',
      notes: status.replace(/[✅⏳❌]/g, '').trim() || undefined,
      relatedHikeSlug: slug,
    });
  }
  return items;
}

function inferCategory(label) {
  const l = label.toLowerCase();
  if (l.includes('lx ') || l.includes('os ') || l.includes('flight')) return 'flight';
  if (l.includes('cable car') || l.includes('seceda')) return 'cable-car';
  if (l.includes('rental') || l.includes('greenmotion') || l.includes('car')) return 'car';
  if (l.includes('parking')) return 'parking';
  if (l.includes('hotel') || l.includes('baita') || l.includes('kircher') || l.includes('airbnb')) return 'lodging';
  if (l.includes('dinner') || l.includes('restaurant')) return 'restaurant';
  return 'other';
}

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

function writeFile(rel, content) {
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  console.log(`  ✓ ${rel}`);
}

function emitDay(day) {
  // day.driving is now { legs: [{ from, to, distanceKm, durationMin, notes? }] }
  // (changed from { distanceKm, durationMin } in 2026-05-01 audit pass).
  const slug = `${day.date}-${slugify(day.theme.split('→').pop().split(',')[0])}`;
  const fm = {
    date: day.date,
    theme: day.theme,
    driving: day.driving,
    schedule: day.schedule,
    hikeSlugs: day.hikeSlugs,
    lodgingSlug: day.lodgingSlug,
    weatherFor: day.weatherFor,
  };
  const yaml = toYAML(fm).trim();
  writeFile(`src/content/days/${slug}.md`, `---\n${yaml}\n---\n\n`);
}

function emitHike(hike) {
  const fm = { ...hike };
  delete fm._rawBlock;
  const yaml = toYAML(fm).trim();
  writeFile(`src/content/hikes/${hike.slug}.md`, `---\n${yaml}\n---\n\n`);
}

function emitBookings(bookings) {
  // toYAML(b, 0) emits `field: value` per line with no leading indent; we then
  // prefix `- ` for the item marker and `  ` for subsequent lines so each booking
  // becomes a YAML mapping under a single list item.
  const yaml = bookings.map(b => `- ${toYAML(b, 0).trim().replace(/\n/g, '\n  ')}`).join('\n');
  writeFile(`src/content/bookings.yaml`, yaml + '\n');
}

function emitTrip() {
  const trip = {
    name: "Italia '26",
    startDate: '2026-07-15',
    endDate: '2026-07-27',
    travelers: ['Kevin', '+ party'],
    phases: [
      { id: 'dolomites', label: 'Dolomites', start: '2026-07-15', end: '2026-07-20' },
      { id: 'garda',     label: 'Lake Garda', start: '2026-07-20', end: '2026-07-27' },
    ],
    flights: {
      outbound: [
        { flightNumber: 'LX1267', airline: 'Swiss', from: 'CPH', to: 'ZRH', depart: '2026-07-15T09:40', arrive: '2026-07-15T11:35' },
        { flightNumber: 'LX1662', airline: 'Swiss', from: 'ZRH', to: 'VCE', depart: '2026-07-15T12:55', arrive: '2026-07-15T14:00' },
      ],
      return: [
        { flightNumber: 'OS548', airline: 'Austrian Airlines', operatedBy: 'Air Dolomiti', from: 'VCE', to: 'VIE', depart: '2026-07-27T19:10', arrive: '2026-07-27T20:15' },
        { flightNumber: 'OS989', airline: 'Austrian Airlines', from: 'VIE', to: 'CPH', depart: '2026-07-27T21:00', arrive: '2026-07-27T22:40' },
      ],
    },
    rentalCar: {
      provider: 'Greenmotion',
      confirmationNumber: '798336606',
      model: 'Peugeot 308 or similar',
      pickup: { time: '2026-07-15T15:00', location: 'Venice Marco Polo Airport (VCE)', address: 'Via Orlanda 219 c/o ParkingGo Venezia, Venice 30173', phone: '+390418040448' },
      dropoff: { time: '2026-07-27T18:00', location: 'Venice Marco Polo Airport (VCE)' },
      insurance: 'Zurich Full Insurance EEA',
      cost: { amount: 6284, currency: 'SEK' },
    },
  };
  writeFile('src/content/trip.yaml', toYAML(trip).trim() + '\n');
}

function emitLodgings() {
  const lodgings = [
    {
      slug: 'baita-fraina',
      name: 'Baita Fraina',
      location: "Cortina d'Ampezzo",
      checkIn: '2026-07-15T20:00',
      checkOut: '2026-07-18T11:00',
      nights: 3,
      phone: '+39 0436 3634',
      address: "Località Fraina 1, Cortina d'Ampezzo, BL",
      lat: 46.5237,
      lon: 12.1528,
      bookingUrl: 'https://www.booking.com/hotel/it/baita-fraina.html',
      notes: 'One-lane access road. Restaurant on site (book ahead). Great breakfast.',
    },
    {
      slug: 'pension-kircher-sepp',
      name: 'Garni / Pension Kircher Sepp',
      location: 'Barbiano (Barbian), BZ',
      checkIn: '2026-07-18T15:00',
      checkOut: '2026-07-20T11:00',
      nights: 2,
      phone: '+390471650008',
      address: 'Via Rosengarten 27, Barbiano (Barbian), BZ 39040',
      lat: 46.6109,
      lon: 11.5226,
      bookingUrl: 'https://www.booking.com/hotel/it/gasthof-albergo-kircher-sepp.html',
      notes: 'Family-run. Ask for balcony room facing Dolomites.',
    },
    {
      slug: 'salo-airbnb',
      name: "Anna's Home — Salò",
      location: 'Salò, Lake Garda',
      checkIn: '2026-07-20T16:00',
      checkOut: '2026-07-27T10:00',
      nights: 7,
      address: 'Via Pietro da Salò 40, Salò, Lombardia 25087',
      lat: 45.6063,
      lon: 10.5237,
      bookingUrl: 'https://www.airbnb.com/trips/v1?confirmationCode=HMPSNRH5NY&reservationType=STAY',
      notes: "Host: Anna Fiaccavento (co-host: Alessio). Confirmation HMPSNRH5NY. Reserved covered parking spot in the condo garage (entrance via Via Dr. B. Pollini, marked ANNA'S HOME, height limit 2 m). 49 sec walk to the beach. Quiet hours 11pm–9am. Free cancellation until 4pm Jul 15.",
    },
  ];
  for (const l of lodgings) {
    writeFile(`src/content/lodgings/${l.slug}.yaml`, toYAML(l).trim() + '\n');
  }
}

function emitRestaurants() {
  const groups = [
    {
      area: "Cortina d'Ampezzo",
      items: [
        { name: 'Baita Fraina', type: 'Refined Tyrolean', priceRange: '$$$', needsReservation: true, notes: 'Hotel restaurant — book ahead.' },
        { name: 'Al Camin', type: 'Modern mountain food', priceRange: '$$', needsReservation: true },
        { name: 'El Camineto', type: 'Traditional alpine', priceRange: '$$', needsReservation: false },
        { name: 'Ospitale', type: 'Old stagecoach inn', priceRange: '$$', needsReservation: true, notes: '~7 km north on the SS51.' },
        { name: 'Enoteca Baita Fraina', type: 'Wine bar / aperitivo', priceRange: '$', needsReservation: false, notes: 'Sister wine bar in town centre.' },
        { name: 'Panificio Alverà', type: 'Bakery', priceRange: '$', needsReservation: false, notes: 'Trail sandwiches and pastries.' },
      ],
    },
    {
      area: 'Brixen / Eisacktal',
      items: [
        { name: 'Vitis (Brixen)', type: 'Wine bar with refined seasonal small plates', priceRange: '$$', needsReservation: true, notes: 'Enoteca attached to Hotel Adler; not a formal tasting menu.' },
        { name: 'Decantei (Brixen)', type: 'Wine bar with small plates', priceRange: '$$', needsReservation: false },
        { name: 'Sunnegg (Brixen)', type: 'Panoramic spot above town', priceRange: '$$', needsReservation: true },
      ],
    },
    {
      area: 'Ortisei (Val Gardena)',
      items: [
        { name: 'Cascade', type: 'Mid-range reliable', priceRange: '$$', needsReservation: false },
        { name: "Caffè Val d'Anna", type: 'Café · quick panini and coffee', priceRange: '$', needsReservation: false, address: 'Streda Annatal 39, Ortisei', notes: 'Casual stop for coffee, panini, light bites.' },
        { name: 'Restaurant Concordia', type: 'Traditional Ladin', priceRange: '$$', needsReservation: false },
      ],
    },
  ];
  for (const g of groups) {
    writeFile(`src/content/restaurants/${slugify(g.area)}.yaml`, toYAML(g).trim() + '\n');
  }
}

export function buildActivities() {
  const activities = [
    // ── FEATURED (4) ───────────────────────────────────────────────────
    {
      slug: 'solferino-red-cross-memorial',
      name: 'Solferino Red Cross Memorial Complex',
      category: 'culture-history',
      description: 'Birthplace of the Red Cross. The 1859 battle between Franco-Sardinian and Austrian armies left 40,000 wounded; Henri Dunant\'s witness here led directly to the founding of the International Red Cross. Visit the Memorial chapel, the Ossuary, and the Tower commemorating the battle.',
      location: { label: 'Solferino', lat: 45.3733, lon: 10.5664 },
      cost: { display: '€5 per site · €10 combined ticket' },
      durationHours: 3,
      driveFromSaloMin: 35,
      bookingRequired: false,
      bookingNote: 'Guided tours bookable in advance — recommended for English narration.',
      url: 'https://www.solferinoesanmartino.it/',
      featured: true,
    },
    {
      slug: 'garda-rent-boat-jetski',
      name: 'Garda Rent Boat — Jet Ski Rental',
      category: 'water-sports',
      description: 'Jet ski rental from Sirmione (peninsula at the south end of the lake). Yamaha craft, hourly rates, no licence required for the standard models with operator briefing. Helmets and life-vests included.',
      location: { label: 'Sirmione', lat: 45.4951, lon: 10.6065 },
      cost: { display: '€80–120 per hour' },
      durationHours: 1,
      driveFromSaloMin: 25,
      bookingRequired: true,
      bookingNote: 'Book 1–2 days ahead in peak season.',
      url: 'https://www.gardarentboat.it/',
      featured: true,
    },
    {
      slug: 'vittoriale-degli-italiani',
      name: 'Vittoriale degli Italiani',
      category: 'culture-history',
      description: 'D\'Annunzio\'s eccentric villa-museum complex on the hillside above Gardone Riviera. Includes the writer\'s house (Prioria), an open-air theatre, an actual warship (Puglia) embedded in the gardens, and a mausoleum. One of the strangest and most memorable cultural visits on the lake.',
      location: { label: 'Gardone Riviera', lat: 45.6175, lon: 10.5575 },
      cost: { display: '€18 grounds · €25 grounds + house' },
      durationHours: 3,
      driveFromSaloMin: 10,
      bookingRequired: true,
      bookingNote: 'Timed entry for the house — book online to avoid sold-out slots.',
      url: 'https://www.vittoriale.it/',
      featured: true,
    },
    {
      slug: 'monte-baldo-cable-car',
      name: 'Monte Baldo Cable Car (Funivia)',
      category: 'mountain-cable-car',
      description: 'Rotating panoramic cable car from Malcesine (lake level) to Monte Baldo (1,760 m). Two stages, ~10-minute ride, 360° views over Lake Garda and the Adamello-Brenta range. Ridge walks, paragliding launches, and a refuge at the top station.',
      location: { label: 'Malcesine', lat: 45.7681, lon: 10.8108 },
      cost: { display: '€30 round-trip adult' },
      durationHours: 4,
      driveFromSaloMin: 70,
      bookingRequired: true,
      bookingNote: 'Sells out on clear summer days — book online for a morning slot.',
      url: 'https://www.funiviedelbaldo.it/',
      featured: true,
    },

    // ── WATER SPORTS (additional 3 beyond featured jetski) ─────────────
    {
      slug: 'garda-rent-boat-rental',
      name: 'Garda Rent Boat — Boat Rental (No Licence)',
      category: 'water-sports',
      description: 'Self-drive boat rental from Sirmione for sub-40 hp craft that don\'t require a licence. 4–6 person capacity, perfect for cruising the south basin and the Sirmione peninsula.',
      location: { label: 'Sirmione', lat: 45.4951, lon: 10.6065 },
      cost: { display: '€100–180 per half-day' },
      durationHours: 4,
      driveFromSaloMin: 25,
      bookingRequired: true,
      bookingNote: 'Reserve 2–3 days ahead.',
      url: 'https://www.gardarentboat.it/',
      featured: false,
    },
    {
      slug: 'sup-kayak-salo',
      name: 'SUP / Kayak Rental — Salò Waterfront',
      category: 'water-sports',
      description: 'Stand-up paddleboard and kayak rentals on the Salò lakefront promenade. Calm morning water; the bay is sheltered. Walk-in friendly, lifejackets included.',
      location: { label: 'Salò', lat: 45.6063, lon: 10.5237 },
      cost: { display: '€15 per hour' },
      durationHours: 2,
      driveFromSaloMin: 0,
      bookingRequired: false,
      featured: false,
    },
    {
      slug: 'sailing-riva-del-garda',
      name: 'Sailing Lessons — Riva del Garda',
      category: 'water-sports',
      description: 'The north end of the lake (Riva / Torbole) gets reliable thermal winds — Ora in the afternoon, Pelér in the morning — making it Italy\'s best inland sailing school spot. Half-day intro courses available.',
      location: { label: 'Riva del Garda', lat: 45.8854, lon: 10.8400 },
      cost: { display: '€60–120 per half-day course' },
      durationHours: 4,
      driveFromSaloMin: 75,
      bookingRequired: true,
      bookingNote: 'Book 3–5 days ahead in summer.',
      featured: false,
    },

    // ── CULTURE & HISTORY (5 beyond Solferino+Vittoriale) ──────────────
    {
      slug: 'san-martino-della-battaglia',
      name: 'San Martino della Battaglia',
      category: 'culture-history',
      description: 'Twin battle site to Solferino — the same June 24, 1859 day, fought 8 km north between the Sardinian army and the Austrians. Climb the spiral staircase of the Tower for sweeping views to Lake Garda. Adjacent ossuary and museum. Pair with Solferino as one half-day.',
      location: { label: 'San Martino della Battaglia', lat: 45.4392, lon: 10.6231 },
      cost: { display: '€5 · €10 combined Solferino ticket' },
      durationHours: 1.5,
      driveFromSaloMin: 30,
      bookingRequired: false,
      url: 'https://www.solferinoesanmartino.it/',
      featured: false,
    },
    {
      slug: 'castiglione-cri-museum',
      name: 'Castiglione delle Stiviere — International Red Cross Museum',
      category: 'culture-history',
      description: 'The third leg of the Red Cross trifecta. Castiglione is where civilians improvised the first triage hospital after Solferino — the practical event Dunant translated into an institution. The museum holds first-edition copies of A Memory of Solferino and original surgical instruments.',
      location: { label: 'Castiglione delle Stiviere', lat: 45.3892, lon: 10.4889 },
      cost: { display: '€5' },
      durationHours: 1.5,
      driveFromSaloMin: 35,
      bookingRequired: false,
      featured: false,
    },
    {
      slug: 'sirmione-grotte-di-catullo',
      name: 'Sirmione — Grotte di Catullo',
      category: 'culture-history',
      description: 'Ruins of a 1st-century Roman villa at the very tip of the Sirmione peninsula — one of the largest Roman residential sites in northern Italy. The "grottoes" are vaulted substructures. Olive groves on-site with a small museum.',
      location: { label: 'Sirmione', lat: 45.5044, lon: 10.6097 },
      cost: { display: '€8 adult' },
      durationHours: 1.5,
      driveFromSaloMin: 25,
      bookingRequired: false,
      featured: false,
    },
    {
      slug: 'sirmione-scaligero-castle',
      name: 'Sirmione — Scaligero Castle',
      category: 'culture-history',
      description: 'A rare moated medieval castle (13th century) guarding the entrance to the Sirmione peninsula — the moat is fed directly by the lake. Climb the keep for views over the old town and the lake.',
      location: { label: 'Sirmione', lat: 45.4956, lon: 10.6064 },
      cost: { display: '€6 adult' },
      durationHours: 1,
      driveFromSaloMin: 25,
      bookingRequired: false,
      featured: false,
    },

    // ── MOUNTAIN & CABLE CAR (1 beyond featured Monte Baldo) ───────────
    {
      slug: 'tremalzo-tremosine',
      name: 'Tremalzo / Tremosine — Cable Car & Plateau',
      category: 'mountain-cable-car',
      description: 'Tremosine sits on a high cliff plateau on the west shore. Drive up via the Strada della Forra (gorge road) and explore the village of Pieve di Tremosine and the Terrazza del Brivido cliff terrace.',
      location: { label: 'Tremosine sul Garda', lat: 45.7833, lon: 10.7167 },
      cost: { display: 'Free (driving access)' },
      durationHours: 3,
      driveFromSaloMin: 65,
      bookingRequired: false,
      featured: false,
    },

    // ── SCENIC (3) ─────────────────────────────────────────────────────
    {
      slug: 'strada-della-forra',
      name: 'Strada della Forra — Tremosine Gorge Road',
      category: 'scenic',
      description: 'A vertiginous 6 km road carved into a limestone gorge, climbing from the lakeshore at Riva di Tremosine to the village of Pieve. James Bond *Quantum of Solace* opening sequence. Drive it, stop at the gallery viewpoints.',
      location: { label: 'Tremosine sul Garda', lat: 45.7833, lon: 10.7167 },
      cost: { display: 'Free' },
      durationHours: 1,
      driveFromSaloMin: 60,
      bookingRequired: false,
      featured: false,
    },
    {
      slug: 'limone-sul-garda',
      name: 'Limone sul Garda',
      category: 'scenic',
      description: 'Lemon-grove village clinging to the west cliff. Restored 18th-century Limonaia del Castel (lemon house) on the lake. Pretty stone harbour. Connected to Riva by the cantilevered Garda by Bike cycle path.',
      location: { label: 'Limone sul Garda', lat: 45.8133, lon: 10.7867 },
      cost: { display: '€2 Limonaia entry · village free' },
      durationHours: 2.5,
      driveFromSaloMin: 70,
      bookingRequired: false,
      featured: false,
    },
    {
      slug: 'punta-san-vigilio',
      name: 'Punta San Vigilio',
      category: 'scenic',
      description: 'A tiny cypress-covered promontory on the east shore. Private chapel, 16th-century Villa Guarienti (locanda), and the small "Baia delle Sirene" bathing area. Quiet at sunset.',
      location: { label: 'Punta San Vigilio', lat: 45.5894, lon: 10.7233 },
      cost: { display: 'Free promontory · €15 Baia delle Sirene access' },
      durationHours: 2,
      driveFromSaloMin: 45,
      bookingRequired: false,
      featured: false,
    },

    // ── BIKE (2) ───────────────────────────────────────────────────────
    {
      slug: 'garda-by-bike-west-coast',
      name: 'Garda by Bike — West Coast Cliff Path',
      category: 'bike',
      description: 'Cantilevered cycle path bolted to the west cliff between Limone and Riva — opened in 2018, suspended 50 m over the water in places. ~2 km headline section, plus easy lakeshore connections each side. Rentable e-bikes nearby.',
      location: { label: 'Limone sul Garda', lat: 45.8133, lon: 10.7867 },
      cost: { display: 'Free path · €25–35 e-bike rental' },
      durationHours: 3,
      driveFromSaloMin: 70,
      bookingRequired: false,
      featured: false,
    },
    {
      slug: 'ebike-rental-salo',
      name: 'E-Bike Rental — Salò',
      category: 'bike',
      description: 'Multiple e-bike rental shops on the Salò waterfront. Lakeshore route south to Desenzano (~25 km) is mostly flat; west toward Gargnano (~20 km) is hilly with lake-view climbs.',
      location: { label: 'Salò', lat: 45.6063, lon: 10.5237 },
      cost: { display: '€25–35 per day' },
      durationHours: 6,
      driveFromSaloMin: 0,
      bookingRequired: false,
      featured: false,
    },

    // ── WINE (2) ───────────────────────────────────────────────────────
    {
      slug: 'lugana-doc-tasting',
      name: 'Lugana DOC Tasting',
      category: 'wine',
      description: 'The white-wine appellation just south of the lake (Sirmione/Desenzano peninsula). Trebbiano di Lugana grape; mineral, citrus, age-worthy whites. Visit a producer like Cà dei Frati or Ottella for cellar tour + tasting.',
      location: { label: 'Sirmione · Desenzano', lat: 45.4708, lon: 10.5378 },
      cost: { display: '€20–40 per tasting' },
      durationHours: 2,
      driveFromSaloMin: 25,
      bookingRequired: true,
      bookingNote: 'Book direct with the producer 2–3 days ahead.',
      featured: false,
    },
    {
      slug: 'bardolino-wine-route',
      name: 'Bardolino Wine Route',
      category: 'wine',
      description: 'East-shore red-wine appellation (Corvina, Rondinella — same grapes as Valpolicella). Drive the Strada del Vino through the gentle hills above Bardolino and Lazise; stop at producers for tasting flights.',
      location: { label: 'Bardolino', lat: 45.5489, lon: 10.7194 },
      cost: { display: '€15–30 per tasting' },
      durationHours: 4,
      driveFromSaloMin: 50,
      bookingRequired: true,
      bookingNote: 'Book each cellar visit individually.',
      featured: false,
    },

    // ── DAY TRIP (1) ───────────────────────────────────────────────────
    {
      slug: 'verona-day-trip',
      name: 'Verona Day Trip',
      category: 'day-trip',
      description: 'Roman Arena (still hosts opera in summer), Juliet\'s balcony at Casa di Giulietta, Castelvecchio museum, Piazza delle Erbe. ~1h drive from Salò; park outside the ZTL and walk the historic centre.',
      location: { label: 'Verona', lat: 45.4384, lon: 10.9916 },
      cost: { display: '€12 Arena · museums €5–8 each' },
      durationHours: 8,
      driveFromSaloMin: 60,
      bookingRequired: false,
      bookingNote: 'If opera is on at the Arena, book months ahead.',
      featured: false,
    },

    // ── AQUATIC PARK (1) ───────────────────────────────────────────────
    {
      slug: 'gardaland-caneva',
      name: 'Gardaland / Caneva Aquapark',
      category: 'aquatic-park',
      description: 'Italy\'s biggest theme park (Gardaland) and adjacent waterpark (Caneva) on the south-east shore. Useful change of pace; ~30 min from Salò. Combined tickets available.',
      location: { label: 'Castelnuovo del Garda', lat: 45.4528, lon: 10.7050 },
      cost: { display: '€45 Gardaland · €60 combined' },
      durationHours: 8,
      driveFromSaloMin: 35,
      bookingRequired: true,
      bookingNote: 'Book online for skip-the-line and a small discount.',
      url: 'https://www.gardaland.it/',
      featured: false,
    },

    // ── HIKING (1) ─────────────────────────────────────────────────────
    {
      slug: 'rocca-di-manerba',
      name: 'Rocca di Manerba',
      category: 'hiking',
      description: 'Short hike (~30 min up) to a 13th-century rock fortress jutting over the lake. Easy walk on a marked path. Great late-afternoon light over the south basin.',
      location: { label: 'Manerba del Garda', lat: 45.5489, lon: 10.5631 },
      cost: { display: 'Free' },
      durationHours: 1.5,
      driveFromSaloMin: 15,
      bookingRequired: false,
      featured: false,
    },
  ];
  return activities.map((a) => ({
    relPath: `src/content/activities/${a.slug}.yaml`,
    content: toYAML(a).trim() + '\n',
  }));
}

function emitActivities() {
  for (const r of buildActivities()) {
    writeFile(r.relPath, r.content);
  }
}

export function buildGardaDayStubs() {
  // Pull the return-flight depart string straight from the same source
  // emitTrip() uses, so the two never drift out of sync.
  const returnDepart = '2026-07-27T19:10';
  const departTime = returnDepart.slice(11, 16);
  const arriveBy = '16:00';
  const SALO = { lat: 45.6063, lon: 10.5237, label: 'Salò' };

  const records = [];

  const freeFormDates = ['2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26'];
  for (const date of freeFormDates) {
    const stub = {
      date,
      theme: 'Free day at Lake Garda',
      driving: { legs: [] },
      schedule: [],
      hikeSlugs: [],
      lodgingSlug: 'salo-airbnb',
      weatherFor: SALO,
    };
    records.push({
      relPath: `src/content/days/${date}-free-day-lake-garda.md`,
      content: `---\n${toYAML(stub).trim()}\n---\n\n`,
    });
  }

  const dep = {
    date: '2026-07-27',
    theme: 'Departure — drive to VCE',
    driving: {
      legs: [{
        from: 'Salò',
        to: 'Venice Marco Polo Airport (VCE)',
        distanceKm: 175,
        durationMin: 130,
        notes: `Aim to arrive by ${arriveBy} for the ${departTime} flight; allow buffer for traffic`,
      }],
    },
    schedule: [],
    hikeSlugs: [],
    lodgingSlug: 'salo-airbnb',
    weatherFor: SALO,
  };
  records.push({
    relPath: `src/content/days/2026-07-27-departure-drive-to-vce.md`,
    content: `---\n${toYAML(dep).trim()}\n---\n\n`,
  });

  return records;
}

function emitGardaDayStubs() {
  for (const r of buildGardaDayStubs()) {
    const target = path.join(ROOT, r.relPath);
    if (fs.existsSync(target)) {
      console.log(`  · ${r.relPath} already exists — skipping`);
      continue;
    }
    writeFile(r.relPath, r.content);
  }
}

// --- Main ---

export async function runMigration() {
  const md = fs.readFileSync(SOURCE, 'utf8');
  const days = parseDays(md);
  const hikes = parseHikes(md);
  const bookings = parseBookings(md);
  console.log(`Parsed ${days.length} days, ${hikes.length} hikes, ${bookings.length} bookings.`);

  console.log('Emitting trip metadata...'); emitTrip();
  console.log('Emitting lodgings...'); emitLodgings();
  console.log('Emitting restaurants...'); emitRestaurants();
  console.log('Emitting activities...'); emitActivities();
  console.log('Emitting days...'); for (const d of days) emitDay(d);
  console.log('Emitting Garda day stubs...'); emitGardaDayStubs();
  console.log('Emitting hikes...'); for (const h of hikes) emitHike(h);
  console.log('Emitting bookings...'); emitBookings(bookings);
  console.log('Done.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(e => { console.error(e); process.exit(1); });
}
