import { createContext, useContext, useState, useEffect } from 'react';
import { apiGetMe } from '../api';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  // On mount (or token change), validate the stored token
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const MAX_RETRIES = 2;

    const validateToken = async (attempt = 1) => {
      try {
        const userData = await apiGetMe(token);
        if (!cancelled) setUser(userData);
      } catch (err) {
        if (cancelled) return;

        // Only clear the token if the server explicitly says 401 (invalid/expired).
        // The error message from api.js contains "Not authenticated" for 401s.
        const isAuthError =
          err.message === 'Not authenticated' ||
          err.message?.includes('401');

        if (isAuthError) {
          // Token is genuinely invalid — clear it
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
        } else if (attempt < MAX_RETRIES) {
          // Network/timeout error — retry after a short delay
          await new Promise((r) => setTimeout(r, 2000));
          return validateToken(attempt + 1);
        }
        // If all retries exhausted for network errors, keep token and
        // let the user stay "logged in" — next action will re-validate.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const loginWithToken = (newToken, userData) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isLoggedIn: !!user,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
