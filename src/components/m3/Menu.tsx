import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from '../../icons';
import { focusRingInset } from '../../ui';

export interface MenuItem {
  key: string;
  label: ReactNode;
  /** A leading icon, or a dot, drawn at 20px. */
  icon?: ReactNode;
  /** Trailing text: a shortcut or a count. */
  trailing?: ReactNode;
  /** A check mark: the current choice in a single-choice menu. */
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | 'divider';

interface Props {
  /** The button that opens the menu. Receives the props it must spread. */
  trigger: (props: {
    ref: (el: HTMLElement | null) => void;
    onClick: (e: React.MouseEvent) => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
  }) => ReactNode;
  items: MenuEntry[];
  /** Read by screen readers as the menu's name. */
  label: string;
  align?: 'start' | 'end';
  /** Minimum width in px. Defaults to the trigger's width or 180. */
  minWidth?: number;
}

const itemClass = (danger?: boolean, checked?: boolean) =>
  `w-full flex items-center gap-3 h-9 [@media(hover:none)]:h-12 px-3 text-left text-[13px] transition-colors disabled:opacity-40 disabled:pointer-events-none ${focusRingInset} ${
    danger
      ? 'text-brand-text dark:text-brand-textdark hover:bg-brand-soft dark:hover:bg-brand-softdark focus-visible:bg-brand-soft dark:focus-visible:bg-brand-softdark'
      : `text-ink dark:text-ink-dark hover:bg-ink/[.06] dark:hover:bg-ink-dark/[.08] focus-visible:bg-ink/[.06] dark:focus-visible:bg-ink-dark/[.08] ${checked ? 'bg-ink/[.06] dark:bg-ink-dark/[.08]' : ''}`
  }`;

// The one menu of the app: a Material 3 menu in a portal, so no dialog or
// scroll region can clip it. It opens under its trigger (above it when there is
// no room), takes focus, moves with the arrow keys, closes on Escape, on a
// click outside and on a choice, and gives focus back to the trigger.
export default function Menu({ trigger, items, label, align = 'start', minWidth }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) anchor.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    function place() {
      const r = anchor.current!.getBoundingClientRect();
      const width = Math.max(minWidth ?? 180, align === 'start' ? 0 : 0);
      const h = list.current?.offsetHeight ?? 0;
      const below = r.bottom + 4 + h <= window.innerHeight - 8;
      const top = below ? r.bottom + 4 : Math.max(8, r.top - 4 - h);
      const w = list.current?.offsetWidth ?? width;
      let left = align === 'end' ? r.right - w : r.left;
      left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
      setPos({ top, left, width });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, minWidth]);

  useEffect(() => {
    if (!open) return;
    const first = list.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
    first?.focus();
    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (list.current?.contains(t) || anchor.current?.contains(t)) return;
      close(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, close]);

  function onKeyDown(e: React.KeyboardEvent) {
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(at + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(at - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      buttons[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      buttons[buttons.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  }

  return (
    <>
      {trigger({
        ref: (el) => {
          anchor.current = el;
        },
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {open &&
        createPortal(
          <div
            ref={list}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[70] py-1.5 rounded-card bg-canvas dark:bg-hover-dark shadow-float animate-scale-in origin-top max-h-[min(420px,80dvh)] overflow-y-auto"
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              minWidth: pos?.width ?? minWidth ?? 180,
            }}
          >
            {items.map((it, i) =>
              it === 'divider' ? (
                <div key={`d${i}`} role="separator" className="my-1.5 border-t border-hairline dark:border-hairline-dark" />
              ) : (
                <button
                  key={it.key}
                  role={it.checked !== undefined ? 'menuitemradio' : 'menuitem'}
                  aria-checked={it.checked !== undefined ? it.checked : undefined}
                  disabled={it.disabled}
                  className={itemClass(it.danger, it.checked)}
                  onClick={() => {
                    close();
                    it.onSelect();
                  }}
                >
                  {it.icon !== undefined && (
                    <span className="w-5 flex items-center justify-center flex-shrink-0 text-ink-soft dark:text-ink-softdark">
                      {it.icon}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 truncate">{it.label}</span>
                  {it.trailing && <span className="text-[12px] text-ink-faint dark:text-ink-faintdark">{it.trailing}</span>}
                  {it.checked && <Check size={18} className="text-ink-soft dark:text-ink-softdark" />}
                </button>
              )
            )}
          </div>,
          document.body
        )}
    </>
  );
}
