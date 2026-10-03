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

// A client's places, in one row under the breadcrumb. They replace the old
// Board / Calendar / Ideas switch, which lived in the board's own toolbar and so
// could not hold anything that was not a view of the board.
export default function WorkspaceTabs({ tabs, active, onSelect, actions }: Props) {
  return (
    <div className={workspaceTabRow}>
      <div role="tablist" aria-label="Client workspace" className={workspaceTabList}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === active}
            onClick={() => onSelect(t.id)}
            className={workspaceTab(t.id === active)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {actions && <div className="flex items-center flex-shrink-0">{actions}</div>}
    </div>
  );
}
