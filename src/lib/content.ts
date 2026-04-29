import { getCollection, getEntry } from 'astro:content';
import yaml from 'js-yaml';
import fs from 'node:fs';
import path from 'node:path';

export async function getDays() {
  const days = await getCollection('days');
  return days.sort((a, b) => a.data.date.localeCompare(b.data.date));
}

export async function getHikes() {
  return await getCollection('hikes');
}

export async function getHike(slug: string) {
  return await getEntry('hikes', slug);
}

export async function getDay(date: string) {
  const days = await getDays();
  return days.find(d => d.data.date === date);
}

export async function getLodgings() {
  return await getCollection('lodgings');
}

export async function getRestaurants() {
  return await getCollection('restaurants');
}

// Trip metadata + bookings live as plain YAML files (not collections).
function readYaml<T>(rel: string): T {
  const p = path.join(process.cwd(), 'src/content', rel);
  return yaml.load(fs.readFileSync(p, 'utf8')) as T;
}

export function getTrip() {
  return readYaml<{ name: string; startDate: string; endDate: string; travelers: string[]; flights: any; rentalCar: any }>('trip.yaml');
}

export function getBookings() {
  return readYaml<Array<{ id: string; label: string; category: string; status: string; bookingOpens?: string; bookingUrl?: string; costEur?: number; confirmationNumber?: string; notes?: string }>>('bookings.yaml');
}
