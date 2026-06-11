import { getDb, saveDb, generateId } from '../database';
import type { WeatherAlert } from '../types';

export function getActiveWeatherAlert(): WeatherAlert | null {
  const db = getDb();
  const now = new Date();
  return (
    db.weatherAlerts
      .filter(
        (a) =>
          a.isActive &&
          new Date(a.effectiveFrom) <= now &&
          new Date(a.effectiveTo) >= now,
      )
      .sort((a, b) => {
        const levelOrder = { red: 3, orange: 2, yellow: 1, normal: 0 };
        return levelOrder[b.level] - levelOrder[a.level];
      })[0] || null
  );
}

export function isWeatherWarningActive(): boolean {
  const alert = getActiveWeatherAlert();
  return alert !== null && alert.level !== 'normal';
}

export function listWeatherAlerts(): WeatherAlert[] {
  const db = getDb();
  return [...db.weatherAlerts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function setWeatherAlert(alert: Omit<WeatherAlert, 'id' | 'createdAt'>): WeatherAlert {
  const db = getDb();
  const now = new Date().toISOString();
  if (alert.isActive) {
    db.weatherAlerts.forEach((a) => (a.isActive = false));
  }
  const newAlert: WeatherAlert = {
    ...alert,
    id: generateId(),
    createdAt: now,
  };
  db.weatherAlerts.push(newAlert);
  saveDb(db);
  return newAlert;
}
