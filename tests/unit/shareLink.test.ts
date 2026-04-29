import { describe, it, expect } from 'vitest';
import { encodeState, decodeState } from '@/stores/shareLink';
import { EMPTY_STATE } from '@/stores/types';

describe('share link', () => {
  it('roundtrips an empty state', () => {
    const encoded = encodeState(EMPTY_STATE);
    expect(decodeState(encoded)).toEqual(EMPTY_STATE);
  });

  it('roundtrips a state with edits', () => {
    const state = { ...EMPTY_STATE, hikeEdits: { 'tre-cime': { distanceKm: 12 } } };
    const encoded = encodeState(state);
    const decoded = decodeState(encoded);
    expect(decoded!.hikeEdits['tre-cime'].distanceKm).toBe(12);
  });

  it('returns null for malformed input', () => {
    expect(decodeState('not-base64!@#$%')).toBeNull();
  });

  it('encoded length stays reasonable for typical edits', () => {
    const state = {
      ...EMPTY_STATE,
      hikeEdits: { 'tre-cime': { distanceKm: 11 }, 'sorapis': { distanceKm: 13 } },
      bookings: { 'b-1': { checked: true } },
    };
    const encoded = encodeState(state);
    expect(encoded.length).toBeLessThan(2000);
  });
});
