import { describe, it, expect } from 'vitest';
import { parseDays, parseHikes, parseBookings, parseDriveLegs, buildActivities, buildGardaDayStubs } from '../../scripts/migrate-itinerary.mjs';
import fs from 'node:fs';

const md = fs.readFileSync('dolomites-garda-itinerary.md', 'utf8');

describe('migration parser', () => {
  it('parses 6 days with dates', () => {
    const days = parseDays(md);
    expect(days).toHaveLength(6);
    expect(days[0].date).toBe('2026-07-15');
    expect(days[5].date).toBe('2026-07-20');
  });

  it('extracts hike slugs referenced from days', () => {
    const days = parseDays(md);
    expect(days[1].hikeSlugs).toContain('tre-cime');
    expect(days[3].hikeSlugs).toEqual(expect.arrayContaining(['lago-di-braies', 'cadini']));
  });

  it('parses 6 hikes', () => {
    const hikes = parseHikes(md);
    expect(hikes.map(h => h.slug).sort()).toEqual(
      ['alpe-di-siusi-family', 'cadini', 'lago-di-braies', 'seceda-firenze', 'sorapis', 'tre-cime'].sort()
    );
  });

  it('parses 11 booking items', () => {
    const bookings = parseBookings(md);
    expect(bookings.length).toBe(11);
  });

  it('applies real-data correction: car pickup time is 15:00', () => {
    const days = parseDays(md);
    const day1Schedule = days[0].schedule.map(s => s.action.toLowerCase()).join(' ');
    expect(day1Schedule).not.toContain('13:00');
  });
});

describe('parseDriveLegs', () => {
  it('parses a single-leg block', () => {
    const block = `
something else
**Drive legs:**
- Cortina · Baita Fraina → Rifugio Auronzo — 25 km / 45 min
**Hikes:**`;
    expect(parseDriveLegs(block)).toEqual([
      { from: 'Cortina · Baita Fraina', to: 'Rifugio Auronzo', distanceKm: 25, durationMin: 45 },
    ]);
  });

  it('parses a multi-leg block (Day 4 shape)', () => {
    const block = `
**Drive legs:**
- Cortina → Lago di Braies P3 — 50 km / 55 min
- Lago di Braies → Rifugio Auronzo (Cadini) — 42 km / 1h 0m
- Rifugio Auronzo → Pension Kircher Sepp (Barbiano) — 111 km / 2h 15m
**Hikes:**`;
    const legs = parseDriveLegs(block);
    expect(legs).toHaveLength(3);
    expect(legs[0]).toEqual({ from: 'Cortina', to: 'Lago di Braies P3', distanceKm: 50, durationMin: 55 });
    expect(legs[1]).toEqual({ from: 'Lago di Braies', to: 'Rifugio Auronzo (Cadini)', distanceKm: 42, durationMin: 60 });
    expect(legs[2]).toEqual({ from: 'Rifugio Auronzo', to: 'Pension Kircher Sepp (Barbiano)', distanceKm: 111, durationMin: 135 });
  });

  it('returns empty array if no legs block present', () => {
    expect(parseDriveLegs('no driving here')).toEqual([]);
  });
});

describe('buildActivities', () => {
  it('returns 22 records with unique slugs', () => {
    const records = buildActivities();
    expect(records).toHaveLength(22);
    const slugs = records.map((r) => r.relPath.replace(/^src\/content\/activities\//, '').replace(/\.yaml$/, ''));
    expect(new Set(slugs).size).toBe(22);
  });

  it('every record has a non-empty content body and a YAML extension', () => {
    for (const r of buildActivities()) {
      expect(r.relPath).toMatch(/^src\/content\/activities\/[a-z0-9-]+\.yaml$/);
      expect(r.content.length).toBeGreaterThan(0);
    }
  });

  it('contains the featured slugs', () => {
    const slugs = buildActivities().map((r) => r.relPath);
    expect(slugs).toEqual(expect.arrayContaining([
      'src/content/activities/solferino-red-cross-memorial.yaml',
      'src/content/activities/garda-rent-boat-jetski.yaml',
      'src/content/activities/vittoriale-degli-italiani.yaml',
      'src/content/activities/monte-baldo-cable-car.yaml',
    ]));
  });
});

describe('buildGardaDayStubs', () => {
  it('returns 7 records (Jul 21..27)', () => {
    const records = buildGardaDayStubs();
    expect(records).toHaveLength(7);
  });

  it('records target paths under src/content/days/', () => {
    for (const r of buildGardaDayStubs()) {
      expect(r.relPath).toMatch(/^src\/content\/days\/2026-07-2[1-7]-[a-z-]+\.md$/);
    }
  });

  it('day 27 record contains the literal flight time 19:10', () => {
    const dep = buildGardaDayStubs().find((r) => r.relPath.includes('2026-07-27'));
    expect(dep).toBeDefined();
    expect(dep.content).toContain('19:10');
    expect(dep.content).toContain('Venice Marco Polo Airport');
  });

  it('all stubs reference lodgingSlug salo-airbnb', () => {
    for (const r of buildGardaDayStubs()) {
      expect(r.content).toContain('lodgingSlug: salo-airbnb');
    }
  });

  it('Jul 21..26 records have empty hikeSlugs and empty schedule', () => {
    const freeForm = buildGardaDayStubs().filter((r) => !r.relPath.includes('2026-07-27'));
    expect(freeForm).toHaveLength(6);
    for (const r of freeForm) {
      expect(r.content).toContain('hikeSlugs: []');
      expect(r.content).toContain('schedule: []');
    }
  });
});
