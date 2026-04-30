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

const categoryOrder = ['flight', 'car', 'lodging', 'parking', 'cable-car', 'restaurant', 'other'];
const categoryLabel: Record<string, string> = {
  flight: 'Flights',
  car: 'Car Rental',
  lodging: 'Lodging',
  parking: 'Parking Permits',
  'cable-car': 'Cable Cars',
  restaurant: 'Restaurants',
  other: 'Other',
};

export default function BookingChecklist({ bookings }: { bookings: Booking[] }) {
  const local = useLocalState((s) => s.bookings);
  const setBooking = useLocalState((s) => s.setBooking);

  const isChecked = (b: Booking) => {
    const ls = local[b.id];
    if (ls) return ls.checked;
    return b.status === 'booked';
  };

  // Booking opens within 14 days → signal dot
  const opensSoon = (b: Booking) => {
    if (!b.bookingOpens || isChecked(b)) return false;
    const days = (new Date(b.bookingOpens).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 14;
  };

  // Group by category preserving original order
  const groups = categoryOrder
    .map((cat) => ({ cat, items: bookings.filter((b) => b.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {groups.map((g) => (
        <section key={g.cat}>
          <p
            className="eyebrow"
            style={{ margin: '0 0 10px' }}
          >{categoryLabel[g.cat] ?? g.cat}</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {g.items.map((b) => {
              const checked = isChecked(b);
              const conf = local[b.id]?.confirmation ?? b.confirmationNumber ?? '';
              const soon = opensSoon(b);
              return (
                <li
                  key={b.id}
                  style={{
                    background: 'var(--bg-paper)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--r-md)',
                    padding: '12px 14px',
                    boxShadow: 'var(--shadow-paper-sm)',
                    position: 'relative',
                    opacity: checked ? 0.78 : 1,
                  }}
                >
                  <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                    {/* Custom square checkbox */}
                    <span
                      style={{
                        position: 'relative',
                        flex: '0 0 22px',
                        width: 22,
                        height: 22,
                        marginTop: 2,
                        border: `1.5px solid ${checked ? 'var(--gold)' : 'var(--ink-soft)'}`,
                        borderRadius: 3,
                        background: checked ? 'var(--gold)' : 'transparent',
                        transition: 'background 160ms ease, border-color 160ms ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setBooking(b.id, {
                            checked: e.target.checked,
                            confirmation: conf,
                            bookedAt: new Date().toISOString(),
                          })
                        }
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0,
                          margin: 0,
                          padding: 0,
                          cursor: 'pointer',
                        }}
                        aria-label={b.label}
                      />
                      {checked && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          style={{ position: 'absolute', top: 2, left: 2 }}
                        >
                          <path
                            d="M5 12 L10 17 L19 7"
                            stroke="var(--bg)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      )}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: checked ? 400 : 700,
                          color: 'var(--ink)',
                          textDecoration: checked ? 'line-through' : 'none',
                          textDecorationColor: 'var(--ink-soft)',
                          lineHeight: 1.35,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        {soon && (
                          <span
                            aria-label="opens soon"
                            style={{
                              flex: '0 0 8px',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'var(--signal)',
                              animation: 'pulse-dot 1.6s ease-in-out infinite',
                              display: 'inline-block',
                            }}
                          />
                        )}
                        <span>{b.label}</span>
                      </div>
                      {b.bookingOpens && !checked && (
                        <div
                          className="mono-cap"
                          style={{ fontSize: 10, color: soon ? 'var(--signal)' : 'var(--gold)', marginTop: 4 }}
                        >
                          Opens {b.bookingOpens}
                        </div>
                      )}
                      {b.bookingUrl && !checked && (
                        <a
                          href={b.bookingUrl}
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--ink-soft)',
                            display: 'inline-block',
                            marginTop: 4,
                            borderBottom: '1px dashed var(--gold)',
                            paddingBottom: 1,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {b.bookingUrl.replace(/^https?:\/\//, '').slice(0, 38)}
                        </a>
                      )}
                      <input
                        type="text"
                        placeholder="Confirmation #"
                        value={conf}
                        onChange={(e) =>
                          setBooking(b.id, {
                            checked,
                            confirmation: e.target.value,
                            bookedAt: local[b.id]?.bookedAt,
                          })
                        }
                        className="mono"
                        style={{
                          marginTop: 10,
                          width: '100%',
                          fontSize: 11,
                          letterSpacing: '0.04em',
                          color: 'var(--ink)',
                          background: 'var(--bg)',
                          border: '1px solid var(--hairline)',
                          borderRadius: 'var(--r-sm)',
                          padding: '6px 10px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
