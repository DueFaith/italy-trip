import { useEffect, useState } from 'react';
import { useLocalState } from '@/stores/localState';

export default function CustomDayPage({ initialDate }: { initialDate: string }) {
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState(initialDate);
  const customDay = useLocalState((s) => s.customDays[date]);

  useEffect(() => {
    setMounted(true);
    // Re-read date from URL hash on mount; allows /custom-day#YYYY-MM-DD
    const fromHash = location.hash.replace(/^#/, '');
    if (fromHash) setDate(fromHash);
  }, []);

  if (!mounted) {
    return <div className="px-4 py-12 text-center text-ink-muted text-sm">Loading...</div>;
  }
  if (!date) {
    return <div className="px-4 py-12 text-center text-ink-muted text-sm">No date in URL hash.</div>;
  }
  if (!customDay) {
    return (
      <div className="px-4 py-12 text-center text-ink-muted text-sm">
        <p>This day isn't in the canonical plan and isn't in your local edits.</p>
      </div>
    );
  }

  const fmtDate = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <section className="px-4 pt-5 pb-3 bg-bg-2/60 border-b border-border">
        <p className="text-[10px] uppercase tracking-wide font-bold text-sage">Custom day</p>
        <h1 className="text-xl font-semibold tracking-tight mt-1">{customDay.theme}</h1>
        <p className="text-sm text-ink-muted mt-1">{fmtDate(customDay.date)}</p>
      </section>
      {customDay.hikeSlugs.length > 0 ? (
        <section className="px-4 py-4 text-sm">
          Hikes: {customDay.hikeSlugs.join(', ')}
        </section>
      ) : (
        <section className="px-4 py-4 text-sm text-ink-muted">No hikes scheduled.</section>
      )}
    </>
  );
}
