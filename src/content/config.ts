import { z, defineCollection } from 'astro:content';

const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const ISODateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Use ISO datetime');
const HHMM = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');

const FlightLeg = z.object({
  flightNumber: z.string(),
  from: z.string(),
  to: z.string(),
  depart: ISODateTime,
  arrive: ISODateTime,
  airline: z.string().optional(),
  operatedBy: z.string().optional(),
});

export const TripSchema = z.object({
  name: z.string(),
  startDate: ISODate,
  endDate: ISODate,
  travelers: z.array(z.string()),
  flights: z.object({ outbound: z.array(FlightLeg), return: z.array(FlightLeg) }),
  rentalCar: z.object({
    provider: z.string(),
    confirmationNumber: z.string(),
    model: z.string(),
    pickup: z.object({
      time: ISODateTime,
      location: z.string(),
      address: z.string(),
      phone: z.string(),
    }),
    dropoff: z.object({ time: ISODateTime, location: z.string() }),
    insurance: z.string(),
    cost: z.object({ amount: z.number(), currency: z.string() }),
  }),
});

export const DaySchema = z.object({
  date: ISODate,
  theme: z.string(),
  driving: z.object({ distanceKm: z.number(), durationMin: z.number(), notes: z.string().optional() }),
  schedule: z.array(z.object({ time: HHMM, action: z.string() })),
  hikeSlugs: z.array(z.string()),
  lodgingSlug: z.string(),
  weatherFor: z.object({ lat: z.number(), lon: z.number(), label: z.string() }),
  badWeatherOption: z.string().optional(),
});

export const HikeSchema = z.object({
  slug: z.string().optional(),
  name: z.string(),
  region: z.string(),
  alltrailsUrl: z.string().url().optional(),
  distanceKm: z.number(),
  elevationGainM: z.number(),
  movingTimeHours: z.object({ min: z.number(), max: z.number() }),
  totalTimeHours: z.object({ min: z.number(), max: z.number() }),
  difficulty: z.enum(['easy', 'moderate', 'hard']),
  rating: z.object({ stars: z.number(), reviews: z.number() }).nullable().optional(),
  type: z.enum(['loop', 'out-and-back', 'point-to-point']),
  trailhead: z.object({ name: z.string(), lat: z.number(), lon: z.number(), addr: z.string().optional() }),
  parking: z.object({
    name: z.string(),
    costEur: z.number(),
    mustBook: z.boolean(),
    bookingUrl: z.string().url().optional(),
    bookingOpensDaysBefore: z.number().optional(),
    capacity: z.string().optional(),
    alternative: z.string().optional(),
  }),
  cableCar: z.object({ name: z.string(), url: z.string().url(), costEur: z.number(), mustBook: z.boolean() }).optional(),
  routeHighlights: z.array(z.string()),
  foodOnTrail: z.array(z.object({ name: z.string(), notes: z.string() })),
  hazards: z.array(z.string()),
  badWeatherOption: z.string().optional(),
});

export const LodgingSchema = z.object({
  slug: z.string(),
  name: z.string(),
  location: z.string(),
  checkIn: ISODateTime,
  checkOut: ISODateTime,
  nights: z.number(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string(),
  lat: z.number(),
  lon: z.number(),
  bookingUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

export const RestaurantSchema = z.object({
  area: z.string(),
  items: z.array(z.object({
    name: z.string(),
    type: z.string(),
    priceRange: z.enum(['$', '$$', '$$$']).optional(),
    needsReservation: z.boolean(),
    phone: z.string().optional(),
    address: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    notes: z.string().optional(),
  })),
});

export const BookingSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(['flight', 'car', 'lodging', 'parking', 'cable-car', 'restaurant', 'other']),
  status: z.enum(['booked', 'pending-window', 'not-needed']),
  bookingOpens: ISODate.optional(),
  bookingUrl: z.string().url().optional(),
  costEur: z.number().optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const collections = {
  days: defineCollection({ type: 'content', schema: DaySchema }),
  hikes: defineCollection({ type: 'content', schema: HikeSchema }),
  lodgings: defineCollection({ type: 'data', schema: LodgingSchema }),
  restaurants: defineCollection({ type: 'data', schema: RestaurantSchema }),
};
