import { describe, it, expect } from 'vitest';
import { mergeDay, mergeHike, listEffectiveDays } from '@/stores/selectors';
import type { DayShape, HikeShape, LocalState } from '@/stores/types';

const baseDay: DayShape = {
  date: '2026-07-16', theme: 'Tre Cime',
  driving: { distanceKm: 50, durationMin: 90 },
  schedule: [], hikeSlugs: ['tre-cime'], lodgingSlug: 'baita-fraina',
  weatherFor: { lat: 0, lon: 0, label: '' },
};

const baseHike: HikeShape = {
  slug: 'tre-cime', name: 'Tre Cime', region: 'Veneto',
  distanceKm: 10.3, elevationGainM: 425,
  movingTimeHours: { min: 4, max: 5 }, totalTimeHours: { min: 5, max: 6 },
  difficulty: 'moderate', type: 'loop',
  trailhead: { name: 'X', lat: 0, lon: 0 },
  parking: { name: 'X', costEur: 40, mustBook: true },
  routeHighlights: [], foodOnTrail: [], hazards: [],
};

const empty: LocalState = {
  hikeEdits: {}, dayEdits: {}, customHikes: {}, customDays: {}, bookings: {}, schemaVersion: 1,
};

describe('selectors', () => {
  it('mergeDay returns canonical when no edits', () => {
    expect(mergeDay(baseDay, empty)).toEqual(baseDay);
  });

  it('mergeDay applies dayEdits override', () => {
    const state: LocalState = { ...empty, dayEdits: { '2026-07-16': { theme: 'Custom theme' } } };
    expect(mergeDay(baseDay, state).theme).toBe('Custom theme');
  });

  it('mergeHike applies hikeEdits override', () => {
    const state: LocalState = { ...empty, hikeEdits: { 'tre-cime': { distanceKm: 12 } } };
    expect(mergeHike(baseHike, state).distanceKm).toBe(12);
  });

  it('listEffectiveDays merges canonical + custom + sorts by effective date', () => {
    const customDay: DayShape = { ...baseDay, date: '2026-07-22', theme: 'Custom' };
    const state: LocalState = {
      ...empty,
      customDays: { '2026-07-22': customDay },
      dayEdits: { '2026-07-16': { date: '2026-07-21' } },
    };
    const result = listEffectiveDays([baseDay], state);
    expect(result.map((d) => d.date)).toEqual(['2026-07-21', '2026-07-22']);
  });
});
