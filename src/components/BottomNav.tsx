import { Home, LayoutGrid, Target, User } from '../icons';
import { faintText, focusRingInset } from '../ui';

const TABS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/clients', label: 'Clients', icon: LayoutGrid },
  { path: '/leads', label: 'Leads', icon: Target },
  { path: '/profile', label: 'Profile', icon: User },
];

interface Props {
  activePath: string;
  /** Team only; a client has no leads page. */
  showLeads?: boolean;
  onNavigate: (path: string) => void;
}

// Phones get a bottom bar for the three top-level destinations. The sidebar
// drawer still exists for switching between client boards, which is a different
// kind of navigation — a list that grows, rather than a fixed set of places.
export default function BottomNav({ activePath, showLeads = false, onNavigate }: Props) {
  return (
    <nav
      className="lg:hidden flex-shrink-0 flex items-stretch bg-tint dark:bg-tint-dark"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Sections"
    >
      {TABS.filter((t) => showLeads || t.path !== '/leads').map((t) => {
        const active = activePath === t.path;
        return (
          <button
            key={t.path}
            onClick={() => onNavigate(t.path)}
            aria-current={active ? 'page' : undefined}
            className={`group flex-1 flex flex-col items-center justify-center gap-1 h-16 transition-colors ${focusRingInset} ${
              active ? 'text-ink dark:text-ink-dark font-semibold' : `${faintText} font-medium`
            }`}
          >
            <span
              className={`flex items-center justify-center w-16 h-8 rounded-full transition-colors ${
                active ? 'bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark' : ''
              }`}
            >
              <t.icon size={24} filled={active} />
            </span>
            <span className="text-[12px] leading-4">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
