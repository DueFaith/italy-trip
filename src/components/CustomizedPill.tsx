import { useLocalState } from '@/stores/localState';
import { isCustomized } from '@/stores/types';
import { useState } from 'react';

export default function CustomizedPill() {
  const state = useLocalState();
  const [open, setOpen] = useState(false);

  if (!isCustomized(state)) return null;

  const editCount =
    Object.keys(state.hikeEdits).length +
    Object.keys(state.dayEdits).length +
    Object.keys(state.customHikes).length +
    Object.keys(state.customDays).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="text-[11px] bg-forest text-white px-2 py-1 rounded-full">
        Customized · {editCount}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-border rounded-lg shadow-lg p-3 text-xs z-50">
          <p className="text-ink-muted">Local edits don't sync. Use the share-link to send to others.</p>
          <button
            onClick={() => {
              if (confirm('Reset all customizations?')) {
                state.reset();
                setOpen(false);
              }
            }}
            className="mt-2 text-forest underline decoration-dotted"
          >
            Reset to plan
          </button>
          <button onClick={() => setOpen(false)} className="block mt-1 text-ink-muted">Close</button>
        </div>
      )}
    </div>
  );
}
