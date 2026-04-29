import { useEffect, useState } from 'react';

type Forecast = {
  date: string;
  tMin: number;
  tMax: number;
  precip: number;
  weatherCode: number;
};

const codeToEmoji = (code: number): string => {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫';
  if (code <= 67) return '🌧';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧';
  if (code >= 95) return '⛈';
  return '·';
};

export default function WeatherWidget({ lat, lon, label, date }: { lat: number; lon: number; label: string; date: string }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe%2FRome&start_date=${date}&end_date=${date}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((j) => setForecast({
        date: j.daily.time[0],
        tMin: j.daily.temperature_2m_min[0],
        tMax: j.daily.temperature_2m_max[0],
        precip: j.daily.precipitation_sum[0],
        weatherCode: j.daily.weather_code[0],
      }))
      .catch((e) => setError(typeof e === 'string' ? e : 'Forecast unavailable'));
  }, [lat, lon, date]);

  if (error) return <div className="card text-xs text-ink-muted">Weather: {error}</div>;
  if (!forecast) return <div className="card text-xs text-ink-muted">Loading forecast...</div>;

  return (
    <div className="card flex items-center justify-between text-sm">
      <div>
        <div className="text-2xl">{codeToEmoji(forecast.weatherCode)}</div>
      </div>
      <div className="text-right">
        <div className="font-semibold">{Math.round(forecast.tMin)}° / {Math.round(forecast.tMax)}°C</div>
        <div className="text-[11px] text-ink-muted">{label} · {forecast.precip > 0 ? `${forecast.precip} mm rain` : 'Dry'}</div>
      </div>
    </div>
  );
}
