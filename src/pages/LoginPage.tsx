import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 350));
    const ok = login(email, password);
    if (!ok) setError('Invalid email or password.');
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 bg-[#dc2626] rounded-xl flex items-center justify-center shadow-lg shadow-red-900/50">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <span className="text-white text-2xl font-bold tracking-tight">Limi</span>
          </div>
          <p className="text-[#555] text-sm">Content operations platform</p>
        </div>

        {/* Card */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-6 shadow-2xl">
          <h1 className="text-white font-semibold text-lg mb-0.5">Sign in</h1>
          <p className="text-[#555] text-sm mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#666] mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-[#0c0c0c] border border-[#222] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#dc2626] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#666] mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-[#0c0c0c] border border-[#222] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#dc2626] transition-colors"
              />
            </div>

            {error && (
              <div className="text-sm text-[#f87171] bg-[#dc2626]/10 border border-[#dc2626]/25 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1 shadow-lg shadow-red-900/30"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#333] text-xs mt-5">
          Private access only
        </p>
      </div>
    </div>
  );
}
