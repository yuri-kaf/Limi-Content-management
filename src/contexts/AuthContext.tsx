import { createContext, useContext, useState, ReactNode } from 'react';

const VALID_EMAIL = 'ashimkafle@gmail.com';
const VALID_PASSWORD = 'getContent-Limi-098';
const SESSION_KEY = 'limi_auth';

interface AuthContextType {
  isAuthenticated: boolean;
  userEmail: string;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(SESSION_KEY) === '1';
  });

  function login(email: string, password: string): boolean {
    if (email.trim().toLowerCase() === VALID_EMAIL && password === VALID_PASSWORD) {
      localStorage.setItem(SESSION_KEY, '1');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, userEmail: VALID_EMAIL, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
