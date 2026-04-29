import { describe, it, expect } from 'vitest';
import { parseDays, parseHikes, parseBookings } from '../../scripts/migrate-itinerary.mjs';
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
