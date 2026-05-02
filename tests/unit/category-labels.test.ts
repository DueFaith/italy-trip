import { describe, it, expect } from 'vitest';
import { CATEGORY_LABELS, type ActivityCategory } from '@/lib/category-labels';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ACTIVITIES_DIR = path.resolve(__dirname, '../../src/content/activities');

function loadActivities(): { slug: string; category: string }[] {
  const files = fs.readdirSync(ACTIVITIES_DIR).filter((f) => f.endsWith('.yaml'));
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(ACTIVITIES_DIR, f), 'utf8');
    const data = yaml.load(raw) as { slug: string; category: string };
    return { slug: data.slug, category: data.category };
  });
}

describe('CATEGORY_LABELS', () => {
  it('has a label for every activity category in the collection', () => {
    const activities = loadActivities();
    for (const a of activities) {
      expect(CATEGORY_LABELS[a.category as ActivityCategory]).toBeDefined();
    }
  });

  it('every key is a category that is actually used by some activity', () => {
    const activities = loadActivities();
    const usedCategories = new Set(activities.map((a) => a.category));
    for (const key of Object.keys(CATEGORY_LABELS)) {
      expect(usedCategories.has(key)).toBe(true);
    }
  });

  it('produces human-readable labels (not slug-cased)', () => {
    expect(CATEGORY_LABELS['culture-history']).toBe('Culture & History');
    expect(CATEGORY_LABELS['water-sports']).toBe('Water Sports');
    expect(CATEGORY_LABELS['mountain-cable-car']).toBe('Mountain & Cable Car');
    expect(CATEGORY_LABELS['day-trip']).toBe('Day Trip');
    expect(CATEGORY_LABELS['aquatic-park']).toBe('Aquatic Park');
  });
});
