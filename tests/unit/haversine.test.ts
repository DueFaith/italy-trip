import { describe, it, expect } from 'vitest';
import { haversineKm } from '@/lib/geo';

const SALO = { lat: 45.6063, lon: 10.5237 };
const SIRMIONE = { lat: 45.4951, lon: 10.6065 };
const VERONA = { lat: 45.4384, lon: 10.9916 };

describe('haversineKm', () => {
  it('returns Salò → Sirmione ≈ 14 km (±1)', () => {
    const d = haversineKm(SALO.lat, SALO.lon, SIRMIONE.lat, SIRMIONE.lon);
    expect(d).toBeGreaterThan(13);
    expect(d).toBeLessThan(15);
  });

  it('returns Salò → Verona ≈ 41 km (±2)', () => {
    const d = haversineKm(SALO.lat, SALO.lon, VERONA.lat, VERONA.lon);
    expect(d).toBeGreaterThan(39);
    expect(d).toBeLessThan(43);
  });

  it('returns 0 for the same point', () => {
    expect(haversineKm(SALO.lat, SALO.lon, SALO.lat, SALO.lon)).toBe(0);
  });

  it('is symmetric — d(A,B) === d(B,A)', () => {
    const d1 = haversineKm(SALO.lat, SALO.lon, VERONA.lat, VERONA.lon);
    const d2 = haversineKm(VERONA.lat, VERONA.lon, SALO.lat, SALO.lon);
    expect(d1).toBeCloseTo(d2, 9);
  });

  it('antipodal sanity: ~ half earth circumference (within 100 km)', () => {
    const halfCircumference = Math.PI * 6371;
    const d = haversineKm(SALO.lat, SALO.lon, -SALO.lat, SALO.lon - 180);
    expect(Math.abs(d - halfCircumference)).toBeLessThan(100);
  });
});
