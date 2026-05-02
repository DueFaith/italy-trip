// Trip-phase derivation. Single source of truth for "where the Garda phase
// starts" — derived from trip.phases (set in trip.yaml) with a safe fallback
// to trip.endDate (i.e. "Phase II never starts") if phases is removed.

type TripLike = {
  endDate: string;
  phases?: Array<{ id: string; start: string; end: string }>;
};

export function phaseBoundary(trip: TripLike): string {
  return trip.phases?.find((p) => p.id === 'garda')?.start ?? trip.endDate;
}

export function isInPhaseII(trip: TripLike, todayISO: string): boolean {
  return todayISO >= phaseBoundary(trip);
}
