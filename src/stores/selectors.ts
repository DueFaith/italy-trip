import type { DayShape, HikeShape, LocalState } from './types';

export const mergeDay = (canonical: DayShape, state: LocalState): DayShape => {
  const edit = state.dayEdits[canonical.date];
  return edit ? { ...canonical, ...edit } : canonical;
};

export const mergeHike = (canonical: HikeShape, state: LocalState): HikeShape => {
  const edit = state.hikeEdits[canonical.slug];
  return edit ? { ...canonical, ...edit } : canonical;
};

export const listEffectiveDays = (canonicalDays: DayShape[], state: LocalState): DayShape[] => {
  const merged = canonicalDays.map((d) => mergeDay(d, state));
  const all = [...merged, ...Object.values(state.customDays)];
  return all.sort((a, b) => a.date.localeCompare(b.date));
};

export const listEffectiveHikes = (canonicalHikes: HikeShape[], state: LocalState): HikeShape[] => {
  const merged = canonicalHikes.map((h) => mergeHike(h, state));
  return [...merged, ...Object.values(state.customHikes)];
};
