import axios, { AxiosInstance } from 'axios';
import type {
  Voyage,
  CrewMember,
  WeatherAlert,
  User,
  UserRole,
  CreateVoyageInput,
  CrewVerification,
  AuditLog,
} from '../types';

const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getHealth() {
  const res = await api.get('/health');
  return res.data;
}

export async function listUsers(role?: UserRole) {
  const params = role ? { role } : {};
  const res = await api.get<{ users: User[] }>('/users', { params });
  return res.data.users;
}

export async function getUserById(id: string) {
  const res = await api.get<{ user: User }>(`/users/${id}`);
  return res.data.user;
}

export async function getActiveWeatherAlert() {
  const res = await api.get<{ alert: WeatherAlert | null }>('/weather/alert');
  return res.data.alert;
}

export async function listWeatherAlerts() {
  const res = await api.get<{ alerts: WeatherAlert[] }>('/weather/alerts');
  return res.data.alerts;
}

export async function setWeatherAlert(
  alert: Omit<WeatherAlert, 'id' | 'createdAt'>,
) {
  const res = await api.post<{ alert: WeatherAlert }>('/weather/alert', alert);
  return res.data.alert;
}

export async function listVoyages(status?: string, captainId?: string) {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  if (captainId) params.captainId = captainId;
  const res = await api.get<{ voyages: Voyage[] }>('/voyages', { params });
  return res.data.voyages;
}

export async function getVoyageDetail(id: string) {
  const res = await api.get<{
    voyage: Voyage;
    crew: CrewMember[];
    auditLogs: AuditLog[];
  }>(`/voyages/${id}`);
  return res.data;
}

export async function createVoyage(input: CreateVoyageInput) {
  const res = await api.post<{ voyage: Voyage }>('/voyages', input);
  return res.data.voyage;
}

export async function verifyCrew(
  voyageId: string,
  verifiedBy: string,
  crewVerifications: CrewVerification[],
) {
  const res = await api.post<{ success: boolean }>(
    `/voyages/${voyageId}/verify-crew`,
    { verifiedBy, crewVerifications },
  );
  return res.data.success;
}

export async function departVoyage(voyageId: string, departedBy: string) {
  const res = await api.post<{ success: boolean }>(
    `/voyages/${voyageId}/depart`,
    { departedBy },
  );
  return res.data.success;
}

export async function returnVoyage(voyageId: string, returnedBy: string) {
  const res = await api.post<{ success: boolean }>(
    `/voyages/${voyageId}/return`,
    { returnedBy },
  );
  return res.data.success;
}

export async function closeVoyage(voyageId: string, closedBy: string) {
  const res = await api.post<{ success: boolean }>(
    `/voyages/${voyageId}/close`,
    { closedBy },
  );
  return res.data.success;
}

export async function listAuditLogs() {
  const res = await api.get<{ logs: AuditLog[] }>('/audit-logs');
  return res.data.logs;
}
