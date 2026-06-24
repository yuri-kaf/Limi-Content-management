import { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { requestNotificationPermission } from '../hooks/useNotifications';

const DISMISSED_KEY = 'limi_notif_banner_dismissed';

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
      <div className="mb-5 bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-950/60 flex items-center justify-center flex-shrink-0">
          <Check size={14} className="text-emerald-400" />
        </div>
        <p className="text-sm text-emerald-600 dark:text-emerald-300 font-medium">
          Reminders enabled — you'll be notified when it's time to post.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-5 bg-white dark:bg-[#111] border border-[#dc2626]/25 rounded-xl px-4 py-3.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#dc2626]/10 flex items-center justify-center flex-shrink-0">
        <Bell size={15} className="text-[#dc2626]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">Enable post reminders</p>
        <p className="text-xs text-neutral-400 dark:text-[#555] mt-0.5 leading-relaxed">
          Get notified on this device when scheduled content is due to post.
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleEnable}
          disabled={enabling}
          className="text-xs font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] transition-colors px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {enabling ? 'Enabling…' : 'Enable'}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-neutral-400 dark:text-[#444] hover:text-neutral-600 dark:hover:text-[#666] active:text-neutral-700 transition-colors rounded-lg"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
