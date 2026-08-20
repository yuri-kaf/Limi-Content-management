import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Menu, ArrowLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useClients } from '../store';
import { buildNav } from '../nav';
import {
  appRoot, breadcrumbBar, breadcrumbText, drawerScrim, btnIcon,
  SIDEBAR_WIDTH, SIDEBAR_RAIL,
} from '../ui';

const COLLAPSE_KEY = 'limi_sidebar_collapsed';

// A left-to-right swipe has to travel this far, stay roughly horizontal, and
// start near the left edge — otherwise every horizontal drag on the board would
// navigate away instead of scrolling it.
const SWIPE_MIN_X = 70;
const SWIPE_MAX_Y = 50;
const SWIPE_EDGE = 40;

export default function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: activeClientId } = useParams<{ id: string }>();
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { clients } = useClients();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Persist as an effect, not inside the updater. A state updater must be pure
  // — StrictMode double-invokes it, and a write in there fires twice per click.
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const nav = buildNav(clients, currentUser);
  const width = collapsed ? SIDEBAR_RAIL : SIDEBAR_WIDTH;

  // Inside a client board the useful gesture is "get me out", not "show me the
  // tree", so the drawer trigger becomes a back arrow there.
  const insideBoard = !!activeClientId;

  function toggleCollapsed() {
    setCollapsed((c) => !c);
  }

  // Navigating from the drawer must also close it, or a phone user lands on the
  // new page with the drawer still covering it.
  function go(path: string) {
    navigate(path);
    setDrawerOpen(false);
  }

  // Swipe left-to-right inside a board to go home. Touch only: a trackpad
  // gesture would fight the board's own horizontal scroll.
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    if (!insideBoard) return;
    const t = e.touches[0];
    // Only from near the left edge, so a left-to-right drag in the middle of
    // the board still scrolls the board.
    touch.current = t.clientX <= SWIPE_EDGE ? { x: t.clientX, y: t.clientY } : null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (t.clientX - start.x >= SWIPE_MIN_X && Math.abs(t.clientY - start.y) <= SWIPE_MAX_Y) {
      navigate('/');
    }
  }

  const activeClientName = nav.clients.find((c) => c.id === activeClientId)?.name;
  const crumb =
    activeClientName ??
    (location.pathname === '/users'
      ? 'Team'
      : location.pathname === '/clients'
        ? 'Clients'
        : location.pathname === '/profile'
          ? 'Profile'
          : 'Today');

  const sidebarProps = {
    nav,
    activeClientId,
    activePath: location.pathname,
    userEmail: currentUser?.email ?? '',
    theme,
    onNavigate: go,
    onToggleTheme: toggleTheme,
    onSignOut: logout,
  };

  return (
    <div className={appRoot}>
      {/* Desktop: in flow, so the main region never sits under it. */}
      <div className="hidden lg:block flex-shrink-0 h-full" style={{ width }}>
        <Sidebar {...sidebarProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </div>

      {/* Mobile: slide-over drawer for switching between boards. */}
      {drawerOpen && (
        <>
          <div className={drawerScrim} onClick={() => setDrawerOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden" style={{ width: SIDEBAR_WIDTH }}>
            <Sidebar
              {...sidebarProps}
              collapsed={false}
              onToggleCollapsed={() => setDrawerOpen(false)}
            />
          </div>
        </>
      )}

      <div
        className="flex-1 min-w-0 min-h-0 flex flex-col"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <header
          className={`${breadcrumbBar} flex-shrink-0`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {insideBoard ? (
            <button
              onClick={() => navigate('/')}
              className={`${btnIcon} w-7 h-7 lg:hidden`}
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <button
              onClick={() => setDrawerOpen(true)}
              className={`${btnIcon} w-7 h-7 lg:hidden`}
              aria-label="Open navigation"
            >
              <Menu size={16} />
            </button>
          )}
          <span className={breadcrumbText}>{crumb}</span>
        </header>

        {/* No scrolling here — each page owns its own scroll region, so a board
            can give its columns independent height. */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</main>

        <BottomNav activePath={location.pathname} onNavigate={go} />
      </div>
    </div>
  );
}
