import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import type { User, UserRole } from '../types';
import { listUsers } from '../api';

interface UserContextValue {
  currentUser: User | null;
  users: User[];
  switchUser: (userId: string) => void;
  usersByRole: (role: UserRole) => User[];
  loading: boolean;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

const STORAGE_KEY = 'fishing_port_current_user';

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const list = await listUsers();
        setUsers(list);
        const savedId = localStorage.getItem(STORAGE_KEY);
        const saved = savedId ? list.find((u) => u.id === savedId) : list[0];
        setCurrentUser(saved || list[0] || null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const switchUser = useCallback(
    (userId: string) => {
      const user = users.find((u) => u.id === userId) || null;
      setCurrentUser(user);
      if (user) localStorage.setItem(STORAGE_KEY, user.id);
      else localStorage.removeItem(STORAGE_KEY);
    },
    [users],
  );

  const usersByRole = useCallback(
    (role: UserRole) => users.filter((u) => u.role === role),
    [users],
  );

  return (
    <UserContext.Provider
      value={{ currentUser, users, switchUser, usersByRole, loading }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
