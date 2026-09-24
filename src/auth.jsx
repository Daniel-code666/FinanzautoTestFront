import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { readSession, SESSION_KEY } from './lib/session';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  function logout() { localStorage.removeItem(SESSION_KEY); setSession(null); }
  function login(value) { localStorage.setItem(SESSION_KEY, JSON.stringify(value)); setSession(value); }
  function updateProfile(profile) {
    const current = readSession();
    // Never restore an expired session or overwrite a login from another tab.
    if (!current || current.accessToken !== session?.accessToken) return;
    const updated = {
      ...current,
      user: { ...current.user, firstName: profile.firstName, lastName: profile.lastName, email: profile.email },
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setSession(updated);
  }
  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener('storage', sync);
    window.addEventListener('auth:expired', logout);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('auth:expired', logout); };
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(logout, Math.max(0, Date.parse(session.expiresAtUtc) - Date.now()));
    return () => clearTimeout(timer);
  }, [session]);
  return <AuthContext.Provider value={{ session, login, logout, updateProfile }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
export function AuthGuard() { return useAuth().session ? <Outlet /> : <Navigate to="/login" replace />; }
