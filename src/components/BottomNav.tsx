import { Home, LayoutGrid, User } from 'lucide-react';
import { faintText } from '../ui';

const TABS = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/clients', label: 'Clients', icon: LayoutGrid },
  { path: '/profile', label: 'Profile', icon: User },
];

interface Props {
  activePath: string;
  onNavigate: (path: string) => void;
}

// Phones get a bottom bar for the three top-level destinations. The sidebar
// drawer still exists for switching between client boards, which is a different
// kind of navigation — a list that grows, rather than a fixed set of places.
export default function BottomNav({ activePath, onNavigate }: Props) {
  return (
    <nav
      className="lg:hidden flex-shrink-0 flex items-stretch border-t border-hairline dark:border-hairline-dark bg-canvas dark:bg-canvas-dark"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Sections"
    >
      {TABS.map((t) => {
        const active = activePath === t.path;
        return (
          <button
            key={t.path}
            onClick={() => onNavigate(t.path)}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-14 transition-colors ${
              active ? 'text-brand' : faintText
            }`}
          >
            <t.icon size={19} strokeWidth={active ? 2.4 : 1.8} />
            <span className="text-[10px] font-semibold tracking-wide">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
