import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Menu, ArrowLeft, Search, Moon, Sun, LogOut, User, ChevronDown } from '../icons';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import FolderIcon from './FolderIcon';
import CommandPalette from './CommandPalette';
import Logo from './Logo';
import MenuButton from './m3/Menu';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useClients, useLeads } from '../store';
import { dayOf, leadsDue } from '../leads';
import { buildNav } from '../nav';
import {
  appRoot, breadcrumbBar, breadcrumbText, drawerScrim, btnIcon, btnIconBar, focusRing,
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

  // The rail is the default: on a 1440px laptop the 168px the drawer would
  // take is a whole extra column of posts. A stored choice wins.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) !== '0'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Persist as an effect, not inside the updater. A state updater must be pure
  // — StrictMode double-invokes it, and a write in there fires twice per click.
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Search has to be reachable without a keyboard too, which is why the header
  // carries a visible button as well — on a phone there is no ⌘K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nav = buildNav(clients, currentUser);
  // The Leads badge: follow-ups due today or late. The leads page itself
  // subscribes again; Firestore shares the one listener's cache between them.
  const { leads } = useLeads(nav.showLeads);
  const due = leadsDue(leads, dayOf(Date.now()));
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

  const activeClient = nav.clients.find((c) => c.id === activeClientId);
  const crumb =
    activeClient?.name ??
    (location.pathname === '/users'
      ? 'Team'
      : location.pathname === '/leads'
        ? 'Leads'
      : location.pathname === '/clients'
        ? 'Clients'
        : location.pathname === '/profile'
          ? 'Profile'
          : 'Today');

  const sidebarProps = {
    nav,
    activeClientId,
    activePath: location.pathname,
    leadsDue: due,
    onNavigate: go,
  };

  const email = currentUser?.email ?? '';
  const initial = (currentUser?.name || email || '?').trim().charAt(0).toUpperCase();
  const attention = activeClient?.attention ?? 0;

  return (
    <div className={`${appRoot} flex-col`}>
      {/* Top app bar, full width, on the chrome tint: menu, where you are,
          search, theme and account. */}
      <header
        className={`${breadcrumbBar} flex-shrink-0`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {insideBoard ? (
          <button
            onClick={() => navigate('/')}
            className={`${btnIconBar} lg:hidden`}
            aria-label="Back to Today"
          >
            <ArrowLeft size={22} />
          </button>
        ) : (
          <button
            onClick={() => setDrawerOpen(true)}
            className={`${btnIconBar} lg:hidden`}
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>
        )}
        <button
          onClick={toggleCollapsed}
          className={`${btnIconBar} hidden lg:inline-flex ml-2`}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
        >
          <Menu size={22} />
        </button>

        {activeClient ? (
          <MenuButton
            label="Switch client"
            minWidth={240}
            items={nav.clients.map((c) => ({
              key: c.id,
              label: c.name,
              icon: <FolderIcon color={c.color} size={18} label={c.name} />,
              trailing: c.attention > 0 ? String(c.attention) : undefined,
              checked: c.id === activeClient.id,
              onSelect: () => go(`/client/${c.id}`),
            }))}
            trigger={(p) => (
              <button
                {...p}
                ref={p.ref}
                className={`flex items-center gap-2 min-w-0 h-9 pl-1.5 pr-2 ml-1 rounded-full bg-raised dark:bg-raised-dark hover:bg-hover dark:hover:bg-hover-dark transition-colors ${focusRing}`}
                aria-label={`${activeClient.name}, switch client`}
              >
                <FolderIcon color={activeClient.color} size={22} label={activeClient.name} forceInitial />
                <span className="text-[14px] font-medium text-ink dark:text-ink-dark truncate">{crumb}</span>
                {attention > 0 && (
                  <span className="hidden sm:inline text-[12px] text-ink-faint dark:text-ink-faintdark whitespace-nowrap">
                    · {attention} waiting on review
                  </span>
                )}
                <ChevronDown size={18} className="text-ink-soft dark:text-ink-softdark" />
              </button>
            )}
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0 ml-1">
            <Logo variant="mark" size={24} className="hidden lg:block" />
            <span className={breadcrumbText}>{crumb}</span>
          </div>
        )}

        {/* Search: a field on a laptop, an icon on a phone. Either opens the
            command palette, which searches clients, posts and pages. */}
        <button
          onClick={() => setPaletteOpen(true)}
          className={`hidden md:flex items-center gap-3 flex-1 max-w-[560px] h-10 mx-auto px-4 rounded-full bg-hover/70 dark:bg-hover-dark hover:bg-hover dark:hover:bg-pressed-dark text-ink-soft dark:text-ink-softdark text-[13px] transition-colors ${focusRing}`}
          aria-label="Search"
        >
          <Search size={20} />
          <span className="flex-1 text-left truncate">Search clients, posts and pages</span>
          <kbd className="text-[11px] font-sans text-ink-faint dark:text-ink-faintdark">Ctrl K</kbd>
        </button>

        <div className="flex items-center gap-1 ml-auto md:ml-0 flex-shrink-0 pr-1">
          <button
            onClick={() => setPaletteOpen(true)}
            className={`${btnIcon} md:hidden`}
            aria-label="Search"
            title="Search (Ctrl K)"
          >
            <Search size={22} />
          </button>
          <button
            onClick={toggleTheme}
            className={`${btnIcon} hidden sm:inline-flex`}
            aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <MenuButton
            label="Account"
            align="end"
            minWidth={220}
            items={[
              { key: 'who', label: email, icon: <User size={20} />, disabled: true, onSelect: () => {} },
              'divider',
              { key: 'profile', label: 'Profile', icon: <User size={20} />, onSelect: () => go('/profile') },
              {
                key: 'theme',
                label: theme === 'dark' ? 'Light theme' : 'Dark theme',
                icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />,
                onSelect: toggleTheme,
              },
              { key: 'out', label: 'Sign out', icon: <LogOut size={20} />, onSelect: logout },
            ]}
            trigger={(p) => (
              <button
                {...p}
                ref={p.ref}
                className={`ml-1 w-8 h-8 rounded-full bg-ink/80 dark:bg-ink-dark/80 text-white dark:text-canvas-dark text-[13px] font-semibold inline-flex items-center justify-center ${focusRing}`}
                aria-label="Account"
              >
                {initial}
              </button>
            )}
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Desktop: the rail or the drawer, in flow, on the chrome tint. */}
        <div className="hidden lg:block flex-shrink-0 h-full transition-[width] duration-200 ease-out-soft" style={{ width }}>
          <Sidebar {...sidebarProps} collapsed={collapsed} />
        </div>

        {/* Phone: the drawer slides over, for switching between clients. */}
        {drawerOpen && (
          <>
            <div className={drawerScrim} onClick={() => setDrawerOpen(false)} />
            <div
              className="fixed inset-y-0 left-0 z-50 lg:hidden rounded-r-[16px] overflow-hidden shadow-lift animate-fade-in"
              style={{ width: 280 }}
            >
              <Sidebar {...sidebarProps} collapsed={false} onClose={() => setDrawerOpen(false)} />
            </div>
          </>
        )}

        <div
          className="flex-1 min-w-0 min-h-0 flex flex-col bg-canvas dark:bg-canvas-dark lg:rounded-tl-[16px] overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* No scrolling here: each page owns its own scroll region, so a
              board can give its columns independent height. */}
          <main className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</main>

          {/* Hidden inside a board, which is a drilled-into screen with a back
              arrow and a back swipe, and needs the 64px for posts. */}
          {!insideBoard && (
            <BottomNav activePath={location.pathname} showLeads={nav.showLeads} onNavigate={go} />
          )}
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        clients={clients}
        user={currentUser}
        onClose={() => setPaletteOpen(false)}
        onNavigate={go}
        onToggleTheme={toggleTheme}
        onSignOut={logout}
      />
    </div>
  );
}
