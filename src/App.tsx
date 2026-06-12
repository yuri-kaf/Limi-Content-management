import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isConfigured } from './firebase';
import ClientsPage from './pages/ClientsPage';
import ClientBoardPage from './pages/ClientBoardPage';
import LoginPage from './pages/LoginPage';

function FirebaseSetupGuide() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#111] border border-[#1e1e1e] rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 bg-[#dc2626] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          <span className="text-white font-bold text-base">Limi · Setup Required</span>
        </div>
        <p className="text-[#888] text-sm mb-5 leading-relaxed">
          Firebase is not configured yet. Complete these steps to connect your database:
        </p>
        <ol className="text-sm text-[#666] space-y-2 mb-5">
          <li className="flex gap-2"><span className="text-[#dc2626] font-bold">1.</span>Create a project at <span className="text-[#888]">console.firebase.google.com</span></li>
          <li className="flex gap-2"><span className="text-[#dc2626] font-bold">2.</span><span>Enable <strong className="text-[#888]">Firestore Database</strong> (start in test mode)</span></li>
          <li className="flex gap-2"><span className="text-[#dc2626] font-bold">3.</span>Go to Project Settings → Your apps → Web</li>
          <li className="flex gap-2"><span className="text-[#dc2626] font-bold">4.</span>Copy your config and create a <code className="bg-[#1a1a1a] px-1 rounded text-[#aaa]">.env</code> file:</li>
        </ol>
        <pre className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl p-4 text-xs text-[#777] overflow-x-auto leading-relaxed">
{`VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id`}
        </pre>
        <p className="text-[#444] text-xs mt-4">Then restart the dev server with <code className="bg-[#1a1a1a] px-1 rounded">npm run dev</code></p>
      </div>
    </div>
  );
}

function AuthenticatedRoutes() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route path="/" element={<ClientsPage />} />
      <Route path="/client/:id" element={<ClientBoardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoginRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <LoginPage />;
}

export default function App() {
  if (!isConfigured) return <FirebaseSetupGuide />;

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={<AuthenticatedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
