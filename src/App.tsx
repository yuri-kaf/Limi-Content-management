import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { isConfigured } from './firebase';
import TodayPage from './pages/TodayPage';
import ClientsPage from './pages/ClientsPage';
import ProfilePage from './pages/ProfilePage';
import ClientWorkspacePage from './pages/ClientWorkspacePage';
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import PublicReviewPage from './pages/PublicReviewPage';
import AppShell from './components/AppShell';
import Logo from './components/Logo';
import { page, card, heading, bodyText, faintText, inset } from './ui';

const codeInline = 'bg-tint dark:bg-tint-dark px-1 rounded-[4px] text-ink-soft dark:text-ink-softdark';

function FirebaseSetupGuide() {
  return (
    <div className={`${page} flex items-center justify-center p-4`}>
      <div className={`${card} max-w-md w-full p-6`}>
        <div className="flex items-center gap-2.5 mb-5">
          <Logo variant="mark" size={32} />
          <span className={`${heading} text-base`}>Limi · Setup required</span>
        </div>
        <p className={`text-sm mb-5 leading-relaxed ${bodyText}`}>
          Firebase is not configured yet. Complete these steps to connect your database:
        </p>
        <ol className={`text-sm space-y-2 mb-5 ${bodyText}`}>
          <li className="flex gap-2"><span className="text-brand font-bold">1.</span>Create a project at <span className="text-ink dark:text-ink-dark">console.firebase.google.com</span></li>
          <li className="flex gap-2"><span className="text-brand font-bold">2.</span><span>Enable <strong className="text-ink dark:text-ink-dark">Firestore Database</strong> (start in test mode)</span></li>
          <li className="flex gap-2"><span className="text-brand font-bold">3.</span>Go to Project Settings → Your apps → Web</li>
          <li className="flex gap-2"><span className="text-brand font-bold">4.</span>Copy your config and create a <code className={codeInline}>.env</code> file:</li>
        </ol>
        <pre className={`${inset} p-4 text-xs leading-relaxed overflow-x-auto ${bodyText}`}>
{`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`}
        </pre>
        <p className={`text-xs mt-4 ${faintText}`}>
          Then restart the dev server with <code className={codeInline}>npm run dev</code>
        </p>
      </div>
    </div>
  );
}

function AuthSplash() {
  return (
    <div className={`${page} flex items-center justify-center`}>
      <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
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
      {/* Home answers "what needs me"; the clients grid answers "what exists",
          which is a different and much rarer question. */}
      <Route path="/" element={<AppShell><TodayPage /></AppShell>} />
      <Route path="/clients" element={<AppShell><ClientsPage /></AppShell>} />
      <Route path="/profile" element={<AppShell><ProfilePage /></AppShell>} />
      {/* :tab is optional, so the bare /client/:id every older link uses still
          opens the default tab. */}
      <Route path="/client/:id/campaign/:campaignId" element={<AppShell><ClientWorkspacePage /></AppShell>} />
      <Route path="/client/:id/:tab?" element={<AppShell><ClientWorkspacePage /></AppShell>} />
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
