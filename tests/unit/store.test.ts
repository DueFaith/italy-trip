import { describe, it, expect, beforeEach } from 'vitest';
import { useLocalState } from '@/stores/localState';
import { EMPTY_STATE, isCustomized } from '@/stores/types';

describe('localState store', () => {
  beforeEach(() => {
    useLocalState.setState(EMPTY_STATE);
  });

  it('starts empty and uncustomized', () => {
    expect(isCustomized(useLocalState.getState())).toBe(false);
  });

  it('editHike merges field overrides', () => {
    useLocalState.getState().editHike('tre-cime', { distanceKm: 12 });
    useLocalState.getState().editHike('tre-cime', { elevationGainM: 500 });
    expect(useLocalState.getState().hikeEdits['tre-cime']).toEqual({ distanceKm: 12, elevationGainM: 500 });
    expect(isCustomized(useLocalState.getState())).toBe(true);
  });

  it('moveHikeToDay rewrites hikeSlugs lists', () => {
    useLocalState.getState().moveHikeToDay('tre-cime', '2026-07-16', '2026-07-17', ['tre-cime'], ['sorapis']);
    const edits = useLocalState.getState().dayEdits;
    expect(edits['2026-07-16'].hikeSlugs).toEqual([]);
    expect(edits['2026-07-17'].hikeSlugs).toEqual(['sorapis', 'tre-cime']);
  });

  it('reset clears everything', () => {
    useLocalState.getState().editHike('tre-cime', { distanceKm: 12 });
    useLocalState.getState().reset();
    expect(isCustomized(useLocalState.getState())).toBe(false);
  });
});
