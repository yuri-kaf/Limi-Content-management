import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AppUser } from '../types';

// `loading` matters: Firebase resolves the session asynchronously, so routes
// must wait rather than assume signed-out and flash the login page.
// `unprovisioned` means the account authenticated but has no profile document —
// which is how a deleted user is denied access without deleting their login.
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unprovisioned';

interface AuthContextType {
  status: AuthStatus;
  isAuthenticated: boolean;
  currentUser: AppUser | null;
  userEmail: string;
  notice: string;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEPROVISIONED_NOTICE =
  'This account no longer has access. Ask an administrator to re-add you to the team.';

function signInErrorMessage(err: unknown): string {
  switch ((err as { code?: string })?.code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Try again later or reset your password.';
    case 'auth/network-request-failed':
      return 'Could not reach the server. Check your connection.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'Email/password sign-in is not enabled for this Firebase project yet.';
    default:
      return (err as Error)?.message ?? 'Could not sign in.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let unsubscribeProfile: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      unsubscribeProfile();
      unsubscribeProfile = () => {};

      if (!fbUser) {
        setCurrentUser(null);
        setStatus('signed-out');
        return;
      }

      setStatus('loading');

      // Live subscription rather than a one-off read, so role changes and
      // removal from the team take effect without a refresh.
      unsubscribeProfile = onSnapshot(
        doc(db, 'users', fbUser.uid),
        (snap) => {
          if (!snap.exists()) {
            setCurrentUser(null);
            setStatus('unprovisioned');
            setNotice(DEPROVISIONED_NOTICE);
            signOut(auth);
            return;
          }
          setCurrentUser({ id: snap.id, ...(snap.data() as Omit<AppUser, 'id'>) });
          setNotice('');
          setStatus('signed-in');
        },
        (err) => {
          console.error('[limi] profile subscription failed', err);
          setCurrentUser(null);
          setStatus('unprovisioned');
          setNotice(DEPROVISIONED_NOTICE);
          signOut(auth);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  // Resolves to an error message, or null on success.
  async function login(email: string, password: string): Promise<string | null> {
    try {
      setNotice('');
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      return null;
    } catch (err) {
      return signInErrorMessage(err);
    }
  }

  function logout() {
    setNotice('');
    signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        isAuthenticated: status === 'signed-in',
        currentUser,
        userEmail: currentUser?.email ?? '',
        notice,
        login,
        logout,
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
