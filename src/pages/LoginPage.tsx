import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, password);
    if (!ok) setError('Invalid email or password.');
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#080808] flex items-center justify-center p-4">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg text-neutral-400 dark:text-[#444] hover:text-neutral-600 dark:hover:text-[#888] hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 bg-[#dc2626] rounded-xl flex items-center justify-center shadow-lg shadow-red-900/50">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <span className="text-neutral-900 dark:text-white text-2xl font-bold tracking-tight">Limi</span>
          </div>
          <p className="text-neutral-400 dark:text-[#555] text-sm">Content operations platform</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-2xl p-6 shadow-2xl">
          <h1 className="text-neutral-900 dark:text-white font-semibold text-lg mb-0.5">Sign in</h1>
          <p className="text-neutral-400 dark:text-[#555] text-sm mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 dark:text-[#666] mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-neutral-100 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#222] rounded-lg px-3 py-2.5 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-[#3a3a3a] focus:outline-none focus:border-[#dc2626] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 dark:text-[#666] mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-neutral-100 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#222] rounded-lg px-3 py-2.5 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-[#3a3a3a] focus:outline-none focus:border-[#dc2626] transition-colors"
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

        <p className="text-center text-neutral-300 dark:text-[#333] text-xs mt-5">
          Private access only
        </p>
      </div>
    </div>
  );
}
