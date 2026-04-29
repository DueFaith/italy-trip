import { useLocalState } from '@/stores/localState';

type Booking = {
  id: string;
  label: string;
  category: string;
  status: string;
  bookingOpens?: string;
  bookingUrl?: string;
  costEur?: number;
  confirmationNumber?: string;
  notes?: string;
};

export default function BookingChecklist({ bookings }: { bookings: Booking[] }) {
  const local = useLocalState((s) => s.bookings);
  const setBooking = useLocalState((s) => s.setBooking);

  const isChecked = (b: Booking) => {
    const ls = local[b.id];
    if (ls) return ls.checked;
    return b.status === 'booked';
  };

  return (
    <div className="space-y-2">
      {bookings.map((b) => {
        const checked = isChecked(b);
        const conf = local[b.id]?.confirmation ?? b.confirmationNumber ?? '';
        return (
          <div key={b.id} className="card">
            <label className="flex gap-3 items-start cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  setBooking(b.id, { checked: e.target.checked, confirmation: conf, bookedAt: new Date().toISOString() })
                }
                className="mt-1 w-4 h-4 accent-forest"
              />
              <div className="flex-1">
                <div className={`text-sm ${checked ? 'line-through text-ink-muted' : 'font-medium'}`}>{b.label}</div>
                {b.bookingOpens && !checked && (
                  <div className="text-[11px] text-forest mt-0.5">Opens {b.bookingOpens}</div>
                )}
                {b.bookingUrl && (
                  <a href={b.bookingUrl} className="text-[11px] text-sage underline decoration-dotted block mt-0.5">
                    {b.bookingUrl.replace(/^https?:\/\//, '').slice(0, 40)}
                  </a>
                )}
                <input
                  type="text"
                  placeholder="Confirmation #"
                  value={conf}
                  onChange={(e) =>
                    setBooking(b.id, { checked, confirmation: e.target.value, bookedAt: local[b.id]?.bookedAt })
                  }
                  className="mt-2 w-full text-[11px] border border-border rounded px-2 py-1 bg-bg"
                />
              </div>
            </label>
          </div>
        );
      })}
    </div>
  );
}
