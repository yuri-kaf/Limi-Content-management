import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, ExternalLink, Download, Film, Image as ImageIcon } from '../icons';
import { useShare } from '../store';
import { getMediaInfo, runWrite } from '../utils';
import Logo from '../components/Logo';
import {
  heading, bodyText, faintText, textarea, btnGhost, btnPrimary, btnSuccessSolid, emptyTitle, emptyBody,
} from '../ui';

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

  // A tinted page, one white sheet on it. The sheet is the only surface: no
  // outlines, the fill alone sets it apart.
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen min-h-dvh bg-tint dark:bg-tint-dark flex justify-center sm:items-center sm:p-6">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );

  if (state === 'loading') {
    return shell(
      <div className="flex items-center justify-center py-32" role="status" aria-label="Loading">
        <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  // Covers a wrong token, a deleted item and a revoked link alike, deliberately
  // indistinguishable, so a stale link reveals nothing about what it pointed to.
  if (state === 'missing' || !share || share.revoked) {
    return shell(
      <div className="bg-canvas dark:bg-raised-dark sm:rounded-dialog min-h-dvh sm:min-h-0 flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <Logo variant="full" size={40} />
        <h1 className={`${emptyTitle} !text-[18px] !font-normal mt-2`}>This link isn't available</h1>
        <p className={emptyBody}>
          It may have expired or been turned off. Ask whoever sent it for a new one.
        </p>
      </div>
    );
  }

  const media = getMediaInfo(share.mediaLink);
  const isGraphic = share.mediaType === 'graphic';
  const decided = share.decision === 'approved' || share.decision === 'declined';
  const approved = share.decision === 'approved';
  const showImage = !!media.previewUrl && !imgError;

  return shell(
    <>
      <div className="bg-canvas dark:bg-raised-dark sm:rounded-dialog sm:shadow-lift overflow-hidden min-h-dvh sm:min-h-0 flex flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
          <Logo variant="full" size={32} />
          <div className="min-w-0">
            <span className={`${heading} text-[14px] leading-4 block`}>Limi</span>
            <span className={`text-[12px] leading-4 block truncate ${faintText}`}>
              For {share.clientName}
            </span>
          </div>
        </div>

        {showImage ? (
          <div className="bg-raised dark:bg-canvas-dark flex-shrink-0 overflow-hidden max-h-[40dvh] sm:max-h-none" style={{ aspectRatio: '16/9' }}>
            <img
              src={media.previewUrl!}
              alt={share.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          // Nothing to show in place (OneDrive above all): a tidy file row
          // with the way out, never an empty box.
          <div className="mx-5 flex-shrink-0 flex items-center gap-3 p-3 pr-4 rounded-card bg-raised dark:bg-canvas-dark">
            <span className="w-12 h-12 rounded-tile bg-hover dark:bg-hover-dark flex items-center justify-center flex-shrink-0 text-ink-soft dark:text-ink-softdark">
              {isGraphic ? <ImageIcon size={24} /> : <Film size={24} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium text-ink dark:text-ink-dark truncate">
                {media.label}
              </span>
              <span className={`block text-[12px] ${faintText}`}>
                {isGraphic ? 'Graphic' : 'Video'} · opens in a new tab
              </span>
            </span>
            <a
              href={share.mediaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-hover dark:bg-hover-dark text-[13px] font-medium text-ink dark:text-ink-dark hover:bg-pressed dark:hover:bg-pressed-dark transition-colors flex-shrink-0"
            >
              <ExternalLink size={16} />
              Open
            </a>
          </div>
        )}

        <div className="px-5 pt-4 pb-5 flex flex-col gap-4 flex-1">
          <h1 className={`${heading} text-[22px] leading-7 font-normal`}>{share.title}</h1>

          {share.caption && (
            <p className={`text-[14px] leading-6 whitespace-pre-wrap ${bodyText}`}>{share.caption}</p>
          )}

          {share.hashtags && (
            <p className={`text-[13px] leading-5 break-words ${faintText}`}>{share.hashtags}</p>
          )}

          {(showImage || (isGraphic && media.downloadUrl)) && (
            <div className="flex items-center gap-2 flex-wrap">
              {showImage && (
                <a href={share.mediaLink} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                  <ExternalLink size={16} />
                  Open original
                </a>
              )}
              {isGraphic && media.downloadUrl && (
                <a href={media.downloadUrl} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                  <Download size={16} />
                  Download
                </a>
              )}
            </div>
          )}

          <div className="mt-auto sticky bottom-0 -mx-5 px-5 pt-3 pb-4 -mb-5 bg-canvas dark:bg-raised-dark sm:static sm:mx-0 sm:px-0 sm:pb-0 sm:mb-0 sm:pt-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {decided ? (
              <div
                role="status"
                className={`flex items-start gap-3 rounded-card p-4 ${
                  approved
                    ? 'bg-success-soft dark:bg-success-softdark text-success-text dark:text-success-textdark'
                    : 'bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark'
                }`}
              >
                {approved ? <CheckCircle size={24} /> : <XCircle size={24} />}
                <div>
                  <p className="text-[16px] font-medium leading-6">{approved ? 'Approved' : 'Changes requested'}</p>
                  <p className="text-[13px] mt-0.5 opacity-90">
                    {approved ? 'Thank you. The team has been told.' : 'Thank you. The team will update the post.'}
                  </p>
                  {share.decisionNote && (
                    <p className="text-[13px] mt-2 leading-5 whitespace-pre-wrap">{share.decisionNote}</p>
                  )}
                </div>
              </div>
            ) : declining ? (
              <div className="flex flex-col gap-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What needs changing?"
                  aria-label="What needs changing?"
                  rows={4}
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
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button onClick={() => setDeclining(true)} className={`${btnGhost} flex-1`}>
                  <XCircle size={18} />
                  Ask for changes
                </button>
                <button onClick={() => decide('approved')} disabled={submitting} className={`${btnSuccessSolid} flex-1`}>
                  <CheckCircle size={18} />
                  {submitting ? 'Sending…' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className={`text-center text-[12px] py-4 ${faintText}`}>Shared with you for review</p>
    </>
  );
}
