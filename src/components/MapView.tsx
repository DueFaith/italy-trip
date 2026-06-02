import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Pin = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  href?: string;
  category: 'trailhead' | 'lodging' | 'parking' | 'restaurant' | 'activity';
  dayDates: string[];
};

type Props = {
  pins: Pin[];
  focusId?: string;
  dayDate?: string;
  phaseBoundary?: string;
};

const colors = {
  trailhead: '#2d4a3e',
  lodging: '#a83232',
  parking: '#5a6b4d',
  restaurant: '#b08838',
  activity: '#3a5f8a',
};

export default function MapView({ pins, focusId: focusIdProp, dayDate: dayDateProp, phaseBoundary: phaseBoundaryProp = '2026-07-20' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // Static build can't see query params at SSR time, so fall back to
  // window.location at hydration. Props win when provided (e.g. SSR mode).
  const [focusId, setFocusId] = useState<string | undefined>(() => {
    if (focusIdProp !== undefined) return focusIdProp;
    if (typeof window === 'undefined') return undefined;
    return new URLSearchParams(window.location.search).get('focus') ?? undefined;
  });
  const [dayDate, setDayDate] = useState<string | undefined>(dayDateProp);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!focusIdProp) setFocusId(params.get('focus') ?? undefined);
    if (!dayDateProp) setDayDate(params.get('day') ?? undefined);
  }, [focusIdProp, dayDateProp]);
  // focus param wins over day param when both are set (per spec §2 precedence)
  const effectiveDay = focusId ? undefined : dayDate;
  // Default Phase I/II layer state: if the SSR prop signaled a Phase I day,
  // default to Phase I only. (Toggles are hidden when filters are active, so
  // this only meaningfully affects the no-filter global view.)
  const phaseIOnly = dayDateProp !== undefined && !focusIdProp && dayDateProp < phaseBoundaryProp;
  const [showHikes, setShowHikes] = useState(true);
  const [showActivities, setShowActivities] = useState(!phaseIOnly);

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return;
    const lats = pins.map((p) => p.lat);
    const lons = pins.map((p) => p.lon);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons) - 0.05, Math.min(...lats) - 0.05],
      [Math.max(...lons) + 0.05, Math.max(...lats) + 0.05],
    ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      bounds,
      fitBoundsOptions: { padding: 30 },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    // Ensure any attribution links injected by MapLibre open in a new tab
    // safely. MapLibre injects raw HTML anchors for its logo/OSM credit;
    // we patch them after the map is idle so rel=noopener is always present.
    map.once('idle', () => {
      map.getContainer().querySelectorAll('a[href]').forEach((a) => {
        const anchor = a as HTMLAnchorElement;
        if (!anchor.href.startsWith(window.location.origin)) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pins]);

  // Re-render markers + apply focus/day filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    let visible: Pin[];
    if (focusId) {
      // focus wins
      visible = pins.filter((p) => p.id === focusId);
    } else if (effectiveDay) {
      // day filter
      visible = pins.filter((p) => p.dayDates.includes(effectiveDay));
    } else {
      // global with toggles
      visible = pins.filter((p) => (p.category === 'activity' ? showActivities : showHikes));
    }

    const focusMarkers: { marker: maplibregl.Marker; pin: Pin }[] = [];

    for (const p of visible) {
      const el = document.createElement('div');
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${colors[p.category]};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);cursor:pointer;`;

      const popupHtml = p.href
        ? `<a href="${p.href}" style="color:#2d4a3e;font-weight:600">${p.label}</a>`
        : `<span style="font-weight:600">${p.label}</span>`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml))
        .addTo(map);

      markersRef.current.push(marker);
      if (focusId && p.id === focusId) focusMarkers.push({ marker, pin: p });
    }

    // Apply focus: zoom + open popup
    if (focusMarkers.length > 0) {
      const { marker, pin } = focusMarkers[0];
      map.flyTo({ center: [pin.lon, pin.lat], zoom: 14, padding: 80 });
      // Open popup after fly-to settles (small delay so the map is centred first)
      setTimeout(() => marker.togglePopup(), 350);
    } else if (effectiveDay && visible.length > 0) {
      // Day filter: fit bounds of the day's pins
      const lats = visible.map((p) => p.lat);
      const lons = visible.map((p) => p.lon);
      const bb: [[number, number], [number, number]] = [
        [Math.min(...lons) - 0.02, Math.min(...lats) - 0.02],
        [Math.max(...lons) + 0.02, Math.max(...lats) + 0.02],
      ];
      map.fitBounds(bb, { padding: 60 });
    }
  }, [pins, showHikes, showActivities, focusId, effectiveDay]);

  // Hide layer toggle when filters are active (focus or day)
  const showToggle = !focusId && !effectiveDay;

  return (
    <div style={{ position: 'relative' }}>
      {showToggle && (
        <div style={{
          position: 'absolute',
          top: 110, left: 16, zIndex: 10,
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={() => setShowHikes((v) => !v)}
            aria-pressed={showHikes}
            style={{
              padding: '6px 10px',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              background: showHikes ? 'var(--ink)' : 'color-mix(in srgb, var(--bg) 90%, transparent)',
              color: showHikes ? 'var(--bg)' : 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              minHeight: 36,
            }}
          >Phase I</button>
          <button
            type="button"
            onClick={() => setShowActivities((v) => !v)}
            aria-pressed={showActivities}
            style={{
              padding: '6px 10px',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)',
              background: showActivities ? 'var(--ink)' : 'color-mix(in srgb, var(--bg) 90%, transparent)',
              color: showActivities ? 'var(--bg)' : 'var(--ink)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              minHeight: 36,
            }}
          >Phase II</button>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 64px - 48px)' }} />
    </div>
  );
}
