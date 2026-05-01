export type ScheduleItem = { time: string; action: string };

export type DriveLeg = {
  from: string;
  to: string;
  distanceKm: number;
  durationMin: number;
  notes?: string;
};

export type DayShape = {
  date: string;
  theme: string;
  driving: { legs: DriveLeg[] };
  schedule: ScheduleItem[];
  hikeSlugs: string[];
  lodgingSlug: string;
  weatherFor: { lat: number; lon: number; label: string };
  badWeatherOption?: string;
};

export type HikeShape = {
  slug: string;
  name: string;
  region: string;
  alltrailsUrl?: string;
  distanceKm: number;
  elevationGainM: number;
  movingTimeHours: { min: number; max: number };
  totalTimeHours: { min: number; max: number };
  difficulty: 'easy' | 'moderate' | 'hard';
  type: 'loop' | 'out-and-back' | 'point-to-point';
  trailhead: { name: string; lat: number; lon: number; addr?: string };
  parking: { name: string; costEur: number; mustBook: boolean; bookingUrl?: string };
  routeHighlights: string[];
  foodOnTrail: { name: string; notes: string }[];
  hazards: string[];
};

export type BookingState = {
  checked: boolean;
  confirmation?: string;
  bookedAt?: string;
};

export type LocalState = {
  trip?: { name?: string };
  hikeEdits: Record<string, Partial<HikeShape>>;
  dayEdits: Record<string, Partial<DayShape>>;
  customHikes: Record<string, HikeShape>;
  customDays: Record<string, DayShape>;
  bookings: Record<string, BookingState>;
  schemaVersion: 1;
  lastEditedAt?: string;
};

export const EMPTY_STATE: LocalState = {
  hikeEdits: {},
  dayEdits: {},
  customHikes: {},
  customDays: {},
  bookings: {},
  schemaVersion: 1,
};

export const isCustomized = (s: LocalState): boolean =>
  Object.keys(s.hikeEdits).length > 0 ||
  Object.keys(s.dayEdits).length > 0 ||
  Object.keys(s.customHikes).length > 0 ||
  Object.keys(s.customDays).length > 0 ||
  Object.keys(s.bookings).length > 0;
