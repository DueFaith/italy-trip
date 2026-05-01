import { describe, it, expect } from 'vitest';
import { TripSchema, DaySchema, HikeSchema, LodgingSchema, BookingSchema } from '@/content/config';

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
      driving: { distanceKm: 50, durationMin: 90 },
      schedule: [{ time: '07:00', action: 'Wake' }],
      hikeSlugs: ['tre-cime'],
      lodgingSlug: 'baita-fraina',
      weatherFor: { lat: 46.6, lon: 12.3, label: 'Cortina' },
    };
    expect(DaySchema.parse(day)).toEqual(day);
  });
});
