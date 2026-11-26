import { Sun, Moon, LogOut, Mail, Shield } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  shellPad, heading, faintText, bodyText, card, btnGhost, btnGhostDanger, sectionLabel,
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

  const row = 'flex items-center gap-3 px-4 py-3';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shellPad} max-w-[600px] py-6`}>
        <h1 className={`${heading} text-[22px] leading-8 font-normal mb-5`}>Profile</h1>

        <div className={`${card} overflow-hidden mb-6`}>
          <div className={row}>
            <Mail size={18} className={faintText} />
            <div className="min-w-0">
              <div className={sectionLabel}>Email</div>
              <div className={`text-[13px] truncate ${bodyText}`}>
                {currentUser?.email ?? '—'}
              </div>
            </div>
          </div>
          <div className="mx-4 h-px bg-hairline dark:bg-hairline-dark" />
          <div className={row}>
            <Shield size={18} className={faintText} />
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
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
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
