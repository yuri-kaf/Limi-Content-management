import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import {
  page, card, heading, bodyText, faintText, label, input, btnPrimary, btnIcon, inset,
} from '../ui';

export default function LoginPage() {
  const { login, notice } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const failure = await login(email, password);
    if (failure) setError(failure);
    setLoading(false);
  }

  return (
    <div className={`${page} flex items-center justify-center p-4`}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className={`${btnIcon} fixed top-4 right-4`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <Logo variant="full" size={92} />
          </div>
          <p className={`text-sm ${faintText}`}>Content operations platform</p>
        </div>

        {/* Card */}
        <div className={`${card} p-6`}>
          <h1 className={`${heading} text-lg mb-0.5`}>Sign in</h1>
          <p className={`text-sm mb-6 ${faintText}`}>Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className={input}
              />
            </div>

            <div>
              <label className={label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className={input}
              />
            </div>

            {notice && !error && (
              <div className={`${inset} px-3 py-2.5 text-sm ${bodyText}`}>{notice}</div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-tile border border-brand/30 dark:border-red-900/60 bg-brand-soft dark:bg-red-950/30 px-3 py-2.5 text-sm text-brand dark:text-red-400"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={`${btnPrimary} w-full mt-1`}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className={`text-center text-xs mt-5 ${faintText}`}>Private access only</p>
      </div>
    </div>
  );
}
