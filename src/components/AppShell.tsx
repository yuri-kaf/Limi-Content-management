import { ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useClients } from '../store';
import { buildNav } from '../nav';
import {
  appRoot, breadcrumbBar, breadcrumbText, drawerScrim, btnIcon,
  SIDEBAR_WIDTH, SIDEBAR_RAIL,
} from '../ui';

const COLLAPSE_KEY = 'limi_sidebar_collapsed';

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

  const nav = buildNav(clients, currentUser);
  const width = collapsed ? SIDEBAR_RAIL : SIDEBAR_WIDTH;

  // Persist as an effect, not inside the updater. A state updater must be pure
  // — StrictMode double-invokes it, and a write in there fires twice per click.
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed((c) => !c);
  }

  // Navigating from the drawer must also close it, or a phone user lands on the
  // new page with the drawer still covering it.
  function go(path: string) {
    navigate(path);
    setDrawerOpen(false);
  }

  const activeClientName = nav.clients.find((c) => c.id === activeClientId)?.name;
  const crumb = activeClientName ?? (location.pathname === '/users' ? 'Team' : 'Clients');

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
      <div
        className="hidden lg:block flex-shrink-0 h-full"
        style={{ width }}
      >
        <Sidebar {...sidebarProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </div>

      {/* Mobile: slide-over drawer, replacing the deleted bottom bar. */}
      {drawerOpen && (
        <>
          <div className={drawerScrim} onClick={() => setDrawerOpen(false)} />
          <div
            className="fixed inset-y-0 left-0 z-50 lg:hidden"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <Sidebar
              {...sidebarProps}
              collapsed={false}
              onToggleCollapsed={() => setDrawerOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header
          className={`${breadcrumbBar} flex-shrink-0`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className={`${btnIcon} w-7 h-7 lg:hidden`}
            aria-label="Open navigation"
          >
            <Menu size={16} />
          </button>
          <span className={breadcrumbText}>{crumb}</span>
        </header>

        {/* No scrolling here — each page owns its own scroll region, so a board
            can give its columns independent height. */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</main>
      </div>
    </div>
  );
}
