import { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { requestNotificationPermission } from '../hooks/useNotifications';
import { card, heading, faintText, btnIcon } from '../ui';

const DISMISSED_KEY = 'limi_notif_banner_dismissed';

// btnPrimary's 44px minimum cannot be overridden by a smaller height (Tailwind,
// not the class list, orders the two), so the banner's compact button is its own.
const enableBtn =
  'inline-flex items-center h-8 px-3 rounded-tile bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40';

export default function NotifPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) {
      setDismissed(true);
      return;
    }
    setPermission(Notification.permission);
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
  }, []);

  if (permission === null) return null;
  if (permission === 'granted' && !justEnabled) return null;
  if (permission === 'denied') return null;
  if (dismissed && !justEnabled) return null;

  async function handleEnable() {
    setEnabling(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    setEnabling(false);
    if (result === 'granted') {
      setJustEnabled(true);
      setTimeout(() => setJustEnabled(false), 3000);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  if (justEnabled) {
    return (
      <div
        role="status"
        className="mb-5 rounded-card border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 flex items-center gap-3"
      >
        <div className="w-7 h-7 rounded-tile bg-white dark:bg-emerald-950/60 flex items-center justify-center flex-shrink-0">
          <Check size={14} className="text-emerald-700 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          Reminders enabled — you'll be notified when it's time to post.
        </p>
      </div>
    );
  }

  return (
    <div className={`${card} mb-5 !border-brand/25 px-4 py-3.5 flex items-center gap-3`}>
      <div className="w-8 h-8 rounded-tile bg-brand-soft dark:bg-brand-softdark flex items-center justify-center flex-shrink-0">
        <Bell size={15} className="text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`${heading} text-sm leading-tight`}>Enable post reminders</p>
        <p className={`text-xs mt-0.5 leading-relaxed ${faintText}`}>
          Get notified on this device when scheduled content is due to post.
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={handleEnable} disabled={enabling} className={enableBtn}>
          {enabling ? 'Enabling…' : 'Enable'}
        </button>
        <button onClick={handleDismiss} className={btnIcon} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
