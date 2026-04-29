import { useState } from 'react';
import { useLocalState } from '@/stores/localState';
import { listEffectiveDays, listEffectiveHikes } from '@/stores/selectors';
import type { DayShape, HikeShape } from '@/stores/types';
import HikeForm from './HikeForm';

type Props = { canonicalDays: DayShape[]; canonicalHikes: HikeShape[] };

export default function CustomizePanel({ canonicalDays, canonicalHikes }: Props) {
  const state = useLocalState();
  const days = listEffectiveDays(canonicalDays, state);
  const hikes = listEffectiveHikes(canonicalHikes, state);
  const [showHikeForm, setShowHikeForm] = useState(false);

  const fmt = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="eyebrow">Hikes</p>
          <button onClick={() => setShowHikeForm(true)} className="text-xs text-forest font-semibold">+ New</button>
        </div>
        {showHikeForm && (
          <div className="card mb-2">
            <HikeForm
              onSubmit={(h) => { state.addHike(h); setShowHikeForm(false); }}
              onCancel={() => setShowHikeForm(false)}
            />
          </div>
        )}
        <div className="space-y-2">
          {hikes.map((h) => {
            const isCustom = state.customHikes[h.slug] !== undefined;
            return (
              <div key={h.slug} className="card flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">{h.name}</div>
                  <div className="text-[11px] text-ink-muted">{h.distanceKm} km · {h.elevationGainM} m · {h.difficulty}</div>
                </div>
                <a href={`/hike/${h.slug}`} className="text-[11px] text-sage">Edit →</a>
                {isCustom && (
                  <button onClick={() => state.removeCustomHike(h.slug)} className="ml-2 text-[11px] text-red-700">Delete</button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <p className="eyebrow mb-2">Days</p>
        <div className="space-y-2">
          {days.map((d) => (
            <div key={d.date} className="card">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm">{fmt(d.date)}</div>
                  <div className="text-[11px] text-ink-muted">{d.theme}</div>
                </div>
                <a href={`/day/${d.date}`} className="text-[11px] text-sage">Edit →</a>
              </div>
              <div className="mt-2 text-[11px] text-ink-muted">
                Hikes: {d.hikeSlugs.join(', ') || '(none)'}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
