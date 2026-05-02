// Web Mercator tile projection helpers for static MapRibbon component.
// Pure functions — no DOM, no fetch.

export type Pin = {
  lat: number;
  lon: number;
  label: string;
  href?: string;
  category: 'trailhead' | 'lodging' | 'parking' | 'restaurant' | 'activity';
};

export type ProjectedPin = Pin & {
  fx: number; // 0..1 fractional x within the tile
  fy: number; // 0..1 fractional y within the tile
  edge: null | 'left' | 'right' | 'top' | 'bottom'; // non-null = clipped to edge marker
};

export type RibbonSpec = {
  tileX: number;
  tileY: number;
  zoom: number;
  tileUrl: string;
  centerLat: number;
  centerLon: number;
  projected: ProjectedPin[];
};

const MIN_ZOOM = 10;
const MAX_ZOOM = 13;

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
  );
}

function tileBBox(x: number, y: number, z: number) {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return { west, east, north: (northRad * 180) / Math.PI, south: (southRad * 180) / Math.PI };
}

// Mercator y-projection of a latitude (radians-free formulation)
function projY(latDeg: number): number {
  const rad = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function projectPin(p: Pin, x: number, y: number, z: number): ProjectedPin {
  const bbox = tileBBox(x, y, z);
  const fx = (p.lon - bbox.west) / (bbox.east - bbox.west);
  const yScale = projY(bbox.north) - projY(bbox.south);
  const fy = (projY(bbox.north) - projY(p.lat)) / yScale;

  let edge: ProjectedPin['edge'] = null;
  let cx = fx;
  let cy = fy;
  if (fx < 0) { edge = 'left'; cx = 0; }
  else if (fx > 1) { edge = 'right'; cx = 1; }
  else if (fy < 0) { edge = 'top'; cy = 0; }
  else if (fy > 1) { edge = 'bottom'; cy = 1; }

  return { ...p, fx: cx, fy: cy, edge };
}

// Pick a zoom that keeps every pin inside one tile if possible.
// Drops a level and retries on overflow; bottoms out at MIN_ZOOM with edge-marker fallback.
function pickZoomAndTile(centerLat: number, centerLon: number, pins: Pin[]) {
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const tx = lonToTileX(centerLon, z);
    const ty = latToTileY(centerLat, z);
    const projected = pins.map((p) => projectPin(p, tx, ty, z));
    const allInside = projected.every((pp) => pp.edge === null);
    if (allInside || z === MIN_ZOOM) {
      return { zoom: z, tileX: tx, tileY: ty, projected };
    }
  }
  // Unreachable, but keeps TS happy
  const z = MIN_ZOOM;
  const tx = lonToTileX(centerLon, z);
  const ty = latToTileY(centerLat, z);
  return { zoom: z, tileX: tx, tileY: ty, projected: pins.map((p) => projectPin(p, tx, ty, z)) };
}

/**
 * Build a complete RibbonSpec for the given pin set. Uses the bounding-box
 * centre of the pins (NOT the mean), and chooses the highest zoom level
 * (most detail) that fits all pins inside one tile.
 *
 * Single-pin sets get zoom 13 with the pin centred.
 */
export function buildRibbonSpec(pins: Pin[]): RibbonSpec | null {
  if (pins.length === 0) return null;

  // Bounding-box centre (handles asymmetric pin spreads better than mean).
  const lats = pins.map((p) => p.lat);
  const lons = pins.map((p) => p.lon);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

  if (pins.length === 1) {
    const z = MAX_ZOOM;
    const tx = lonToTileX(pins[0].lon, z);
    const ty = latToTileY(pins[0].lat, z);
    const projected = [projectPin(pins[0], tx, ty, z)];
    return {
      zoom: z,
      tileX: tx,
      tileY: ty,
      tileUrl: `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`,
      centerLat: pins[0].lat,
      centerLon: pins[0].lon,
      projected,
    };
  }

  const { zoom, tileX, tileY, projected } = pickZoomAndTile(centerLat, centerLon, pins);
  return {
    zoom,
    tileX,
    tileY,
    tileUrl: `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`,
    centerLat,
    centerLon,
    projected,
  };
}
