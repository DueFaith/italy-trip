import { describe, it, expect } from 'vitest';
import { buildRibbonSpec, type Pin } from '@/lib/tile-math';

const trailheadPin = (lat: number, lon: number, label = 'pin'): Pin => ({
  lat,
  lon,
  label,
  category: 'trailhead',
});

describe('buildRibbonSpec', () => {
  it('returns null for an empty pin set', () => {
    expect(buildRibbonSpec([])).toBeNull();
  });

  it('uses zoom 13 for a single pin', () => {
    const spec = buildRibbonSpec([trailheadPin(46.5, 12.0)]);
    expect(spec).not.toBeNull();
    expect(spec!.zoom).toBe(13);
    expect(spec!.projected).toHaveLength(1);
    expect(spec!.projected[0].edge).toBeNull();
    expect(spec!.projected[0].fx).toBeGreaterThanOrEqual(0);
    expect(spec!.projected[0].fx).toBeLessThanOrEqual(1);
    expect(spec!.projected[0].fy).toBeGreaterThanOrEqual(0);
    expect(spec!.projected[0].fy).toBeLessThanOrEqual(1);
  });

  it('Tre Cime + Baita Fraina overflow at z=10 → at least one pin marked as edge', () => {
    const spec = buildRibbonSpec([
      trailheadPin(46.6168, 12.2954, 'Tre Cime'),
      trailheadPin(46.5237, 12.1528, 'Baita Fraina'),
    ]);
    expect(spec).not.toBeNull();
    expect(spec!.zoom).toBe(10);
    const edges = spec!.projected.map((p) => p.edge);
    expect(edges.some((e) => e !== null)).toBe(true);
  });

  it('cross-region pins (Salò + VCE) bottom out at MIN_ZOOM=10', () => {
    const spec = buildRibbonSpec([
      trailheadPin(45.6063, 10.5237, 'Salò'),
      trailheadPin(45.5053, 12.3519, 'VCE'),
    ]);
    expect(spec).not.toBeNull();
    expect(spec!.zoom).toBe(10);
  });

  it('uses bbox-centre, not mean, for asymmetric pin sets', () => {
    // Three pins at (1,1), (1,1), (3,3). Mean lon is 1.67, bbox-centre lon is 2.0.
    const spec = buildRibbonSpec([
      { lat: 1, lon: 1, label: 'a', category: 'trailhead' },
      { lat: 1, lon: 1, label: 'b', category: 'trailhead' },
      { lat: 3, lon: 3, label: 'c', category: 'trailhead' },
    ]);
    expect(spec).not.toBeNull();
    expect(spec!.centerLat).toBeCloseTo(2.0, 6);
    expect(spec!.centerLon).toBeCloseTo(2.0, 6);
  });

  it('produces an OSM tile URL matching the chosen zoom + tile coords', () => {
    const spec = buildRibbonSpec([trailheadPin(46.5237, 12.1528)]);
    expect(spec!.tileUrl).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    expect(spec!.tileUrl).toContain(`/${spec!.zoom}/`);
    expect(spec!.tileUrl).toContain(`/${spec!.tileX}/`);
    expect(spec!.tileUrl).toContain(`/${spec!.tileY}.png`);
  });
});
