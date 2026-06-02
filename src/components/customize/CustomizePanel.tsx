import { useState } from 'react';
import { DndContext, useDraggable, useDroppable, closestCenter, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { useLocalState } from '@/stores/localState';
import { listEffectiveDays, listEffectiveHikes } from '@/stores/selectors';
import type { DayShape, HikeShape } from '@/stores/types';
import HikeForm from './HikeForm';

type Props = { canonicalDays: DayShape[]; canonicalHikes: HikeShape[] };

function DraggableHike({ slug }: { slug: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `hike-${slug}` });
  const baseStyle = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : {};
  const style = { ...baseStyle, opacity: isDragging ? 0.85 : 1, touchAction: 'none' as const };
  return (
    <span
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="inline-flex items-center gap-1 px-2 py-1 mr-1 mb-1 bg-forest/10 border border-forest/30 rounded text-[11px] cursor-grab active:cursor-grabbing select-none"
    >
      {/* Grip handle — visible affordance for touch users */}
      <span aria-hidden="true" style={{ display: 'inline-block', lineHeight: 1, color: 'var(--ink-soft)', opacity: 0.7, fontFamily: 'sans-serif' }}>⋮⋮</span>
      <span>{slug}</span>
    </span>
  );
}

function DroppableDay({ date, hikeSlugs, theme, fmt, isCustom }: { date: string; hikeSlugs: string[]; theme: string; fmt: (s: string) => string; isCustom: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${date}` });
  return (
    <div ref={setNodeRef} className={`card ${isOver ? 'border-forest' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-sm">{fmt(date)}</div>
          <div className="text-[11px] text-ink-muted">{theme}</div>
        </div>
        <a href={isCustom ? `/custom-day#${date}` : `/day/${date}`} className="text-[11px] text-sage">Edit →</a>
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
  const hikeEdits = useLocalState((s) => s.hikeEdits);
  const dayEdits = useLocalState((s) => s.dayEdits);
  const customHikes = useLocalState((s) => s.customHikes);
  const customDays = useLocalState((s) => s.customDays);
  const addHike = useLocalState((s) => s.addHike);
  const addDay = useLocalState((s) => s.addDay);
  const removeCustomHike = useLocalState((s) => s.removeCustomHike);
  const moveHikeToDay = useLocalState((s) => s.moveHikeToDay);
  const stateSnapshot = { hikeEdits, dayEdits, customHikes, customDays, bookings: {}, schemaVersion: 1 as const };
  const days = listEffectiveDays(canonicalDays, stateSnapshot);
  const hikes = listEffectiveHikes(canonicalHikes, stateSnapshot);
  const [showHikeForm, setShowHikeForm] = useState(false);
  const [showDayForm, setShowDayForm] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayTheme, setNewDayTheme] = useState('');

  const hasNoEdits =
    Object.keys(hikeEdits).length === 0 &&
    Object.keys(dayEdits).length === 0 &&
    Object.keys(customHikes).length === 0 &&
    Object.keys(customDays).length === 0;

  const fmt = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="space-y-6">
      {hasNoEdits && (
        <div style={{
          background: 'var(--bg-paper)',
          border: '1px dashed var(--gold)',
          borderRadius: 'var(--r-md)',
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <div className="mono-cap" style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 6 }}>
            How To Customize
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
            Drag a hike between days to rearrange. Tap any hike or day to edit details. Add new hikes or days with the <strong style={{ color: 'var(--gold)' }}>+ New</strong> buttons.
          </div>
        </div>
      )}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="eyebrow" style={{ margin: 0 }}>Hikes</h2>
          <button
            onClick={() => setShowHikeForm(true)}
            aria-label="Add new hike"
            className="text-xs text-forest font-semibold"
            style={{ minHeight: 44, padding: '10px 6px' }}
          >+ New</button>
        </div>
        {showHikeForm && (
          <div className="card mb-2">
            <HikeForm
              onSubmit={(h) => { addHike(h); setShowHikeForm(false); }}
              onCancel={() => setShowHikeForm(false)}
            />
          </div>
        )}
        <div className="space-y-2">
          {hikes.map((h) => {
            const isCustom = customHikes[h.slug] !== undefined;
            return (
              <div key={h.slug} className="card flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm">{h.name}</div>
                  <div className="text-[11px] text-ink-muted">{h.distanceKm} km · {h.elevationGainM} m · {h.difficulty}</div>
                </div>
                <a href={`/hike/${h.slug}`} className="text-[11px] text-sage">Edit →</a>
                {isCustom && (
                  <button
                    onClick={() => removeCustomHike(h.slug)}
                    aria-label={`Delete ${h.name}`}
                    className="ml-2 text-[11px] text-red-700"
                    style={{ minHeight: 44, padding: '10px 4px' }}
                  >Delete</button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="eyebrow" style={{ margin: 0 }}>Days (drag a hike to move it)</h2>
          <button
            onClick={() => setShowDayForm(true)}
            aria-label="Add new day"
            className="text-xs text-forest font-semibold"
            style={{ minHeight: 44, padding: '10px 6px' }}
          >+ New</button>
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
                  addDay({
                    date: newDayDate, theme: newDayTheme,
                    driving: { legs: [] },
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
          sensors={useSensors(
            // Mouse: small distance threshold so accidental clicks don't start drag
            useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
            // Touch: small delay so the page can still scroll vertically; drag
            // only kicks in if the user holds and starts moving horizontally
            useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
          )}
          onDragEnd={(event) => {
            const { active, over } = event;
            if (!over) return;
            const slug = String(active.id).replace(/^hike-/, '');
            const toDate = String(over.id).replace(/^day-/, '');
            const fromDay = days.find((d) => d.hikeSlugs.includes(slug));
            const toDay = days.find((d) => d.date === toDate);
            if (!fromDay || !toDay || fromDay.date === toDate) return;
            moveHikeToDay(slug, fromDay.date, toDate, fromDay.hikeSlugs, toDay.hikeSlugs);
          }}
        >
          <div className="space-y-2">
            {days.map((d) => (
              <DroppableDay key={d.date} date={d.date} hikeSlugs={d.hikeSlugs} theme={d.theme} fmt={fmt} isCustom={customDays[d.date] !== undefined} />
            ))}
          </div>
        </DndContext>
      </section>
    </div>
  );
}
