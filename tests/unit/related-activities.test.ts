import { describe, it, expect } from 'vitest';
import { sharedSlugPrefix } from '@/lib/related';

describe('sharedSlugPrefix', () => {
  it('returns 3 for "garda-rent-boat-jetski" + "garda-rent-boat-rental" (same business)', () => {
    expect(sharedSlugPrefix('garda-rent-boat-jetski', 'garda-rent-boat-rental')).toBe(3);
  });

  it('returns 1 for two Sirmione attractions (same town, different attractions)', () => {
    expect(sharedSlugPrefix('sirmione-grotte-di-catullo', 'sirmione-scaligero-castle')).toBe(1);
  });

  it('returns 0 for completely different slugs', () => {
    expect(sharedSlugPrefix('a', 'b')).toBe(0);
    expect(sharedSlugPrefix('verona-day-trip', 'rocca-di-manerba')).toBe(0);
  });

  it('returns the full token count for identical slugs', () => {
    expect(sharedSlugPrefix('foo-bar', 'foo-bar')).toBe(2);
    expect(sharedSlugPrefix('one-two-three-four', 'one-two-three-four')).toBe(4);
  });

  it('handles single-token slugs', () => {
    expect(sharedSlugPrefix('foo', 'foo')).toBe(1);
    expect(sharedSlugPrefix('foo', 'bar')).toBe(0);
  });

  it('is symmetric: sharedSlugPrefix(a, b) === sharedSlugPrefix(b, a)', () => {
    const a = 'sirmione-grotte-di-catullo';
    const b = 'sirmione-scaligero-castle';
    expect(sharedSlugPrefix(a, b)).toBe(sharedSlugPrefix(b, a));
  });
});
