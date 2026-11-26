import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Hash, Home, SunMoon, LogOut, LayoutGrid, Target, User, Users } from '../icons';
import { AppUser, Client } from '../types';
import {
  KIND_LABELS, PaletteItem, buildIndex, groupResults, searchIndex,
} from '../palette';
import FolderIcon from './FolderIcon';
import { sectionLabel, faintText } from '../ui';

interface Props {
  open: boolean;
  clients: Client[];
  user: AppUser | null;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
}

function Leading({ item }: { item: PaletteItem }) {
  if (item.kind === 'client') {
    return <FolderIcon color={item.color} size={22} />;
  }
  const icon =
    item.kind === 'page'
      ? (item.path === '/clients' ? <LayoutGrid size={18} />
        : item.path === '/leads' ? <Target size={18} />
          : item.path === '/profile' ? <User size={18} />
            : item.path === '/users' ? <Users size={18} />
              : <Home size={18} />)
      : item.command === 'toggle-theme' ? <SunMoon size={18} />
        : item.command === 'sign-out' ? <LogOut size={18} />
          : <Hash size={18} />;
  return (
    <span className={`w-[22px] h-[22px] inline-flex items-center justify-center flex-shrink-0 ${faintText}`}>
      {icon}
    </span>
  );
}

// Search, which the app has never had, plus the handful of commands that were
// otherwise buried in the sidebar footer. Everything it searches is already
// subscribed for the boards, so opening it costs no reads.
export default function CommandPalette({
  open, clients, user, onClose, onNavigate, onToggleTheme, onSignOut,
}: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => buildIndex(clients, user), [clients, user]);
  const results = useMemo(() => searchIndex(index, query), [index, query]);
  const groups = useMemo(() => groupResults(results), [results]);
  // The flat order the keyboard walks has to be the order the groups render in,
  // or the highlight lands on a different row than the one Enter opens.
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // A fresh query starts at the top result, and reopening starts clean rather
  // than showing whatever was typed last week.
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // Focus after paint: the input does not exist when this effect is queued
      // on the render that opens the palette.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  // Keep the highlighted row in view when walking a long list with the keyboard.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  function run(item: PaletteItem) {
    onClose();
    if (item.path) return onNavigate(item.path);
    if (item.command === 'toggle-theme') return onToggleTheme();
    if (item.command === 'sign-out') return onSignOut();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      return onClose();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      return setCursor((c) => (flat.length === 0 ? 0 : (c + 1) % flat.length));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      return setCursor((c) => (flat.length === 0 ? 0 : (c - 1 + flat.length) % flat.length));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[cursor];
      if (item) run(item);
    }
  }

  let row = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh] sm:pt-[14vh] bg-ink/30 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[600px] bg-canvas dark:bg-raised-dark rounded-dialog shadow-lift overflow-hidden flex flex-col max-h-[70dvh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
      >
        <div className="flex items-center gap-3 mx-3 mt-3 mb-1 px-4 h-12 flex-shrink-0 rounded-full bg-raised dark:bg-canvas-dark/40 focus-within:bg-hover dark:focus-within:bg-hover-dark transition-colors">
          <Search size={18} className={faintText} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, content, commands…"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-ink dark:text-ink-dark placeholder-ink-faint dark:placeholder-ink-faintdark focus:outline-none"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={`hidden sm:block text-[11px] font-medium px-1.5 py-0.5 rounded-chip bg-hover dark:bg-hover-dark ${faintText}`}>
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-2 pt-1">
          {flat.length === 0 ? (
            <p className={`px-3 py-10 text-center text-[13px] ${faintText}`}>
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.kind} className="mb-1 last:mb-0">
                <div className={`${sectionLabel} px-3 pt-3 pb-1`}>{KIND_LABELS[group.kind]}</div>
                {group.items.map((item) => {
                  row += 1;
                  const active = row === cursor;
                  const at = row;
                  return (
                    <button
                      key={item.id}
                      data-active={active}
                      onMouseMove={() => setCursor(at)}
                      onClick={() => run(item)}
                      className={`w-full flex items-center gap-3 h-11 [@media(hover:none)]:h-12 px-3 rounded-full text-left transition-colors ${
                        active ? 'bg-hover dark:bg-hover-dark' : 'hover:bg-raised dark:hover:bg-hover-dark/50'
                      }`}
                    >
                      <Leading item={item} />
                      <span className="flex-1 min-w-0 text-[13px] text-ink dark:text-ink-dark truncate">
                        {item.label}
                      </span>
                      {item.detail && (
                        <span className={`text-[11px] truncate max-w-[40%] flex-shrink-0 ${faintText}`}>
                          {item.detail}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className={`hidden sm:flex items-center gap-4 px-5 h-9 flex-shrink-0 text-[11px] ${faintText}`}
        >
          <span className="inline-flex items-center gap-1">
            <ArrowUp size={12} />
            <ArrowDown size={12} />
            to move
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft size={12} />
            to open
          </span>
          <span className="ml-auto tabular-nums">{flat.length} result{flat.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
