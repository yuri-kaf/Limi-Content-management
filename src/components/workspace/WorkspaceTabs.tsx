import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { TabDef, WorkspaceTab } from '../../workspace';
import { workspaceTab, workspaceTabList, workspaceTabRow } from '../../ui';

interface Props {
  tabs: TabDef[];
  active: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
  /** Right-aligned controls, outside the scrolling list so a menu can drop out of the bar. */
  actions?: ReactNode;
}

interface Bar {
  left: number;
  width: number;
}

// A client's places, in one row under the breadcrumb. Each one is its own URL,
// so this is navigation with the current place marked, not a tablist: a
// tablist promises arrow keys and tab panels, and someone who tries them would
// get nothing. The row replaces the old Board / Calendar / Ideas switch, which
// lived in the board's own toolbar and so could not hold anything that was not
// a view of the board.
//
// One underline slides between the places rather than each tab drawing its
// own, so moving to another tab reads as moving along the row. It is placed
// from the current tab's measured box; where nothing can be measured (jsdom,
// or before layout), the current tab keeps an underline of its own.
export default function WorkspaceTabs({ tabs, active, onSelect, actions }: Props) {
  const listRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<WorkspaceTab, HTMLButtonElement>());
  const [bar, setBar] = useState<Bar | null>(null);
  // The ids, not the array: a caller that rebuilds the array every render must
  // not re-run the measurement every render.
  const tabKey = tabs.map((t) => t.id).join(',');

  useLayoutEffect(() => {
    function measure() {
      const el = tabRefs.current.get(active);
      const next = el && el.offsetWidth > 0 ? { left: el.offsetLeft, width: el.offsetWidth } : null;
      // The same box keeps the same object, or every resize would re-render.
      setBar((prev) =>
        prev && next && prev.left === next.left && prev.width === next.width ? prev : next
      );
    }
    measure();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active, tabKey]);

  return (
    <div className={workspaceTabRow}>
      <nav ref={listRef} aria-label="Client workspace" className={`${workspaceTabList} relative`}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              if (el) tabRefs.current.set(t.id, el);
              else tabRefs.current.delete(t.id);
            }}
            onClick={() => onSelect(t.id)}
            aria-current={t.id === active ? 'page' : undefined}
            className={workspaceTab(t.id === active, !!bar)}
          >
            {t.label}
          </button>
        ))}
        {bar && (
          <span
            data-testid="tab-indicator"
            aria-hidden="true"
            className="absolute bottom-0 h-0.5 rounded-full bg-ink dark:bg-ink-dark pointer-events-none transition-[left,width] duration-200 ease-out-soft"
            style={{ left: bar.left, width: bar.width }}
          />
        )}
      </nav>
      {actions && <div className="flex items-center flex-shrink-0">{actions}</div>}
    </div>
  );
}
