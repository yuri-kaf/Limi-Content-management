import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, ExternalLink, Download, Film, Image as ImageIcon } from 'lucide-react';
import { useShare } from '../store';
import { getMediaInfo, runWrite } from '../utils';

export default function PublicReviewPage() {
  const { token } = useParams<{ token: string }>();
  const { share, state, submitDecision } = useShare(token);
  const [note, setNote] = useState('');
  const [declining, setDeclining] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function decide(decision: 'approved' | 'declined') {
    setSubmitting(true);
    await runWrite(() => submitDecision(decision, note.trim()), 'send your decision');
    setSubmitting(false);
    setDeclining(false);
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen min-h-dvh bg-neutral-50 dark:bg-[#080808] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );

  if (state === 'loading') {
    return shell(
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-neutral-200 dark:border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
      </div>
    );
  }

  // Covers a wrong token, a deleted item and a revoked link alike — deliberately
  // indistinguishable, so a stale link reveals nothing about what it pointed to.
  if (state === 'missing' || !share || share.revoked) {
    return shell(
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-2xl p-8 text-center">
        <h1 className="text-base font-bold text-neutral-900 dark:text-white mb-2">
          This link isn't available
        </h1>
        <p className="text-sm text-neutral-400 dark:text-[#555] leading-relaxed">
          It may have expired or been turned off. Ask whoever sent it for a new one.
        </p>
      </div>
    );
  }

  const media = getMediaInfo(share.mediaLink);
  const isGraphic = share.mediaType === 'graphic';
  const decided = !!share.decision;

  return shell(
    <>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 bg-[#dc2626] rounded-lg flex items-center justify-center shadow-md shadow-red-900/40">
          <span className="text-white font-bold text-sm leading-none">L</span>
        </div>
        <div>
          <span className="text-neutral-900 dark:text-white font-bold text-[15px]">Limi</span>
          <p className="text-[11px] text-neutral-400 dark:text-[#555]">{share.clientName}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-neutral-100 dark:bg-[#0c0c0c]" style={{ aspectRatio: '16/9' }}>
          {media.previewUrl && !imgError ? (
            <img
              src={media.previewUrl}
              alt={share.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              {isGraphic ? (
                <ImageIcon size={24} className="text-neutral-300 dark:text-[#333]" />
              ) : (
                <Film size={24} className="text-neutral-300 dark:text-[#333]" />
              )}
              <span className="text-[11px] text-neutral-400 dark:text-[#444] px-6 text-center">
                {media.previewNote ?? 'No preview available — open the link below.'}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          <h1 className="text-base font-bold text-neutral-900 dark:text-white leading-snug">
            {share.title}
          </h1>

          {share.caption && (
            <p className="text-sm text-neutral-500 dark:text-[#888] leading-relaxed bg-neutral-50 dark:bg-[#0d0d0d] rounded-xl p-3 border border-neutral-200 dark:border-[#1a1a1a] whitespace-pre-wrap">
              {share.caption}
            </p>
          )}

          {share.hashtags && (
            <p className="text-xs text-neutral-400 dark:text-[#666] leading-relaxed break-words">
              {share.hashtags}
            </p>
          )}

          <div className="flex items-center gap-2">
            <a
              href={share.mediaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] hover:text-neutral-700 dark:hover:text-[#999] transition-colors text-sm font-medium"
            >
              <ExternalLink size={13} />
              Open
            </a>
            {isGraphic && media.downloadUrl && (
              <a
                href={media.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] hover:text-neutral-700 dark:hover:text-[#999] transition-colors text-sm font-medium"
              >
                <Download size={13} />
                Download
              </a>
            )}
          </div>

          <div className="pt-1 border-t border-neutral-100 dark:border-[#1a1a1a]">
            {decided ? (
              <div
                className="flex items-center gap-2 rounded-xl p-3.5"
                style={{
                  backgroundColor: share.decision === 'approved' ? '#05966915' : '#dc262615',
                  color: share.decision === 'approved' ? '#059669' : '#dc2626',
                }}
              >
                {share.decision === 'approved' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <div>
                  <p className="text-sm font-semibold capitalize">{share.decision}</p>
                  {share.decisionNote && (
                    <p className="text-xs opacity-80 mt-0.5">{share.decisionNote}</p>
                  )}
                </div>
              </div>
            ) : declining ? (
              <div className="flex flex-col gap-2.5">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What needs changing?"
                  rows={3}
                  className="w-full bg-neutral-100 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#222] rounded-lg px-3 py-2.5 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-[#333] focus:outline-none focus:border-[#dc2626] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeclining(false)}
                    className="flex-1 border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] rounded-xl py-2.5 text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => decide('declined')}
                    disabled={submitting}
                    className="flex-1 bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  >
                    {submitting ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setDeclining(true)}
                  className="flex-1 flex items-center justify-center gap-2 border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] hover:text-[#dc2626] hover:border-[#dc2626]/40 rounded-xl py-3 text-sm font-medium transition-colors"
                >
                  <XCircle size={14} />
                  Request changes
                </button>
                <button
                  onClick={() => decide('approved')}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
                >
                  <CheckCircle size={14} />
                  {submitting ? 'Sending…' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-neutral-300 dark:text-[#333] text-xs mt-5">
        Shared with you for review
      </p>
    </>
  );
}
