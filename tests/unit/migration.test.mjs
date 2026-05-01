import { describe, it, expect } from 'vitest';
import { parseDays, parseHikes, parseBookings, parseDriveLegs } from '../../scripts/migrate-itinerary.mjs';
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
