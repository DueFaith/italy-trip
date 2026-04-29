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
  if (l.includes('cable car') || l.includes('seceda')) return 'cable-car';
  if (l.includes('rental') || l.includes('greenmotion') || l.includes('car')) return 'car';
  if (l.includes('parking')) return 'parking';
  if (l.includes('hotel') || l.includes('baita') || l.includes('kircher') || l.includes('airbnb')) return 'lodging';
  if (l.includes('dinner') || l.includes('restaurant')) return 'restaurant';
  return 'other';
}

function writeFile(rel, content) {
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  console.log(`  ✓ ${rel}`);
}

function emitDay(day) {
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
    name: 'Dolomites',
    startDate: '2026-07-15',
    endDate: '2026-07-20',
    travelers: ['Kevin', '+ party'],
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
      address: 'Via Rosengarten 30, Barbiano (Barbian), BZ 39040',
      lat: 46.6109,
      lon: 11.5226,
      bookingUrl: 'https://www.booking.com/hotel/it/gasthof-albergo-kircher-sepp.html',
      notes: 'Family-run. Ask for balcony room facing Dolomites.',
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
        { name: 'Ospitale', type: 'Old stagecoach inn', priceRange: '$$', needsReservation: true, notes: '8 km north of Cortina.' },
        { name: 'Enoteca Baita Fraina', type: 'Wine bar / aperitivo', priceRange: '$', needsReservation: false, notes: 'Sister wine bar in town centre.' },
        { name: 'Panificio Alvera', type: 'Bakery', priceRange: '$', needsReservation: false, notes: 'Trail sandwiches and pastries.' },
      ],
    },
    {
      area: 'Brixen / Eisacktal',
      items: [
        { name: 'Vitis (Brixen)', type: 'Modern South Tyrolean tasting menu', priceRange: '$$$', needsReservation: true },
        { name: 'Decantei (Brixen)', type: 'Wine bar with small plates', priceRange: '$$', needsReservation: false },
        { name: "Hofschank Klausnerhof (Klausen)", type: "Hyper-traditional, locals' favourite", priceRange: '$$', needsReservation: true },
        { name: 'Sunnegg (Brixen)', type: 'Panoramic spot above town', priceRange: '$$', needsReservation: true },
      ],
    },
    {
      area: 'Ortisei (Val Gardena)',
      items: [
        { name: 'Cascade', type: 'Mid-range reliable', priceRange: '$$', needsReservation: false },
        { name: 'Bar Anna', type: 'Quick panini and coffee', priceRange: '$', needsReservation: false },
        { name: 'Restaurant Concordia', type: 'Traditional Ladin', priceRange: '$$', needsReservation: false },
      ],
    },
  ];
  for (const g of groups) {
    writeFile(`src/content/restaurants/${slugify(g.area)}.yaml`, toYAML(g).trim() + '\n');
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
  console.log('Emitting days...'); for (const d of days) emitDay(d);
  console.log('Emitting hikes...'); for (const h of hikes) emitHike(h);
  console.log('Emitting bookings...'); emitBookings(bookings);
  console.log('Done.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(e => { console.error(e); process.exit(1); });
}
