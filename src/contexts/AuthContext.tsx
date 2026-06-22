import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser, UserRole } from '../types';

const SESSION_KEY = 'limi_user_v2';
const ADMIN_EMAIL = 'ashimkafle@gmail.com';
const ADMIN_PASSWORD = 'getContent-Limi-098';

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: AppUser | null;
  userEmail: string;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshCurrentUser: (updated: AppUser) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      return stored ? (JSON.parse(stored) as AppUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    async function seedAdminIfNeeded() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (snap.empty) {
          await addDoc(collection(db, 'users'), {
            name: 'Ashim Kafle',
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: 'admin' as UserRole,
            assignedClientIds: [],
            createdAt: Date.now(),
          });
        }
      } catch {
        // Firebase may not be ready
      }
    }
    seedAdminIfNeeded();
  }, []);

  async function login(email: string, password: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'users'),
        where('email', '==', email.trim().toLowerCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) return false;
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      if (data.password !== password) return false;
      const user: AppUser = { id: docSnap.id, ...data } as AppUser;
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      setCurrentUser(user);
      return true;
    } catch {
      return false;
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }

  function refreshCurrentUser(updated: AppUser) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setCurrentUser(updated);
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!currentUser,
        currentUser,
        userEmail: currentUser?.email ?? '',
        login,
        logout,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
