import { useState } from 'react';
import { Send, Clock } from '../icons';
import { useComments, CommentParent } from '../store';
import { runWrite } from '../utils';
import {
  sectionLabel, textarea, faintText, bodyText, heading, btnPrimarySm,
} from '../ui';

// The m:ss box: a fixed 64px chip, not the full-width field recipe.
const stampField =
  'w-16 h-8 rounded-tile bg-canvas dark:bg-raised-dark px-2 text-[12px] text-center tabular-nums text-ink dark:text-ink-dark placeholder-ink-faint dark:placeholder-ink-faintdark border border-transparent focus:outline-none focus-visible:border-focus dark:focus-visible:border-focus-dark aria-[invalid=true]:border-brand-text dark:aria-[invalid=true]:border-brand-textdark';

interface Props {
  clientId: string;
  contentId: string;
  parent?: CommentParent;
  /** Video items get the optional timestamp field. */
  showTimestamp: boolean;
  onSend: (body: string, atSeconds?: number) => Promise<void>;
}

// "1:23" or "83" → seconds. Returns undefined when it isn't a time.
function parseTimestamp(raw: string): number | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const parts = value.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return undefined;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CommentThread({
  clientId, contentId, parent = 'content', showTimestamp, onSend,
}: Props) {
  const { comments, loading } = useComments(clientId, contentId, parent);
  const [body, setBody] = useState('');
  const [stamp, setStamp] = useState('');
  const [sending, setSending] = useState(false);

  const stampSeconds = parseTimestamp(stamp);
  const stampInvalid = stamp.trim() !== '' && stampSeconds === undefined;

  async function handleSend() {
    if (!body.trim() || stampInvalid) return;
    setSending(true);
    await runWrite(() => onSend(body.trim(), stampSeconds), 'post the comment');
    setSending(false);
    setBody('');
    setStamp('');
  }

  return (
    <div className="flex flex-col gap-3">
      <span className={sectionLabel}>
        Comments{comments.length > 0 && <span className={`ml-1.5 ${faintText}`}>{comments.filter((c) => c.kind !== 'system').length}</span>}
      </span>

      <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto overscroll-contain">
        {loading ? (
          <p className={`text-[13px] ${faintText}`}>Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className={`text-[13px] leading-5 ${faintText}`}>
            No comments yet. Feedback and stage changes show up here.
          </p>
        ) : (
          comments.map((c) =>
            c.kind === 'system' ? (
              <p key={c.id} className={`text-[12px] ${faintText}`}>
                <span className={`font-medium ${bodyText}`}>{c.authorName}</span>{' '}
                {c.body}
                <span> · {relativeTime(c.createdAt)}</span>
              </p>
            ) : (
              <div key={c.id} className="flex gap-2.5">
                <span
                  aria-hidden
                  className="w-7 h-7 rounded-full bg-hover dark:bg-hover-dark text-ink-soft dark:text-ink-softdark text-[12px] font-medium flex items-center justify-center flex-shrink-0"
                >
                  {(c.authorName || '?').trim().charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[13px] ${heading}`}>{c.authorName}</span>
                    <span className={`text-[12px] ${faintText}`}>{relativeTime(c.createdAt)}</span>
                    {c.atSeconds !== undefined && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-on dark:text-brand-ondark bg-brand-soft dark:bg-brand-softdark px-1.5 h-5 rounded-chip">
                        <Clock size={12} />
                        {formatTimestamp(c.atSeconds)}
                      </span>
                    )}
                  </div>
                  <p className={`text-[13px] leading-5 whitespace-pre-wrap break-words ${bodyText}`}>
                    {c.body}
                  </p>
                </div>
              </div>
            )
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          rows={2}
          className={`${textarea} !bg-canvas dark:!bg-raised-dark`}
        />
        <div className="flex items-center gap-2">
          {showTimestamp ? (
            <>
              <input
                value={stamp}
                onChange={(e) => setStamp(e.target.value)}
                placeholder="0:14"
                aria-label="Timestamp"
                aria-invalid={stampInvalid}
                aria-describedby={`stamp-hint-${contentId}`}
                className={`${stampField} flex-shrink-0`}
              />
              <span
                id={`stamp-hint-${contentId}`}
                className={`flex-1 min-w-0 truncate text-[12px] leading-4 ${
                  stampInvalid ? 'text-brand-text dark:text-brand-textdark' : faintText
                }`}
              >
                {stampInvalid ? 'Use m:ss, e.g. 0:14' : 'Optional: point at a moment'}
              </span>
            </>
          ) : (
            <span className="flex-1" />
          )}
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending || stampInvalid}
            className={`${btnPrimarySm} flex-shrink-0`}
          >
            <Send size={14} />
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}
