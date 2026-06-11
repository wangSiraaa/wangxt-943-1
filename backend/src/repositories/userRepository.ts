import { getDb } from '../database';
import type { User, UserRole } from '../types';

export function listUsers(role?: UserRole): User[] {
  const db = getDb();
  let list = [...db.users];
  if (role) list = list.filter((u) => u.role === role);
  return list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

export function getUserById(id: string): User | null {
  const db = getDb();
  return db.users.find((u) => u.id === id) || null;
}
