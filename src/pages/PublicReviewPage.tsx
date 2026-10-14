import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, ExternalLink, Download, Film, Image as ImageIcon } from 'lucide-react';
import { useShare } from '../store';
import { getMediaInfo, runWrite } from '../utils';
import Logo from '../components/Logo';
import { card, heading, bodyText, faintText, readout, textarea, btnGhost, btnGhostDanger, btnPrimary } from '../ui';

// The one page a reviewer outside the app acts on, so approving is a solid
// button. Emerald 700, not 600: white on 600 measures 3.8:1 and fails AA.
const approveBtn =
  'flex-1 inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-tile bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

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
    <div className="min-h-screen min-h-dvh bg-tint dark:bg-canvas-dark flex items-center justify-center p-4">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );

  if (state === 'loading') {
    return shell(
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  // Covers a wrong token, a deleted item and a revoked link alike — deliberately
  // indistinguishable, so a stale link reveals nothing about what it pointed to.
  if (state === 'missing' || !share || share.revoked) {
    return shell(
      <div className={`${card} p-8 text-center`}>
        <h1 className={`${heading} text-base mb-2`}>This link isn't available</h1>
        <p className={`text-sm leading-relaxed ${faintText}`}>
          It may have expired or been turned off. Ask whoever sent it for a new one.
        </p>
      </div>
    );
  }

  const media = getMediaInfo(share.mediaLink);
  const isGraphic = share.mediaType === 'graphic';
  const decided = share.decision === 'approved' || share.decision === 'declined';
  const approved = share.decision === 'approved';

  return shell(
    <>
      <div className="flex items-center gap-2.5 mb-5">
        <Logo variant="full" size={40} />
        <div>
          <span className={`${heading} text-[15px]`}>Limi</span>
          <p className={`text-[11px] ${faintText}`}>{share.clientName}</p>
        </div>
      </div>

      <div className={`${card} overflow-hidden shadow-lift`}>
        <div className="bg-tint dark:bg-tint-dark" style={{ aspectRatio: '16/9' }}>
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
                <ImageIcon size={24} className={faintText} />
              ) : (
                <Film size={24} className={faintText} />
              )}
              <span className={`text-[11px] px-6 text-center ${faintText}`}>
                {media.previewNote ?? 'No preview available — open the link below.'}
              </span>
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          <h1 className={`${heading} text-base leading-snug`}>{share.title}</h1>

          {share.caption && <p className={readout}>{share.caption}</p>}

          {share.hashtags && (
            <p className={`text-xs leading-relaxed break-words ${faintText}`}>{share.hashtags}</p>
          )}

          <div className="flex items-center gap-2">
            <a
              href={share.mediaLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnGhost} flex-1`}
            >
              <ExternalLink size={13} />
              Open
            </a>
            {isGraphic && media.downloadUrl && (
              <a
                href={media.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnGhost} flex-1`}
              >
                <Download size={13} />
                Download
              </a>
            )}
          </div>

          <div className="pt-4 border-t border-hairline dark:border-hairline-dark">
            {decided ? (
              <div
                className={`flex items-center gap-2 rounded-tile p-3.5 ${
                  approved
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                    : 'bg-brand-soft dark:bg-brand-softdark text-brand-text dark:text-brand-textdark'
                }`}
              >
                {approved ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <div>
                  <p className="text-sm font-semibold">{approved ? 'Approved' : 'Changes requested'}</p>
                  {share.decisionNote && (
                    <p className={`text-xs mt-0.5 ${bodyText}`}>{share.decisionNote}</p>
                  )}
                </div>
              </div>
            ) : declining ? (
              <div className="flex flex-col gap-2.5">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What needs changing?"
                  aria-label="What needs changing?"
                  rows={3}
                  className={textarea}
                />
                <div className="flex gap-2">
                  <button onClick={() => setDeclining(false)} className={`${btnGhost} flex-1`}>
                    Back
                  </button>
                  <button
                    onClick={() => decide('declined')}
                    disabled={submitting}
                    className={`${btnPrimary} flex-1`}
                  >
                    {submitting ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setDeclining(true)}
                  className={`${btnGhostDanger} flex-1`}
                >
                  <XCircle size={14} />
                  Request changes
                </button>
                <button onClick={() => decide('approved')} disabled={submitting} className={approveBtn}>
                  <CheckCircle size={14} />
                  {submitting ? 'Sending…' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className={`text-center text-xs mt-5 ${faintText}`}>Shared with you for review</p>
    </>
  );
}
