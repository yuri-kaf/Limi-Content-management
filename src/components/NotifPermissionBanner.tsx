import { useState, useEffect } from 'react';
import { Bell, X, Check } from '../icons';
import { requestNotificationPermission } from '../hooks/useNotifications';
import { card, heading, faintText, btnIcon, btnPrimarySm } from '../ui';

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
      <div
        role="status"
        className="mb-4 rounded-card bg-success-soft dark:bg-success-softdark px-4 py-3 flex items-center gap-3"
      >
        <Check size={16} className="text-success-text dark:text-success-textdark flex-shrink-0" />
        <p className="text-[13px] font-medium text-success-text dark:text-success-textdark">
          Reminders enabled — you'll be notified when it's time to post.
        </p>
      </div>
    );
  }

  return (
    <div className={`${card} mb-4 px-4 py-2.5 flex items-center gap-3`}>
      <Bell size={18} className="text-ink-soft dark:text-ink-softdark flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`${heading} text-[13px] leading-tight`}>Enable post reminders</p>
        <p className={`text-[12px] mt-0.5 leading-snug ${faintText}`}>
          Get notified on this device when scheduled content is due to post.
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={handleEnable} disabled={enabling} className={btnPrimarySm}>
          {enabling ? 'Enabling…' : 'Enable'}
        </button>
        <button onClick={handleDismiss} className={btnIcon} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
