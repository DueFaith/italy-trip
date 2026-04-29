import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Pin = {
  lat: number;
  lon: number;
  label: string;
  href?: string;
  category: 'trailhead' | 'lodging' | 'parking' | 'restaurant';
};

const colors = {
  trailhead: '#2d4a3e',
  lodging: '#a83232',
  parking: '#5a6b4d',
  restaurant: '#b08838',
};

export default function MapView({ pins }: { pins: Pin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

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

    pins.forEach((p) => {
      const el = document.createElement('div');
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${colors[p.category]};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);cursor:pointer;`;

      const popupHtml = p.href
        ? `<a href="${p.href}" style="color:#2d4a3e;font-weight:600">${p.label}</a>`
        : `<span style="font-weight:600">${p.label}</span>`;

      new maplibregl.Marker({ element: el })
        .setLngLat([p.lon, p.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(popupHtml))
        .addTo(map);
    });

    return () => map.remove();
  }, [pins]);

  return <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 64px - 48px)' }} />;
}
