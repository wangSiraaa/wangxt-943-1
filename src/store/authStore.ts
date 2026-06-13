import { create } from "zustand";

export interface User {
  id: string;
  username: string;
  name: string;
  role: "admin" | "duty_officer" | "captain" | "supervisor";
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "登录失败");
      }
      const data = await res.json();
      const user: User = data.data;
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "登录失败",
        isLoading: false,
      });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("user");
    set({ user: null, error: null });
  },

  loadUser: () => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        set({ user: JSON.parse(stored) });
      } catch {
        localStorage.removeItem("user");
      }
    }
  },
}));
