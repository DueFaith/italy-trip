import { useState } from 'react';
import { useLocalState } from '@/stores/localState';
import type { DayShape } from '@/stores/types';

export default function EditDayButton({ canonical }: { canonical: DayShape }) {
  const [open, setOpen] = useState(false);
  const editDay = useLocalState((s) => s.editDay);
  const changeDayDate = useLocalState((s) => s.changeDayDate);
  const current = useLocalState((s) => ({ ...canonical, ...(s.dayEdits[canonical.date] ?? {}) }));
  const [theme, setTheme] = useState(current.theme);
  const [date, setDate] = useState(current.date);

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-forest font-semibold underline decoration-dotted">
        Edit day
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-surface rounded-t-lg sm:rounded-lg p-4 w-full max-w-md">
            <h2 className="font-semibold mb-3">Edit day</h2>
            {date !== canonical.date && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 text-xs p-2 rounded mb-2">
                ⚠ Lodging dates are booked separately. This only changes the trip-plan view.
              </div>
            )}
            <label className="block text-sm mb-2">
              <span className="text-[11px] text-ink-muted">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-border rounded px-2 py-1 bg-bg" />
            </label>
            <label className="block text-sm mb-3">
              <span className="text-[11px] text-ink-muted">Theme</span>
              <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full border border-border rounded px-2 py-1 bg-bg" />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (theme !== canonical.theme) editDay(canonical.date, { theme });
                  if (date !== canonical.date) changeDayDate(canonical.date, date);
                  setOpen(false);
                }}
                className="flex-1 bg-forest text-white py-2 rounded text-sm">Save</button>
              <button onClick={() => setOpen(false)} className="px-3 py-2 border border-border rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
