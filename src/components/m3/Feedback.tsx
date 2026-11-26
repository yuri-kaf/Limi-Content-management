import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../../icons';
import { btnIcon, focusRing, input, label as labelCls, overlay } from '../../ui';

// Material 3 dialogs and a snackbar, in place of the browser's confirm(),
// prompt() and alert(). Those block the page, cannot be styled, read as an
// error on a phone and lose the app's words. These are promises, so a call site
// reads the same as before: `if (!(await confirm({...}))) return;`.

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** The confirm button turns red: deleting, revoking, declining. */
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  multiline?: boolean;
}

export interface SnackOptions {
  action?: { label: string; onClick: () => void };
  /** ms; 0 keeps it until dismissed. Default 4000, 6000 with an action. */
  duration?: number;
}

interface FeedbackApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  prompt: (o: PromptOptions) => Promise<string | null>;
  notify: (message: string, o?: SnackOptions) => void;
}

const Ctx = createContext<FeedbackApi | null>(null);

type Pending =
  | { kind: 'confirm'; o: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; o: PromptOptions; resolve: (v: string | null) => void };

interface Snack {
  id: number;
  message: string;
  o: SnackOptions;
}

const dialogPanel =
  'w-full max-w-[400px] p-6 bg-canvas dark:bg-raised-dark rounded-dialog shadow-lift animate-scale-in [will-change:transform,opacity]';
const textBtn = `inline-flex items-center justify-center h-10 px-3 rounded-full text-[13px] font-medium transition-colors ${focusRing}`;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [snack, setSnack] = useState<Snack | null>(null);
  const [text, setText] = useState('');
  const returnFocus = useRef<HTMLElement | null>(null);
  const seq = useRef(0);

  const confirm = useCallback((o: ConfirmOptions) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return new Promise<boolean>((resolve) => setPending({ kind: 'confirm', o, resolve }));
  }, []);

  const prompt = useCallback((o: PromptOptions) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setText(o.initial ?? '');
    return new Promise<string | null>((resolve) => setPending({ kind: 'prompt', o, resolve }));
  }, []);

  const notify = useCallback((message: string, o: SnackOptions = {}) => {
    seq.current += 1;
    setSnack({ id: seq.current, message, o });
  }, []);

  useEffect(() => {
    if (!snack) return;
    const ms = snack.o.duration ?? (snack.o.action ? 6000 : 4000);
    if (ms === 0) return;
    const t = window.setTimeout(() => setSnack((s) => (s?.id === snack.id ? null : s)), ms);
    return () => window.clearTimeout(t);
  }, [snack]);

  function finish(value: boolean | string | null) {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(value === true);
    else pending.resolve(typeof value === 'string' ? value : null);
    setPending(null);
    returnFocus.current?.focus?.();
  }

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish(pending!.kind === 'confirm' ? false : null);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // finish reads `pending`, which is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const o = pending?.o;
  const confirmLabel = o?.confirmLabel ?? (pending?.kind === 'prompt' ? 'Save' : 'OK');

  return (
    <Ctx.Provider value={{ confirm, prompt, notify }}>
      {children}
      {pending &&
        o &&
        createPortal(
          <div className={`${overlay} z-[80]`} onMouseDown={(e) => e.target === e.currentTarget && finish(pending.kind === 'confirm' ? false : null)}>
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="m3-dialog-title"
              className={dialogPanel}
            >
              <h2 id="m3-dialog-title" className="text-[20px] leading-7 text-ink dark:text-ink-dark">
                {o.title}
              </h2>
              {pending.kind === 'confirm' && pending.o.body && (
                <div className="mt-3 text-[13px] leading-5 text-ink-soft dark:text-ink-softdark">{pending.o.body}</div>
              )}
              {pending.kind === 'prompt' && (
                <form
                  id="m3-prompt"
                  className="mt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    finish(text);
                  }}
                >
                  <label className={labelCls} htmlFor="m3-prompt-input">{pending.o.label}</label>
                  {pending.o.multiline ? (
                    <textarea
                      id="m3-prompt-input"
                      autoFocus
                      rows={3}
                      value={text}
                      placeholder={pending.o.placeholder}
                      onChange={(e) => setText(e.target.value)}
                      className={`${input} resize-none`}
                    />
                  ) : (
                    <input
                      id="m3-prompt-input"
                      autoFocus
                      value={text}
                      placeholder={pending.o.placeholder}
                      onChange={(e) => setText(e.target.value)}
                      className={input}
                    />
                  )}
                </form>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className={`${textBtn} text-brand-text dark:text-brand-textdark hover:bg-brand-soft/70 dark:hover:bg-brand-softdark`}
                  onClick={() => finish(pending.kind === 'confirm' ? false : null)}
                  autoFocus={pending.kind === 'confirm'}
                >
                  {(pending.kind === 'confirm' && pending.o.cancelLabel) || 'Cancel'}
                </button>
                {pending.kind === 'prompt' ? (
                  <button
                    type="submit"
                    form="m3-prompt"
                    className={`${textBtn} px-5 bg-brand hover:bg-brand-hover text-white`}
                  >
                    {confirmLabel}
                  </button>
                ) : (
                  <button
                    className={`${textBtn} px-5 ${
                      pending.o.danger
                        ? 'bg-brand hover:bg-brand-hover text-white'
                        : 'bg-ink dark:bg-ink-dark hover:opacity-90 text-white dark:text-canvas-dark'
                    }`}
                    onClick={() => finish(true)}
                  >
                    {confirmLabel}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      {snack &&
        createPortal(
          <div
            key={snack.id}
            role="status"
            aria-live="polite"
            className="fixed z-[90] left-1/2 -translate-x-1/2 bottom-[calc(16px+env(safe-area-inset-bottom))] lg:bottom-6 w-[calc(100%-24px)] max-w-[560px] min-h-12 flex items-center gap-2 pl-4 pr-1.5 py-1.5 rounded-tile bg-inverse dark:bg-inverse-dark text-inverse-on dark:text-inverse-ondark shadow-lift animate-fade-up"
          >
            <span className="flex-1 text-[13px] leading-5 py-1.5">{snack.message}</span>
            {snack.o.action && (
              <button
                className={`${textBtn} text-inverse-primary dark:text-brand-text hover:bg-white/10 dark:hover:bg-black/5`}
                onClick={() => {
                  snack.o.action!.onClick();
                  setSnack(null);
                }}
              >
                {snack.o.action.label}
              </button>
            )}
            <button
              className={`${btnIcon} !text-current hover:!bg-white/10 dark:hover:!bg-black/5`}
              aria-label="Dismiss"
              onClick={() => setSnack(null)}
            >
              <X size={18} />
            </button>
          </div>,
          document.body
        )}
    </Ctx.Provider>
  );
}

/**
 * confirm / prompt / notify. Outside a FeedbackProvider (a unit test rendering
 * one component) it falls back to resolving the safe way: confirm says no,
 * prompt cancels, notify does nothing, so a forgotten provider cannot delete.
 */
export function useFeedback(): FeedbackApi {
  return (
    useContext(Ctx) ?? {
      confirm: async () => false,
      prompt: async () => null,
      notify: () => {},
    }
  );
}
