import { ReactNode } from 'react';
import { TabDef, WorkspaceTab } from '../../workspace';
import { workspaceTab, workspaceTabList, workspaceTabRow } from '../../ui';

interface Props {
  tabs: TabDef[];
  active: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
  /** Right-aligned controls, outside the scrolling list so a menu can drop out of the bar. */
  actions?: ReactNode;
}

// A client's places, in one row under the breadcrumb. Each one is its own URL,
// so this is navigation with the current place marked, not a tablist: a
// tablist promises arrow keys and tab panels, and someone who tries them would
// get nothing. The row replaces the old Board / Calendar / Ideas switch, which
// lived in the board's own toolbar and so could not hold anything that was not
// a view of the board.
export default function WorkspaceTabs({ tabs, active, onSelect, actions }: Props) {
  return (
    <div className={workspaceTabRow}>
      <nav aria-label="Client workspace" className={workspaceTabList}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-current={t.id === active ? 'page' : undefined}
            className={workspaceTab(t.id === active)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {actions && <div className="flex items-center flex-shrink-0">{actions}</div>}
    </div>
  );
}
