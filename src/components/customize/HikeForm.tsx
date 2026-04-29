import { useState } from 'react';
import type { HikeShape } from '@/stores/types';

const empty: HikeShape = {
  slug: '', name: '', region: 'Veneto',
  distanceKm: 0, elevationGainM: 0,
  movingTimeHours: { min: 1, max: 2 }, totalTimeHours: { min: 1, max: 3 },
  difficulty: 'moderate', type: 'loop',
  trailhead: { name: '', lat: 0, lon: 0 },
  parking: { name: '', costEur: 0, mustBook: false },
  routeHighlights: [], foodOnTrail: [], hazards: [],
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function HikeForm({ initial, onSubmit, onCancel }: { initial?: Partial<HikeShape>; onSubmit: (h: HikeShape) => void; onCancel: () => void }) {
  const [h, setH] = useState<HikeShape>({ ...empty, ...initial } as HikeShape);

  const upd = <K extends keyof HikeShape>(k: K, v: HikeShape[K]) => setH({ ...h, [k]: v });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const slug = h.slug || slugify(h.name);
        if (!slug || !h.name) return;
        onSubmit({ ...h, slug });
      }}
      className="space-y-2 text-sm"
    >
      <label className="block">
        <span className="text-[11px] text-ink-muted">Name</span>
        <input className="w-full border border-border rounded px-2 py-1 bg-bg" value={h.name} onChange={(e) => upd('name', e.target.value)} required />
      </label>
      <label className="block">
        <span className="text-[11px] text-ink-muted">Slug (optional, auto from name)</span>
        <input className="w-full border border-border rounded px-2 py-1 bg-bg" value={h.slug} onChange={(e) => upd('slug', e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-ink-muted">Distance (km)</span>
          <input type="number" step="0.1" className="w-full border border-border rounded px-2 py-1 bg-bg" value={h.distanceKm} onChange={(e) => upd('distanceKm', parseFloat(e.target.value))} />
        </label>
        <label className="block">
          <span className="text-[11px] text-ink-muted">Gain (m)</span>
          <input type="number" className="w-full border border-border rounded px-2 py-1 bg-bg" value={h.elevationGainM} onChange={(e) => upd('elevationGainM', parseInt(e.target.value, 10))} />
        </label>
      </div>
      <label className="block">
        <span className="text-[11px] text-ink-muted">Difficulty</span>
        <select className="w-full border border-border rounded px-2 py-1 bg-bg" value={h.difficulty} onChange={(e) => upd('difficulty', e.target.value as HikeShape['difficulty'])}>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] text-ink-muted">AllTrails URL (optional)</span>
        <input type="url" className="w-full border border-border rounded px-2 py-1 bg-bg" value={h.alltrailsUrl ?? ''} onChange={(e) => upd('alltrailsUrl', e.target.value || undefined)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-ink-muted">Trailhead lat</span>
          <input type="number" step="0.0001" className="w-full border border-border rounded px-2 py-1 bg-bg" value={h.trailhead.lat} onChange={(e) => upd('trailhead', { ...h.trailhead, lat: parseFloat(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-[11px] text-ink-muted">Trailhead lon</span>
          <input type="number" step="0.0001" className="w-full border border-border rounded px-2 py-1 bg-bg" value={h.trailhead.lon} onChange={(e) => upd('trailhead', { ...h.trailhead, lon: parseFloat(e.target.value) })} />
        </label>
      </div>
      <div className="flex gap-2 pt-2">
        <button type="submit" className="flex-1 bg-forest text-white py-2 rounded text-sm">Save</button>
        <button type="button" onClick={onCancel} className="px-3 py-2 border border-border rounded text-sm">Cancel</button>
      </div>
    </form>
  );
}
