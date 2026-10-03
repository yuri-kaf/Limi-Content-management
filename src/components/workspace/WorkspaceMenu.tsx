import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Building2, Megaphone } from 'lucide-react';
import { btnIcon, card } from '../../ui';

interface Props {
  onEditClient: () => void;
  /** Absent until the client has its first business, so a new one cannot swallow old content. */
  onAddBusiness?: () => void;
  /** Absent for the same reason: a campaign needs a business to belong to. */
  onNewCampaign?: () => void;
}

const menuItem =
  'w-full flex items-center gap-2 h-8 px-2 rounded-tile text-[13px] text-left text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark hover:text-ink dark:hover:text-ink-dark transition-colors focus:outline-none focus-visible:bg-hover dark:focus-visible:bg-hover-dark';

export default function WorkspaceMenu({ onEditClient, onAddBusiness, onNewCampaign }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Same dismissal as the board filters: an outside press or Escape. A menu
  // that only its own trigger can close is a trap.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${btnIcon} w-8 h-8`}
        aria-label="Client actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className={`${card} absolute right-0 top-full mt-1 z-30 w-48 p-1 shadow-lift`}>
          {onNewCampaign && (
            <button role="menuitem" onClick={() => run(onNewCampaign)} className={menuItem}>
              <Megaphone size={14} />
              New campaign
            </button>
          )}
          {onAddBusiness && (
            <button role="menuitem" onClick={() => run(onAddBusiness)} className={menuItem}>
              <Building2 size={14} />
              Add business
            </button>
          )}
          <button role="menuitem" onClick={() => run(onEditClient)} className={menuItem}>
            <Pencil size={14} />
            Edit client
          </button>
        </div>
      )}
    </div>
  );
}
