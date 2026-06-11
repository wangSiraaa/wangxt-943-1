import fs from 'fs';
import path from 'path';
import type { Database, User } from './types';

let dbPath: string | null = null;
let cache: Database | null = null;

function getDataDir(): string {
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getDbPath(): string {
  if (!dbPath) {
    dbPath = path.join(getDataDir(), 'fishing_port.json');
  }
  return dbPath;
}

function defaultUsers(): User[] {
  return [
    { id: 'captain-1', name: '张船长', role: 'captain', phone: '13800138000' },
    { id: 'captain-2', name: '李船长', role: 'captain', phone: '13800138001' },
    { id: 'watchkeeper-1', name: '王值班员', role: 'watchkeeper', phone: '13800138002' },
    { id: 'watchkeeper-2', name: '赵值班员', role: 'watchkeeper', phone: '13800138003' },
    { id: 'supervisor-1', name: '陈监管员', role: 'supervisor', phone: '13800138004' },
    { id: 'supervisor-2', name: '刘监管员', role: 'supervisor', phone: '13800138005' },
  ];
}

function defaultData(): Database {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    voyages: [],
    crewMembers: [],
    weatherAlerts: [
      {
        id: 'alert-1',
        level: 'normal',
        title: '天气正常',
        description: '当前气象条件良好，适宜出海作业。',
        effectiveFrom: from,
        effectiveTo: to,
        isActive: true,
        createdAt: now.toISOString(),
      },
    ],
    auditLogs: [],
    users: defaultUsers(),
  };
}

export function getDb(): Database {
  if (cache) return cache;
  const p = getDbPath();
  if (!fs.existsSync(p)) {
    const data = defaultData();
    cache = data;
    saveDb(data);
    return data;
  }
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    let data = JSON.parse(raw) as Database;
    let needSave = false;
    if (!data.users || data.users.length === 0) {
      data = { ...data, users: defaultUsers() };
      needSave = true;
    }
    if (!data.auditLogs) {
      data = { ...data, auditLogs: [] };
      needSave = true;
    }
    cache = data;
    if (needSave) saveDb(data);
    return data;
  } catch {
    const data = defaultData();
    cache = data;
    saveDb(data);
    return data;
  }
}

export function saveDb(data: Database): void {
  cache = data;
  fs.writeFileSync(getDbPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
  );
}
