import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, login, logout, selectActiveRole } from '../services/auth.js';
import { clearSession, getSession, saveSession } from '../services/session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getSession());
  const [initializing, setInitializing] = useState(Boolean(session));

  const reset = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  useEffect(() => {
    const handleExpired = () => reset();
    window.addEventListener('sipkita:session-expired', handleExpired);
    return () => window.removeEventListener('sipkita:session-expired', handleExpired);
  }, [reset]);

  useEffect(() => {
    if (!session) {
      setInitializing(false);
      return undefined;
    }
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (!active) return;
        const restored = saveSession({ ...getSession(), user });
        setSession(restored);
      })
      .catch(() => { if (active) reset(); })
      .finally(() => { if (active) setInitializing(false); });
    return () => { active = false; };
  }, []); // Sesi dipulihkan sekali saat aplikasi dimuat.

  const signIn = useCallback(async (credentials) => {
    const nextSession = saveSession(await login(credentials));
    setSession(nextSession);
    return nextSession;
  }, []);

  const chooseRole = useCallback(async (role) => {
    const nextSession = saveSession(await selectActiveRole(role));
    setSession(nextSession);
    return nextSession;
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    reset();
  }, [reset]);

  const value = useMemo(() => ({
    session, initializing, signIn, chooseRole, signOut, clear: reset,
  }), [session, initializing, signIn, chooseRole, signOut, reset]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return value;
}
