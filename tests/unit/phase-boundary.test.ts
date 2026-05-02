import { describe, it, expect } from 'vitest';
import { phaseBoundary, isInPhaseII } from '@/lib/phase';

const tripWithPhases = {
  endDate: '2026-07-27',
  phases: [
    { id: 'dolomites', start: '2026-07-15', end: '2026-07-20' },
    { id: 'garda', start: '2026-07-20', end: '2026-07-27' },
  ],
};

const tripWithoutPhases = {
  endDate: '2026-07-27',
};

describe('phaseBoundary', () => {
  it('returns the garda phase start when phases is set', () => {
    expect(phaseBoundary(tripWithPhases)).toBe('2026-07-20');
  });

  it('falls back to trip.endDate when phases is omitted', () => {
    expect(phaseBoundary(tripWithoutPhases)).toBe('2026-07-27');
  });

  it('falls back when phases exists but has no garda entry', () => {
    expect(phaseBoundary({
      endDate: '2026-07-27',
      phases: [{ id: 'dolomites', start: '2026-07-15', end: '2026-07-20' }],
    })).toBe('2026-07-27');
  });
});

describe('isInPhaseII', () => {
  it('false on the day before the boundary', () => {
    expect(isInPhaseII(tripWithPhases, '2026-07-19')).toBe(false);
  });

  it('true on the boundary day itself', () => {
    expect(isInPhaseII(tripWithPhases, '2026-07-20')).toBe(true);
  });

  it('true mid-Phase II', () => {
    expect(isInPhaseII(tripWithPhases, '2026-07-26')).toBe(true);
  });

  it('true after the trip ends', () => {
    expect(isInPhaseII(tripWithPhases, '2026-08-01')).toBe(true);
  });

  it('with no phases set, only true after endDate', () => {
    expect(isInPhaseII(tripWithoutPhases, '2026-07-26')).toBe(false);
    expect(isInPhaseII(tripWithoutPhases, '2026-07-28')).toBe(true);
  });
});
