import { useEffect, useState } from 'react';
import { getActiveWeatherAlert } from '../api';
import type { WeatherAlert } from '../types';
import { WEATHER_LABELS, WEATHER_COLORS } from '../types';

export default function WeatherBanner() {
  const [alert, setAlert] = useState<WeatherAlert | null>(null);

  useEffect(() => {
    const fetchAlert = async () => {
      try {
        const a = await getActiveWeatherAlert();
        setAlert(a);
      } catch {
        /* ignore */
      }
    };
    fetchAlert();
    const timer = setInterval(fetchAlert, 60000);
    return () => clearInterval(timer);
  }, []);

  if (!alert) return null;

  const isWarning = alert.level !== 'normal';

  return (
    <div
      className={`border-t border-b backdrop-blur-sm ${
        isWarning ? WEATHER_COLORS[alert.level] : 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-3 text-sm">
        <span className="text-lg">
          {alert.level === 'normal'
            ? '☀️'
            : alert.level === 'yellow'
              ? '⚠️'
              : alert.level === 'orange'
                ? '🌪️'
                : '🚨'}
        </span>
        <span className="font-semibold">
          【{WEATHER_LABELS[alert.level]}】{alert.title}
        </span>
        <span className="flex-1 opacity-90">{alert.description}</span>
        {isWarning && (
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/30 font-medium">
            🔒 预警期间禁止出港
          </span>
        )}
      </div>
    </div>
  );
}
