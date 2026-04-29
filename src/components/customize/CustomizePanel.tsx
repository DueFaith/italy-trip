import { useState } from 'react';
import { DndContext, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import { useLocalState } from '@/stores/localState';
import { listEffectiveDays, listEffectiveHikes } from '@/stores/selectors';
import type { DayShape, HikeShape } from '@/stores/types';
import HikeForm from './HikeForm';

type Props = { canonicalDays: DayShape[]; canonicalHikes: HikeShape[] };

function DraggableHike({ slug }: { slug: string }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: `hike-${slug}` });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <span ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="inline-block px-2 py-1 bg-forest/10 border border-forest/30 rounded text-[11px] mr-1 cursor-move">
      {slug}
    </span>
  );
}

function DroppableDay({ date, hikeSlugs, theme, fmt }: { date: string; hikeSlugs: string[]; theme: string; fmt: (s: string) => string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date}` });
  return (
    <div ref={setNodeRef} className={`card ${isOver ? 'border-forest' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-sm">{fmt(date)}</div>
          <div className="text-[11px] text-ink-muted">{theme}</div>
        </div>
        <a href={`/day/${date}`} className="text-[11px] text-sage">Edit →</a>
      </div>
      <div className="mt-2 min-h-[28px]">
        {hikeSlugs.length === 0
          ? <span className="text-[11px] text-ink-muted">No hikes</span>
          : hikeSlugs.map((s) => <DraggableHike key={s} slug={s} />)}
      </div>
    </div>
  );
}

export default function CustomizePanel({ canonicalDays, canonicalHikes }: Props) {
  const state = useLocalState();
  const days = listEffectiveDays(canonicalDays, state);
  const hikes = listEffectiveHikes(canonicalHikes, state);
  const [showHikeForm, setShowHikeForm] = useState(false);
  const [showDayForm, setShowDayForm] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayTheme, setNewDayTheme] = useState('');

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
        <div className="flex items-center justify-between mb-2">
          <p className="eyebrow">Days (drag a hike to move it)</p>
          <button onClick={() => setShowDayForm(true)} className="text-xs text-forest font-semibold">+ New</button>
        </div>
        {showDayForm && (
          <div className="card mb-2 space-y-2 text-sm">
            <label className="block">
              <span className="text-[11px] text-ink-muted">Date</span>
              <input type="date" value={newDayDate} onChange={(e) => setNewDayDate(e.target.value)} className="w-full border border-border rounded px-2 py-1 bg-bg" />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-muted">Theme</span>
              <input type="text" value={newDayTheme} onChange={(e) => setNewDayTheme(e.target.value)} className="w-full border border-border rounded px-2 py-1 bg-bg" />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!newDayDate || !newDayTheme) return;
                  state.addDay({
                    date: newDayDate, theme: newDayTheme,
                    driving: { distanceKm: 0, durationMin: 0 },
                    schedule: [], hikeSlugs: [],
                    lodgingSlug: 'baita-fraina',
                    weatherFor: { lat: 46.5237, lon: 12.1528, label: 'Cortina' },
                  });
                  setShowDayForm(false); setNewDayDate(''); setNewDayTheme('');
                }}
                className="flex-1 bg-forest text-white py-2 rounded text-sm">Save</button>
              <button onClick={() => setShowDayForm(false)} className="px-3 py-2 border border-border rounded text-sm">Cancel</button>
            </div>
          </div>
        )}
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over) return;
            const slug = String(active.id).replace(/^hike-/, '');
            const toDate = String(over.id).replace(/^day-/, '');
            const fromDay = days.find((d) => d.hikeSlugs.includes(slug));
            const toDay = days.find((d) => d.date === toDate);
            if (!fromDay || !toDay || fromDay.date === toDate) return;
            state.moveHikeToDay(slug, fromDay.date, toDate, fromDay.hikeSlugs, toDay.hikeSlugs);
          }}
        >
          <div className="space-y-2">
            {days.map((d) => (
              <DroppableDay key={d.date} date={d.date} hikeSlugs={d.hikeSlugs} theme={d.theme} fmt={fmt} />
            ))}
          </div>
        </DndContext>
      </section>
    </div>
  );
}
