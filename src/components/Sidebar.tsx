import { LayoutGrid, Users, Home, Target, X } from '../icons';
import { NavModel } from '../nav';
import FolderIcon from './FolderIcon';
import Logo from './Logo';
import { sidebar, navItem, navGroupLabel, navBadge, btnIcon, faintText, focusRingInset } from '../ui';

interface Props {
  nav: NavModel;
  activeClientId?: string;
  activePath: string;
  /** Lead follow-ups due today or late. */
  leadsDue?: number;
  /** The 72px Material rail instead of the 240px drawer. */
  collapsed: boolean;
  onNavigate: (path: string) => void;
  /** Phone drawer only: the drawer's own close button. */
  onClose?: () => void;
}

interface Dest {
  path: string;
  label: string;
  icon: typeof Home;
  badge?: number;
  badgeLabel?: string;
}

// A Material 3 navigation rail (72px: an icon in a 56x32 pill with its name
// under it) that expands into a navigation drawer (240px) from the top bar's
// menu button. Theme, account and sign-out live in the top bar, so the rail is
// only places: the four destinations, then the clients.
export default function Sidebar({
  nav, activeClientId, activePath, leadsDue = 0, collapsed, onNavigate, onClose,
}: Props) {
  const dests: Dest[] = [
    { path: '/', label: 'Today', icon: Home },
    { path: '/clients', label: 'Clients', icon: LayoutGrid },
    ...(nav.showLeads
      ? [{ path: '/leads', label: 'Leads', icon: Target, badge: leadsDue, badgeLabel: `${leadsDue} follow-ups due` }]
      : []),
    ...(nav.showTeam ? [{ path: '/users', label: 'Team', icon: Users }] : []),
  ];

  if (collapsed) {
    return (
      <nav className={`${sidebar} items-center pt-1`} aria-label="Main">
        {dests.map((d) => {
          const on = activePath === d.path;
          const name = d.badge ? `${d.label}, ${d.badgeLabel}` : d.label;
          return (
            <button
              key={d.path}
              onClick={() => onNavigate(d.path)}
              aria-current={on ? 'page' : undefined}
              aria-label={name}
              className={`group flex flex-col items-center gap-1 w-16 pt-1 pb-2 rounded-card text-[11px] leading-4 ${focusRingInset} ${
                on ? 'text-ink dark:text-ink-dark font-semibold' : 'text-ink-soft dark:text-ink-softdark font-medium'
              }`}
            >
              <span
                className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-colors ${
                  on
                    ? 'bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark'
                    : 'group-hover:bg-ink/[.08] dark:group-hover:bg-ink-dark/[.08]'
                }`}
              >
                <d.icon size={22} filled={on} />
                {!!d.badge && (
                  <span className="absolute -top-0.5 right-2.5 min-w-4 h-4 px-1 rounded-full bg-brand text-white text-[11px] font-semibold leading-4 text-center tabular-nums">
                    {d.badge}
                  </span>
                )}
              </span>
              {d.label}
            </button>
          );
        })}

        {nav.clients.length > 0 && (
          <div className="w-10 my-2 border-t border-hairline dark:border-hairline-dark" />
        )}
        <div className="flex-1 min-h-0 w-full overflow-y-auto [scrollbar-width:none] flex flex-col items-center gap-1 pb-3">
          {nav.clients.map((c) => {
            const on = c.id === activeClientId;
            const label = c.attention > 0 ? `${c.name}, ${c.attention} awaiting review` : c.name;
            return (
              <button
                key={c.id}
                onClick={() => onNavigate(`/client/${c.id}`)}
                aria-current={on ? 'page' : undefined}
                aria-label={label}
                title={label}
                className={`relative flex items-center justify-center w-12 h-10 rounded-full transition-colors ${focusRingInset} ${
                  on ? 'bg-brand-soft dark:bg-brand-softdark' : 'hover:bg-ink/[.08] dark:hover:bg-ink-dark/[.08]'
                }`}
              >
                <FolderIcon color={c.color} size={24} label={c.name} forceInitial />
                {c.attention > 0 && (
                  // Neutral, not red: posts waiting on the client are the client's move.
                  // Red stays for what the team itself owes (Leads due).
                  <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-ink-soft dark:bg-ink-softdark" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className={`${sidebar} px-3`} aria-label="Main">
      {onClose && (
        <div className="flex items-center gap-2 h-[52px] px-1 flex-shrink-0">
          <Logo variant="mark" size={24} />
          <span className="text-[16px] font-medium text-ink dark:text-ink-dark">Limi</span>
          <button onClick={onClose} className={`${btnIcon} ml-auto`} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto pb-3 pt-1">
        {dests.map((d) => {
          const on = activePath === d.path;
          return (
            <button
              key={d.path}
              onClick={() => onNavigate(d.path)}
              className={navItem(on)}
              aria-current={on ? 'page' : undefined}
            >
              <d.icon size={20} filled={on} />
              <span className="truncate">{d.label}</span>
              {!!d.badge && (
                <span className={`${navBadge} !text-brand-text dark:!text-brand-textdark font-semibold`} aria-label={d.badgeLabel}>
                  {d.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className={navGroupLabel}>
          Clients
          <span className="ml-auto tabular-nums">{nav.clients.length}</span>
        </div>

        {nav.clients.map((c) => {
          const on = c.id === activeClientId;
          const label = c.attention > 0 ? `${c.name}, ${c.attention} awaiting review` : c.name;
          return (
            <button
              key={c.id}
              onClick={() => onNavigate(`/client/${c.id}`)}
              className={navItem(on)}
              aria-current={on ? 'page' : undefined}
              aria-label={label}
              title={label}
            >
              <FolderIcon color={c.color} size={20} label={c.name} />
              <span className="truncate">{c.name}</span>
              {c.attention > 0 && <span className={navBadge}>{c.attention}</span>}
            </button>
          );
        })}

        {nav.clients.length === 0 && (
          <p className={`px-3 py-2 text-[12px] ${faintText}`}>No clients yet.</p>
        )}
      </div>
    </nav>
  );
}
