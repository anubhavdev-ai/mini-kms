import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Session, getSession, setSession as persistSession, clearSession, SessionUser } from './api/client';

interface AuthContextValue {
  session: Session | null;
  login: (session: Session) => void;
  logout: () => void;
  updateUser: (user: Partial<SessionUser>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [session, setSessionState] = useState<Session | null>(() => getSession());

  const login = useCallback((next: Session) => {
    setSessionState(next);
    persistSession(next);
  }, []);

  const logout = useCallback(() => {
    setSessionState(null);
    clearSession();
  }, []);

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const updated: Session = {
        ...prev,
        user: {
          ...prev.user,
          ...patch,
        },
      };
      persistSession(updated);
      return updated;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, login, logout, updateUser }),
    [session, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
