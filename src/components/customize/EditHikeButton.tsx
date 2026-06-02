import { useState, useMemo } from 'react';
import { useLocalState } from '@/stores/localState';
import HikeForm from './HikeForm';
import type { HikeShape } from '@/stores/types';

export default function EditHikeButton({ canonical }: { canonical: HikeShape }) {
  const [open, setOpen] = useState(false);
  const editHike = useLocalState((s) => s.editHike);
  const edits = useLocalState((s) => s.hikeEdits[canonical.slug]);
  const current = useMemo(() => ({ ...canonical, ...(edits ?? {}) }), [canonical, edits]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Edit hike details"
        className="text-xs text-forest font-semibold underline decoration-dotted"
        style={{ minHeight: 44, padding: '10px 0' }}
      >
        Edit details
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-surface rounded-t-lg sm:rounded-lg p-4 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h2 className="font-semibold mb-3">Edit {canonical.name}</h2>
            <HikeForm
              initial={current}
              onSubmit={(h) => {
                const { slug: _slug, ...patch } = h;
                editHike(canonical.slug, patch);
                setOpen(false);
              }}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
