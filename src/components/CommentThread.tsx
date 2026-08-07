import { useState } from 'react';
import { Send, Clock } from 'lucide-react';
import { useComments } from '../store';
import { runWrite } from '../utils';

interface Props {
  clientId: string;
  contentId: string;
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

export default function CommentThread({ clientId, contentId, showTimestamp, onSend }: Props) {
  const { comments, loading } = useComments(clientId, contentId);
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
    <div className="pt-1 border-t border-neutral-100 dark:border-[#1a1a1a]">
      <span className="text-xs font-semibold text-neutral-400 dark:text-[#555] uppercase tracking-wider">
        Activity
      </span>

      <div className="flex flex-col gap-3 mt-3 max-h-64 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-neutral-300 dark:text-[#333]">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-neutral-300 dark:text-[#333] italic">
            No comments yet. Feedback and status changes both show up here.
          </p>
        ) : (
          comments.map((c) =>
            c.kind === 'system' ? (
              <p key={c.id} className="text-[11px] text-neutral-400 dark:text-[#4a4a4a]">
                <span className="font-medium text-neutral-500 dark:text-[#666]">
                  {c.authorName}
                </span>{' '}
                {c.body}
                <span className="text-neutral-300 dark:text-[#333]"> · {relativeTime(c.createdAt)}</span>
              </p>
            ) : (
              <div
                key={c.id}
                className="bg-neutral-50 dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#1a1a1a] rounded-xl p-3"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-[#bbb]">
                    {c.authorName}
                  </span>
                  {c.atSeconds !== undefined && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-[#dc2626] bg-[#dc2626]/10 px-1.5 py-0.5 rounded">
                      <Clock size={9} />
                      {formatTimestamp(c.atSeconds)}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-300 dark:text-[#333] ml-auto">
                    {relativeTime(c.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-[#999] leading-relaxed whitespace-pre-wrap">
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
            className="w-full bg-neutral-100 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#222] rounded-lg px-3 py-2 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-[#333] focus:outline-none focus:border-[#dc2626] transition-colors resize-none"
          />
          {showTimestamp && (
            <div className="flex items-center gap-2">
              <input
                value={stamp}
                onChange={(e) => setStamp(e.target.value)}
                placeholder="0:14"
                className={`w-20 bg-neutral-100 dark:bg-[#0c0c0c] border rounded-lg px-2 py-1 text-xs focus:outline-none transition-colors ${
                  stampInvalid
                    ? 'border-[#dc2626] text-[#dc2626]'
                    : 'border-neutral-200 dark:border-[#222] text-neutral-600 dark:text-[#999] focus:border-[#dc2626]'
                }`}
              />
              <span className="text-[10px] text-neutral-400 dark:text-[#444]">
                {stampInvalid ? 'Use m:ss, e.g. 0:14' : 'Optional — point at a moment'}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending || stampInvalid}
          className="bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg p-2.5 transition-colors"
          aria-label="Post comment"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
