import { useEffect, useState } from 'react';

type Forecast = {
  date: string;
  tMin: number;
  tMax: number;
  precip: number;
  weatherCode: number;
};

// WMO weather codes → vintage poster-style SVG glyph (no emoji)
function WeatherGlyph({ code }: { code: number }) {
  const stroke = 'var(--ink)';
  const accent = 'var(--gold)';
  if (code === 0) {
    // sun
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="6" stroke={accent} strokeWidth="1.5" fill="none" />
        <g stroke={accent} strokeWidth="1.5" strokeLinecap="round">
          <path d="M16 3 V7" /><path d="M16 25 V29" />
          <path d="M3 16 H7" /><path d="M25 16 H29" />
          <path d="M6.7 6.7 L9.5 9.5" /><path d="M22.5 22.5 L25.3 25.3" />
          <path d="M6.7 25.3 L9.5 22.5" /><path d="M22.5 9.5 L25.3 6.7" />
        </g>
      </svg>
    );
  }
  if (code <= 3) {
    // sun + cloud
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="11" cy="11" r="4" stroke={accent} strokeWidth="1.5" fill="none" />
        <path d="M11 6 V8 M6 11 H8 M14 7.4 L15.5 5.9 M7.4 14 L5.9 15.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 22 a4 4 0 0 1 4 -4 a5 5 0 0 1 9 1 a3 3 0 0 1 0 6 H10 a3 3 0 0 1 -1 -3 z" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      </svg>
    );
  }
  if (code <= 48) {
    // fog
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <g stroke={stroke} strokeWidth="1.5" strokeLinecap="round">
          <path d="M5 11 H20" /><path d="M8 16 H27" /><path d="M5 21 H22" /><path d="M9 26 H25" />
        </g>
      </svg>
    );
  }
  if (code <= 67 || (code >= 80 && code <= 82)) {
    // rain
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 16 a4 4 0 0 1 4 -4 a5 5 0 0 1 9 1 a3 3 0 0 1 0 6 H8 a3 3 0 0 1 -1 -3 z" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        <g stroke={accent} strokeWidth="1.5" strokeLinecap="round">
          <path d="M11 23 L9 28" /><path d="M16 23 L14 28" /><path d="M21 23 L19 28" />
        </g>
      </svg>
    );
  }
  if (code <= 77) {
    // snow
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 14 a4 4 0 0 1 4 -4 a5 5 0 0 1 9 1 a3 3 0 0 1 0 6 H8 a3 3 0 0 1 -1 -3 z" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        <g stroke={accent} strokeWidth="1.5" strokeLinecap="round">
          <path d="M11 23 L11 28 M9 25 L13 26" /><path d="M16 23 L16 28 M14 25 L18 26" /><path d="M21 23 L21 28 M19 25 L23 26" />
        </g>
      </svg>
    );
  }
  // thunderstorm
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 14 a4 4 0 0 1 4 -4 a5 5 0 0 1 9 1 a3 3 0 0 1 0 6 H8 a3 3 0 0 1 -1 -3 z" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <path d="M14 20 L12 25 H16 L13 30" stroke={accent} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function WeatherWidget({ lat, lon, label, date }: { lat: number; lon: number; label: string; date: string }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe%2FRome&start_date=${date}&end_date=${date}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) =>
        setForecast({
          date: j.daily.time[0],
          tMin: j.daily.temperature_2m_min[0],
          tMax: j.daily.temperature_2m_max[0],
          precip: j.daily.precipitation_sum[0],
          weatherCode: j.daily.weather_code[0],
        })
      )
      .catch((e) => setError(typeof e === 'string' ? e : 'Forecast unavailable'));
  }, [lat, lon, date]);

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-paper)',
    border: '1px solid var(--hairline)',
    borderRadius: 'var(--r-md)',
    padding: '14px 16px',
    boxShadow: 'var(--shadow-paper-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  };

  if (error) {
    return (
      <div style={cardStyle}>
        <span className="mono-cap" style={{ fontSize: 11, color: 'var(--ink-soft)', flex: 1 }}>
          Forecast outside 16-day window · check meteo.bz.it closer to {date}
        </span>
      </div>
    );
  }
  if (!forecast) {
    return (
      <div style={cardStyle}>
        <span className="mono-cap" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <WeatherGlyph code={forecast.weatherCode} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="mono tabular" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.02em' }}>
          {Math.round(forecast.tMin)}° <span style={{ color: 'var(--gold)', margin: '0 4px' }}>/</span> {Math.round(forecast.tMax)}°
          <span className="mono-cap" style={{ fontSize: 10, color: 'var(--gold)', marginLeft: 4 }}>°C</span>
        </div>
        <div className="mono-cap" style={{ fontSize: 9.5, color: 'var(--ink-soft)', marginTop: 4 }}>
          {label} · {forecast.precip > 0 ? `${forecast.precip} mm rain` : 'Dry'}
        </div>
      </div>
    </div>
  );
}
