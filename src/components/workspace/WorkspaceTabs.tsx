import { ReactNode } from 'react';
import { TabDef, WorkspaceTab } from '../../workspace';
import { CalendarDays, ChevronDown, Columns3, Info, Lightbulb, Megaphone } from '../../icons';
import Menu from '../m3/Menu';
import { focusRing } from '../../ui';

interface Props {
  tabs: TabDef[];
  active: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
  /** Controls after the views: the client's ⋮ menu. */
  actions?: ReactNode;
}

const ICONS: Record<WorkspaceTab, typeof Columns3> = {
  content: Columns3,
  calendar: CalendarDays,
  campaigns: Megaphone,
  ideas: Lightbulb,
  overview: Info,
};

// The client's views, at the right end of the page's top row. Posts is where
// the day is spent, so its stage tabs own the row and these stay compact: an
// icon and a word, the current one in the red container. Below xl only the
// icons show, each still named for a screen reader and on hover.
export default function WorkspaceTabs({ tabs, active, onSelect, actions }: Props) {
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const CurrentIcon = ICONS[current.id];
  return (
    <nav aria-label="Client views" className="flex items-center gap-0.5 flex-shrink-0">
      {/* A phone has room for the stage tabs or the views, not both: there the
          views fold into one menu showing where you are. */}
      <span className="md:hidden">
        <Menu
          label="Client views"
          align="end"
          items={tabs.map((t) => {
            const Icon = ICONS[t.id];
            return { key: t.id, label: t.label, icon: <Icon size={20} />, checked: t.id === active, onSelect: () => onSelect(t.id) };
          })}
          trigger={(p) => (
            <button
              {...p}
              ref={p.ref}
              aria-label={`View: ${current.label}`}
              className={`inline-flex items-center gap-0.5 h-10 pl-2.5 pr-1.5 rounded-full text-ink-soft dark:text-ink-softdark hover:bg-ink/[.06] ${focusRing}`}
            >
              <CurrentIcon size={20} />
              <ChevronDown size={18} />
            </button>
          )}
        />
      </span>
      {tabs.map((t) => {
        const on = t.id === active;
        const Icon = ICONS[t.id];
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-current={on ? 'page' : undefined}
            aria-label={t.label}
            title={t.label}
            className={`hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 xl:px-3 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${focusRing} ${
              on
                ? 'bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark'
                : 'text-ink-soft dark:text-ink-softdark hover:bg-ink/[.06] dark:hover:bg-ink-dark/[.08] hover:text-ink dark:hover:text-ink-dark'
            }`}
          >
            <Icon size={18} filled={on} />
            <span className="hidden xl:inline">{t.label}</span>
          </button>
        );
      })}
      {actions && <span className="ml-1 flex items-center">{actions}</span>}
    </nav>
  );
}
