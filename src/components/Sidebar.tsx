import {
  LayoutGrid, Users, Sun, Moon, PanelLeftClose, PanelLeftOpen, LogOut,
  Columns3, Building2, Home,
} from 'lucide-react';
import { NavModel } from '../nav';
import ClientAvatar from './ClientAvatar';
import Logo from './Logo';
import {
  sidebar, navItem, navGroupLabel, navBadge, btnIcon, heading, faintText,
} from '../ui';

interface Props {
  nav: NavModel;
  activeClientId?: string;
  activePath: string;
  userEmail: string;
  theme: 'light' | 'dark';
  collapsed: boolean;
  onNavigate: (path: string) => void;
  onToggleTheme: () => void;
  onToggleCollapsed: () => void;
  onSignOut: () => void;
}

export default function Sidebar({
  nav, activeClientId, activePath, userEmail, theme, collapsed,
  onNavigate, onToggleTheme, onToggleCollapsed, onSignOut,
}: Props) {
  return (
    <nav className={sidebar} aria-label="Main">
      {/* Brand + collapse */}
      <div className="flex items-center gap-2 h-11 px-3 flex-shrink-0">
        <Logo variant="mark" size={20} />
        {!collapsed && <span className={`${heading} text-[13px]`}>Limi</span>}
        <button
          onClick={onToggleCollapsed}
          className={`${btnIcon} ml-auto w-7 h-7 flex-shrink-0`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
        <button
          onClick={() => onNavigate('/')}
          className={navItem(activePath === '/')}
          aria-current={activePath === '/' ? 'page' : undefined}
        >
          <Home size={14} className="flex-shrink-0" />
          {!collapsed && <span className="truncate">Today</span>}
        </button>
        <button
          onClick={() => onNavigate('/clients')}
          className={navItem(activePath === '/clients')}
          aria-current={activePath === '/clients' ? 'page' : undefined}
        >
          <LayoutGrid size={14} className="flex-shrink-0" />
          {!collapsed && <span className="truncate">Clients</span>}
        </button>

        {!collapsed && (
          <div className={`${navGroupLabel} flex items-center gap-1.5`}>
            <Columns3 size={11} />
            Boards
            <span className="ml-auto normal-case tracking-normal tabular-nums">
              {nav.clients.length}
            </span>
          </div>
        )}

        {nav.clients.map((c) => {
          const active = c.id === activeClientId;
          const label = c.attention > 0 ? `${c.name}, ${c.attention} awaiting review` : c.name;
          return (
            <button
              key={c.id}
              onClick={() => onNavigate(`/client/${c.id}`)}
              className={navItem(active)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              title={label}
            >
              <ClientAvatar name={c.name} imageUrl={c.imageUrl} size={18} />
              {!collapsed && <span className="truncate">{c.name}</span>}
              {!collapsed && c.attention > 0 && <span className={navBadge}>{c.attention}</span>}
            </button>
          );
        })}

        {nav.clients.length === 0 && !collapsed && (
          <p className={`px-2 py-2 text-xs ${faintText}`}>No boards yet.</p>
        )}

        {nav.showTeam && (
          <>
            {!collapsed && (
              <div className={`${navGroupLabel} flex items-center gap-1.5`}>
                <Building2 size={11} />
                Workspace
              </div>
            )}
            <button
              onClick={() => onNavigate('/users')}
              className={navItem(activePath === '/users')}
              aria-current={activePath === '/users' ? 'page' : undefined}
            >
              <Users size={14} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">Team</span>}
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-hairline dark:border-hairline-dark p-2">
        {!collapsed && (
          <p className={`px-2 pb-1.5 text-[11px] truncate ${faintText}`}>{userEmail}</p>
        )}
        <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
          <button onClick={onToggleTheme} className={`${btnIcon} w-7 h-7`} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={onSignOut} className={`${btnIcon} w-7 h-7`} aria-label="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
