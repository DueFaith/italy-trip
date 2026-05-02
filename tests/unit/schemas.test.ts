import { describe, it, expect } from 'vitest';
import { TripSchema, DaySchema, HikeSchema, LodgingSchema, BookingSchema, ActivitySchema } from '@/content/config';

describe('BookingSchema relatedHikeSlug', () => {
  it('accepts a booking with a relatedHikeSlug', () => {
    const b = {
      id: 'b-7',
      label: 'Tre Cime parking',
      category: 'parking',
      status: 'pending-window',
      relatedHikeSlug: 'tre-cime',
    };
    expect(BookingSchema.parse(b)).toEqual(b);
  });

  it('makes relatedHikeSlug optional', () => {
    const b = { id: 'b-1', label: 'Flight', category: 'flight', status: 'booked' };
    expect(() => BookingSchema.parse(b)).not.toThrow();
  });
});

describe('content schemas', () => {
  it('accepts a valid trip', () => {
    const trip = {
      name: 'Dolomites',
      startDate: '2026-07-15',
      endDate: '2026-07-20',
      travelers: ['Kevin', '+ party'],
      flights: { outbound: [], return: [] },
      rentalCar: {
        provider: 'Greenmotion',
        confirmationNumber: '798336606',
        model: 'Peugeot 308 or similar',
        pickup: { time: '2026-07-15T15:00', location: 'VCE', address: 'Via Orlanda 219', phone: '+390418040448' },
        dropoff: { time: '2026-07-27T18:00', location: 'VCE' },
        insurance: 'Zurich Full Insurance EEA',
        cost: { amount: 6284, currency: 'SEK' },
      },
    };
    expect(TripSchema.parse(trip)).toEqual(trip);
  });

  it('rejects invalid hike difficulty', () => {
    const bad = { slug: 'x', name: 'X', region: 'X', distanceKm: 1, elevationGainM: 1,
      movingTimeHours: { min: 1, max: 1 }, totalTimeHours: { min: 1, max: 1 },
      difficulty: 'extreme', type: 'loop',
      trailhead: { name: 'X', lat: 0, lon: 0 }, parking: { name: 'X', costEur: 0, mustBook: false },
      routeHighlights: [], foodOnTrail: [], hazards: [] };
    expect(() => HikeSchema.parse(bad)).toThrow();
  });

  it('day requires hikeSlugs as string array', () => {
    const day = {
      date: '2026-07-16', theme: 'Test',
      driving: { legs: [{ from: 'A', to: 'B', distanceKm: 50, durationMin: 90 }] },
      schedule: [{ time: '07:00', action: 'Wake' }],
      hikeSlugs: ['tre-cime'],
      lodgingSlug: 'baita-fraina',
      weatherFor: { lat: 46.6, lon: 12.3, label: 'Cortina' },
    };
    expect(DaySchema.parse(day)).toEqual(day);
  });

  it('day accepts a driving.legs array', () => {
    const day = {
      date: '2026-07-18', theme: 'Test',
      driving: {
        legs: [
          { from: 'Cortina', to: 'Braies', distanceKm: 50, durationMin: 55 },
          { from: 'Braies', to: 'Cadini', distanceKm: 42, durationMin: 60, notes: 'Toll road' },
        ],
      },
      schedule: [],
      hikeSlugs: ['lago-di-braies', 'cadini'],
      lodgingSlug: 'pension-kircher-sepp',
      weatherFor: { lat: 46.6, lon: 12.3, label: 'Cortina' },
    };
    expect(DaySchema.parse(day)).toEqual(day);
  });

  it('day rejects the legacy single-leg driving shape', () => {
    const day = {
      date: '2026-07-16', theme: 'Test',
      driving: { distanceKm: 50, durationMin: 90 },
      schedule: [], hikeSlugs: [], lodgingSlug: 'baita-fraina',
      weatherFor: { lat: 46.5, lon: 12.1, label: 'Cortina' },
    };
    expect(() => DaySchema.parse(day)).toThrow();
  });
});

describe('ActivitySchema', () => {
  const validBase = {
    slug: 'demo',
    name: 'Demo Activity',
    category: 'culture-history' as const,
    description: 'A test activity for schema validation.',
    location: { label: 'Salò', lat: 45.6063, lon: 10.5237 },
    cost: { display: '€10' },
    bookingRequired: false,
  };

  it('accepts a minimal valid activity', () => {
    expect(() => ActivitySchema.parse(validBase)).not.toThrow();
  });

  it('accepts a featured activity with bookingNote and url', () => {
    const a = {
      ...validBase,
      slug: 'featured-demo',
      featured: true,
      bookingRequired: true,
      bookingNote: 'Reserve 2 days ahead',
      url: 'https://example.com/booking',
      durationHours: 2,
      driveFromSaloMin: 25,
    };
    expect(() => ActivitySchema.parse(a)).not.toThrow();
  });

  it('defaults featured to false when omitted', () => {
    const parsed = ActivitySchema.parse(validBase);
    expect(parsed.featured).toBe(false);
  });

  it('rejects a missing required field (name)', () => {
    const { name, ...withoutName } = validBase;
    expect(() => ActivitySchema.parse(withoutName)).toThrow();
  });

  it('rejects an invalid category enum value', () => {
    const a = { ...validBase, category: 'made-up-category' };
    expect(() => ActivitySchema.parse(a)).toThrow();
  });

  it('rejects a malformed url', () => {
    const a = { ...validBase, url: 'not-a-url' };
    expect(() => ActivitySchema.parse(a)).toThrow();
  });
});
