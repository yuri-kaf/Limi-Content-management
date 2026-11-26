import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from '../icons';
import {
  page, heading, bodyText, faintText, label, input, btnPrimary, btnIcon,
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
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-[420px]">
        {/* One surface, 28px radius, the way an M3 sign-in sheet sits on the
            page: the logo, a single headline, the form. */}
        <div className="bg-raised dark:bg-raised-dark rounded-dialog px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col items-center text-center mb-7">
            <Logo variant="full" size={84} />
            <h1 className={`${heading} text-[24px] leading-8 font-normal mt-6`}>Sign in</h1>
            <p className={`text-[13px] mt-1 ${faintText}`}>to the Limi content platform</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className={label}>Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className={`${input} !bg-canvas dark:!bg-canvas-dark`}
              />
            </div>

            <div>
              <label htmlFor="login-password" className={label}>Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className={`${input} !bg-canvas dark:!bg-canvas-dark`}
              />
            </div>

            {notice && !error && (
              <div className={`bg-hover dark:bg-hover-dark rounded-tile px-3 py-2.5 text-[13px] ${bodyText}`}>{notice}</div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-tile bg-brand-soft dark:bg-brand-softdark px-3 py-2.5 text-[13px] text-brand-on dark:text-brand-ondark"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={`${btnPrimary} w-full mt-2`}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className={`text-center text-[12px] mt-5 ${faintText}`}>Private access only</p>
      </div>
    </div>
  );
}
