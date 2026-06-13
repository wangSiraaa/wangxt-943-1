import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

export function toCamelCaseKeys<T = unknown>(obj: unknown): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCaseKeys(item)) as T
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[toCamelCase(key)] = toCamelCaseKeys(value)
    }
    return result as T
  }
  return obj as T
}

export function getCurrentUserId(): string | null {
  const stored = localStorage.getItem("user")
  if (stored) {
    try {
      const user = JSON.parse(stored)
      return user.id || null
    } catch {
      return null
    }
  }
  return null
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const userId = getCurrentUserId()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (userId) {
    headers["x-user-id"] = userId
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(
      (errData as { error?: string; message?: string }).error ||
        (errData as { error?: string; message?: string }).message ||
        `请求失败: ${endpoint}`
    )
  }

  const json = await res.json()
  const data = json.success && json.data !== undefined ? json.data : json
  return toCamelCaseKeys<T>(data)
}
