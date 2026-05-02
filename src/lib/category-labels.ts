// Single source of truth for human-readable activity category labels.
// Used by /activities catalog filter pills and the Breadcrumb on /activities/[slug].
// Keys match the ActivitySchema category enum in src/content/config.ts.

export type ActivityCategory =
  | 'water-sports'
  | 'culture-history'
  | 'mountain-cable-car'
  | 'scenic'
  | 'bike'
  | 'wine'
  | 'day-trip'
  | 'aquatic-park'
  | 'hiking';

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  'water-sports': 'Water Sports',
  'culture-history': 'Culture & History',
  'mountain-cable-car': 'Mountain & Cable Car',
  'scenic': 'Scenic',
  'bike': 'Bike',
  'wine': 'Wine',
  'day-trip': 'Day Trip',
  'aquatic-park': 'Aquatic Park',
  'hiking': 'Hiking',
};
