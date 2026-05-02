import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Pin = {
  lat: number;
  lon: number;
  label: string;
  href?: string;
  category: 'trailhead' | 'lodging' | 'parking' | 'restaurant' | 'activity';
};

const colors = {
  trailhead: '#2d4a3e',
  lodging: '#a83232',
  parking: '#5a6b4d',
  restaurant: '#b08838',
  activity: '#3a5f8a',
};

export default function MapView({ pins }: { pins: Pin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [showHikes, setShowHikes] = useState(true);
  const [showActivities, setShowActivities] = useState(true);

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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pins]);

  // (Re)render markers when toggles change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    const visible = pins.filter((p) => {
      if (p.category === 'activity') return showActivities;
      // trailhead, lodging, parking, restaurant all count as "Phase I"
      return showHikes;
    });

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
    }
  }, [pins, showHikes, showActivities]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Layer toggle — sits above the map, top-left, doesn't block tiles */}
      <div style={{
        position: 'absolute',
        top: 70, left: 16, zIndex: 10,
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
      <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 64px - 48px)' }} />
    </div>
  );
}
