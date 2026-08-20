import { Sun, Moon, LogOut, Mail, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  shell, heading, faintText, bodyText, card, btnGhost, btnGhostDanger, sectionLabel,
} from '../ui';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  'social-media-manager': 'Social media manager',
  client: 'Client',
};

// Everything about "you" in one place. On a phone the sidebar footer that used
// to hold this is behind a drawer, which is the wrong place for a sign-out.
export default function ProfilePage() {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const row = 'flex items-center gap-3 px-3.5 py-3';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shell} py-6 max-w-[600px]`}>
        <h1 className={`${heading} text-lg mb-6`}>Profile</h1>

        <div className={`${card} divide-y divide-hairline dark:divide-hairline-dark mb-6`}>
          <div className={row}>
            <Mail size={15} className={faintText} />
            <div className="min-w-0">
              <div className={sectionLabel}>Email</div>
              <div className={`text-[13px] truncate ${bodyText}`}>
                {currentUser?.email ?? '—'}
              </div>
            </div>
          </div>
          <div className={row}>
            <Shield size={15} className={faintText} />
            <div className="min-w-0">
              <div className={sectionLabel}>Role</div>
              <div className={`text-[13px] ${bodyText}`}>
                {currentUser ? ROLE_LABELS[currentUser.role] ?? currentUser.role : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className={sectionLabel}>Appearance</div>
        <button onClick={toggleTheme} className={`${btnGhost} w-full mt-2 justify-start`}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        </button>

        <div className={`${sectionLabel} block mt-6`}>Session</div>
        <button onClick={logout} className={`${btnGhostDanger} w-full mt-2 justify-start`}>
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  );
}
