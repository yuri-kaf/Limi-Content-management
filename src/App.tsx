import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { isConfigured } from './firebase';
import ClientsPage from './pages/ClientsPage';
import ClientBoardPage from './pages/ClientBoardPage';
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import PublicReviewPage from './pages/PublicReviewPage';
import AppShell from './components/AppShell';

function FirebaseSetupGuide() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#080808] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 bg-[#dc2626] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <span className="text-neutral-900 dark:text-white font-bold text-base">Limi · Setup Required</span>
        </div>
        <p className="text-neutral-500 dark:text-[#888] text-sm mb-5 leading-relaxed">
          Firebase is not configured yet. Complete these steps to connect your database:
        </p>
        <ol className="text-sm text-neutral-500 dark:text-[#666] space-y-2 mb-5">
          <li className="flex gap-2"><span className="text-[#dc2626] font-bold">1.</span>Create a project at <span className="text-neutral-600 dark:text-[#888]">console.firebase.google.com</span></li>
          <li className="flex gap-2"><span className="text-[#dc2626] font-bold">2.</span><span>Enable <strong className="text-neutral-600 dark:text-[#888]">Firestore Database</strong> (start in test mode)</span></li>
          <li className="flex gap-2"><span className="text-[#dc2626] font-bold">3.</span>Go to Project Settings → Your apps → Web</li>
          <li className="flex gap-2"><span className="text-[#dc2626] font-bold">4.</span>Copy your config and create a <code className="bg-neutral-100 dark:bg-[#1a1a1a] px-1 rounded text-neutral-600 dark:text-[#aaa]">.env</code> file:</li>
        </ol>
        <pre className="bg-neutral-100 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#1a1a1a] rounded-xl p-4 text-xs text-neutral-500 dark:text-[#777] overflow-x-auto leading-relaxed">
{`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`}
        </pre>
        <p className="text-neutral-400 dark:text-[#444] text-xs mt-4">Then restart the dev server with <code className="bg-neutral-100 dark:bg-[#1a1a1a] px-1 rounded">npm run dev</code></p>
      </div>
    </div>
  );
}

function AuthSplash() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#080808] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-neutral-200 dark:border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
    </div>
  );
}

function AuthenticatedRoutes() {
  const { status } = useAuth();
  // Wait for Firebase to resolve the session — redirecting during `loading`
  // would bounce a signed-in user to the login page on every refresh.
  if (status === 'loading') return <AuthSplash />;
  if (status !== 'signed-in') return <Navigate to="/login" replace />;
  return (
    <Routes>
      {/* AppShell sits inside the route so useParams() can read :id for the
          breadcrumb and the active sidebar item. */}
      <Route path="/" element={<AppShell><ClientsPage /></AppShell>} />
      <Route path="/client/:id" element={<AppShell><ClientBoardPage /></AppShell>} />
      <Route path="/users" element={<AppShell><UserManagementPage /></AppShell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoginRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <AuthSplash />;
  if (status === 'signed-in') return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  if (!isConfigured) return <ThemeProvider><FirebaseSetupGuide /></ThemeProvider>;

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Outside the auth gate on purpose — the token is the credential. */}
            <Route path="/review/:token" element={<PublicReviewPage />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*" element={<AuthenticatedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
