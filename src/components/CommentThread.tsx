import { useState } from 'react';
import { Send, Clock } from 'lucide-react';
import { useComments, CommentParent } from '../store';
import { runWrite } from '../utils';
import {
  sectionLabel, divider, inset, textarea, faintText, bodyText, heading, btnPrimary,
} from '../ui';

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
    <div className={divider}>
      <span className={sectionLabel}>Activity</span>

      <div className="flex flex-col gap-3 mt-3 max-h-64 overflow-y-auto pr-1">
        {loading ? (
          <p className={`text-xs ${faintText}`}>Loading…</p>
        ) : comments.length === 0 ? (
          <p className={`text-xs italic ${faintText}`}>
            No comments yet. Feedback and status changes both show up here.
          </p>
        ) : (
          comments.map((c) =>
            c.kind === 'system' ? (
              <p key={c.id} className={`text-[11px] ${faintText}`}>
                <span className={`font-medium ${bodyText}`}>{c.authorName}</span>{' '}
                {c.body}
                <span> · {relativeTime(c.createdAt)}</span>
              </p>
            ) : (
              <div key={c.id} className={`${inset} p-3`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs ${heading}`}>{c.authorName}</span>
                  {c.atSeconds !== undefined && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-brand bg-brand-soft dark:bg-brand-softdark px-1.5 py-0.5 rounded">
                      <Clock size={9} />
                      {formatTimestamp(c.atSeconds)}
                    </span>
                  )}
                  <span className={`text-[10px] ml-auto ${faintText}`}>
                    {relativeTime(c.createdAt)}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${bodyText}`}>
                  {c.body}
                </p>
              </div>
            )
          )
        )}
      </div>

      <div className="flex items-start gap-2 mt-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave feedback…"
            rows={2}
            className={textarea}
          />
          {showTimestamp && (
            <div className="flex items-center gap-2">
              <input
                value={stamp}
                onChange={(e) => setStamp(e.target.value)}
                placeholder="0:14"
                className={`${textarea} w-20 px-2 py-1 text-xs ${
                  stampInvalid ? 'border-brand text-brand' : ''
                }`}
              />
              <span className={`text-[10px] ${faintText}`}>
                {stampInvalid ? 'Use m:ss, e.g. 0:14' : 'Optional — point at a moment'}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending || stampInvalid}
          className={`${btnPrimary} w-11 !px-0 flex-shrink-0`}
          aria-label="Post comment"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
