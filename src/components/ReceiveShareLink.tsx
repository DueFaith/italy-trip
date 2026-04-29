import { useEffect, useState } from 'react';
import { useLocalState } from '@/stores/localState';
import { decodeState } from '@/stores/shareLink';
import type { LocalState } from '@/stores/types';

export default function ReceiveShareLink() {
  const [incoming, setIncoming] = useState<LocalState | null>(null);
  const reset = useLocalState((s) => s.reset);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const encoded = params.get('plan');
    if (!encoded) return;
    const parsed = decodeState(encoded);
    if (parsed) setIncoming(parsed);
    // strip the param so refreshing doesn't re-trigger
    const url = new URL(location.href);
    url.searchParams.delete('plan');
    history.replaceState({}, '', url.toString());
  }, []);

  if (!incoming) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface rounded-t-lg sm:rounded-lg p-4 w-full max-w-md">
        <h2 className="font-semibold mb-2">Adopt shared plan?</h2>
        <p className="text-sm text-ink-muted mb-3">
          Someone shared a customized version of this trip. Replacing your local edits with theirs.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              reset();
              useLocalState.setState(incoming);
              setIncoming(null);
            }}
            className="flex-1 bg-forest text-white py-2 rounded text-sm">Yes, use this plan</button>
          <button onClick={() => setIncoming(null)} className="px-3 py-2 border border-border rounded text-sm">No</button>
        </div>
      </div>
    </div>
  );
}
