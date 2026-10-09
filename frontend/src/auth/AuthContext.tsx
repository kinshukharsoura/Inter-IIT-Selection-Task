import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiError, setUnauthorizedListener } from '../api/client';
import { authApi } from '../api/endpoints';
import type { User } from '../api/types';
import { tokenStorage } from './tokenStorage';

/** `unavailable`: a token exists but the server could not be reached to verify it. */
type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-run the session check after `unavailable`. */
  retrySession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.get() ? 'loading' : 'anonymous',
  );

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  const [sessionCheck, setSessionCheck] = useState(0);
  const retrySession = useCallback(() => {
    setStatus('loading');
    setSessionCheck((n) => n + 1);
  }, []);

  // Restore the session from a stored token. Only a 401 means the token is bad;
  // other failures (server restarting, network down) keep the token for a retry.
  useEffect(() => {
    if (!tokenStorage.get()) return;
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) logout();
        else setStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [logout, sessionCheck]);

  useEffect(() => {
    setUnauthorizedListener(logout);
    return () => setUnauthorizedListener(null);
  }, [logout]);

  const startSession = useCallback((token: string, me: User) => {
    tokenStorage.set(token);
    setUser(me);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login: async (email, password) => {
        const { token, user: me } = await authApi.login(email, password);
        startSession(token, me);
      },
      register: async (name, email, password) => {
        const { token, user: me } = await authApi.register(name, email, password);
        startSession(token, me);
      },
      logout,
      retrySession,
    }),
    [user, status, startSession, logout, retrySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
