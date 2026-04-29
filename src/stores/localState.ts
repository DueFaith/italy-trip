import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LocalState, DayShape, HikeShape, BookingState } from './types';
import { EMPTY_STATE } from './types';

type Actions = {
  editHike: (slug: string, patch: Partial<HikeShape>) => void;
  editDay: (date: string, patch: Partial<DayShape>) => void;
  moveHikeToDay: (slug: string, fromDate: string, toDate: string, fromSlugs: string[], toSlugs: string[]) => void;
  changeDayDate: (oldDate: string, newDate: string) => void;
  addHike: (hike: HikeShape) => void;
  addDay: (day: DayShape) => void;
  removeCustomHike: (slug: string) => void;
  removeCustomDay: (date: string) => void;
  setBooking: (id: string, state: BookingState) => void;
  reset: () => void;
};

const stamp = () => new Date().toISOString();

export const useLocalState = create<LocalState & Actions>()(
  persist(
    (set) => ({
      ...EMPTY_STATE,
      editHike: (slug, patch) => set((s) => ({
        hikeEdits: { ...s.hikeEdits, [slug]: { ...(s.hikeEdits[slug] ?? {}), ...patch } },
        lastEditedAt: stamp(),
      })),
      editDay: (date, patch) => set((s) => ({
        dayEdits: { ...s.dayEdits, [date]: { ...(s.dayEdits[date] ?? {}), ...patch } },
        lastEditedAt: stamp(),
      })),
      moveHikeToDay: (slug, fromDate, toDate, fromSlugs, toSlugs) => set((s) => ({
        dayEdits: {
          ...s.dayEdits,
          [fromDate]: { ...(s.dayEdits[fromDate] ?? {}), hikeSlugs: fromSlugs.filter((x) => x !== slug) },
          [toDate]:   { ...(s.dayEdits[toDate]   ?? {}), hikeSlugs: [...toSlugs.filter((x) => x !== slug), slug] },
        },
        lastEditedAt: stamp(),
      })),
      changeDayDate: (oldDate, newDate) => set((s) => ({
        dayEdits: { ...s.dayEdits, [oldDate]: { ...(s.dayEdits[oldDate] ?? {}), date: newDate } },
        lastEditedAt: stamp(),
      })),
      addHike: (hike) => set((s) => ({
        customHikes: { ...s.customHikes, [hike.slug]: hike },
        lastEditedAt: stamp(),
      })),
      addDay: (day) => set((s) => ({
        customDays: { ...s.customDays, [day.date]: day },
        lastEditedAt: stamp(),
      })),
      removeCustomHike: (slug) => set((s) => {
        const { [slug]: _, ...rest } = s.customHikes;
        return { customHikes: rest, lastEditedAt: stamp() };
      }),
      removeCustomDay: (date) => set((s) => {
        const { [date]: _, ...rest } = s.customDays;
        return { customDays: rest, lastEditedAt: stamp() };
      }),
      setBooking: (id, st) => set((s) => ({
        bookings: { ...s.bookings, [id]: st },
        lastEditedAt: stamp(),
      })),
      reset: () => set(EMPTY_STATE),
    }),
    { name: 'dolomites-trip-state', version: 1 }
  )
);
