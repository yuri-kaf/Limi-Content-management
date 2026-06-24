import { useEffect, useRef } from 'react';
import { Client } from '../types';

// How far ahead we schedule timers (24 h)
const WINDOW_MS = 24 * 60 * 60 * 1000;
// How far back we check for "missed" posts on app open (2 h)
const MISSED_WINDOW_MS = 2 * 60 * 60 * 1000;
// localStorage key for tracking already-fired notification IDs
const FIRED_KEY = 'limi_fired_notifs_v1';

function getFired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markFired(id: string) {
  const fired = getFired();
  fired.add(id);
  // Cap at 500 entries to avoid unbounded growth
  const arr = [...fired].slice(-500);
  localStorage.setItem(FIRED_KEY, JSON.stringify(arr));
}

function sendToSW(title: string, body: string, clientId: string, itemId: string) {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      clientId,
      itemId,
    });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    // Fallback if SW not yet controlling the page
    new Notification(title, { body });
  }
}

export function useNotifications(clients: Client[]) {
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (clients.length === 0) return;

    // Clear any previously scheduled timers
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];

    const now = Date.now();
    const fired = getFired();

    clients.forEach((client) => {
      client.content.forEach((item) => {
        if (!item.scheduledAt || item.scheduledAt <= 0) return;

        const notifId = `${item.id}-${item.scheduledAt}`;
        if (fired.has(notifId)) return;

        const delay = item.scheduledAt - now;

        // Missed posts: were scheduled in the past 2 hours → notify immediately
        if (delay < 0 && delay >= -MISSED_WINDOW_MS) {
          markFired(notifId);
          sendToSW(
            '⏰ Missed post reminder',
            `${item.title} · ${client.name} (was due earlier)`,
            client.id,
            item.id,
          );
          return;
        }

        // Upcoming posts: within the next 24 hours
        if (delay > 0 && delay <= WINDOW_MS) {
          const tid = setTimeout(() => {
            markFired(notifId);
            sendToSW(
              '🕐 Time to post!',
              `${item.title} · ${client.name}`,
              client.id,
              item.id,
            );
          }, delay);
          timerRefs.current.push(tid);
        }
      });
    });

    return () => {
      timerRefs.current.forEach(clearTimeout);
    };
  }, [clients]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}
