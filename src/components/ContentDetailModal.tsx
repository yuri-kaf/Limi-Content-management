import { useState } from 'react';
import {
  X, Copy, Check, ExternalLink, Calendar, Pencil, Trash2, Film,
  CheckCircle, XCircle, Clock, Download, History, Link2,
} from 'lucide-react';
import CommentThread from './CommentThread';
import { ClientReview, ContentItem, ContentStatus } from '../types';
import {
  getMediaInfo, mediaTypeOf, captionOf, teamNotesOf, PLATFORM_LABELS, isLocalOrigin, STAGES,
} from '../utils';
import {
  sheetOverlay, sheetPanel, heading, faintText, bodyText, badge, sectionLabel,
  readout, textarea, divider, btnGhost, btnPrimary, btnSuccess, btnDanger,
} from '../ui';

type CopyTarget = 'caption' | 'hashtags' | 'both';

// Small quiet action next to a section heading (Copy, + tags, Create link).
const inlineAction =
  'inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint dark:text-ink-faintdark hover:text-brand transition-colors';

interface Props {
  clientId: string;
  onComment: (body: string, atSeconds?: number) => Promise<void>;
  /** Absent for client-role users, who can't create public links. */
  onShare?: () => Promise<string>;
  /**
   * Absent for anyone who may not move content. Every stage is reachable from
   * every other, and this works at any screen width — the board only renders
   * one column below the sm breakpoint, so dragging cannot move an item there.
   */
  onChangeStatus?: (status: ContentStatus) => void;
  item: ContentItem;
  isClientRole: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReview?: (review: ClientReview, note?: string) => void;
}

export default function ContentDetailModal({
  clientId,
  onComment,
  onShare,
  onChangeStatus,
  item,
  isClientRole,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDelete,
  onReview,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [declineNote, setDeclineNote] = useState(item.reviewNote ?? '');
  const [decliningMode, setDecliningMode] = useState(false);

  const media = getMediaInfo(item.driveLink);
  const thumbnailUrl = media.previewUrl;
  const isGraphic = mediaTypeOf(item) === 'graphic';
  const caption = captionOf(item);
  const hashtags = item.hashtags ?? '';
  const teamNotes = teamNotesOf(item);
  const platforms = item.platforms ?? [];
  const versions = item.versions ?? [];

  function handleCopy(which: CopyTarget, text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
    }
  }

  function handleApprove() {
    onReview?.('approved');
    onClose();
  }

  function handleDeclineSubmit() {
    onReview?.('declined', declineNote.trim() || undefined);
    onClose();
  }

  const hasSchedule = item.scheduledAt && item.scheduledAt > 0;
  const scheduledLabel = hasSchedule
    ? new Date(item.scheduledAt!).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const reviewStatusEl = (() => {
    if (item.clientReview === 'approved') {
      return (
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle size={13} />
          <span className="text-xs font-semibold">Client Approved</span>
        </div>
      );
    }
    if (item.clientReview === 'declined') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-brand dark:text-red-400">
            <XCircle size={13} />
            <span className="text-xs font-semibold">Client Declined</span>
          </div>
          {item.reviewNote && <p className={readout}>"{item.reviewNote}"</p>}
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-1.5 ${faintText}`}>
        <Clock size={13} />
        <span className="text-xs font-semibold">Pending Client Review</span>
      </div>
    );
  })();

  return (
    <div
      className={sheetOverlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={sheetPanel} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-hairline dark:bg-hairline-dark" />
        </div>

        {/* Media — an embedded viewer when the provider offers one, otherwise
            the still thumbnail, otherwise a placeholder. */}
        <div className="relative bg-raised dark:bg-raised-dark" style={{ aspectRatio: '16/9' }}>
          {media.embedUrl ? (
            <iframe
              src={media.embedUrl}
              title={item.title}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : thumbnailUrl && !imgError ? (
            <img
              src={thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film size={36} className={faintText} />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/55 text-white/80 hover:text-white hover:bg-black/70 backdrop-blur-sm transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* A cross-origin frame reports a successful load even when what it
            rendered is a sign-in wall, so failure can't be detected here — the
            way out is signposted instead. */}
        {media.embedUrl && (
          <p className={`px-5 pt-3 text-[11px] ${faintText}`}>
            Not loading? The file needs to be shared as “Anyone with the link” —
            otherwise use Open in {media.label} below.
          </p>
        )}

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          <h2 className={`${heading} text-base leading-snug`}>{item.title}</h2>

          {/* Stage picker. Any stage reaches any other, and unlike the board's
              drag-and-drop it works below the sm breakpoint, where only one
              column is rendered and there is nothing to drag to. */}
          {onChangeStatus && (
            <div>
              <span className={sectionLabel}>Stage</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {STAGES.map((stage) => {
                  const isCurrent = stage.id === item.status;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => { if (!isCurrent) onChangeStatus(stage.id); }}
                      aria-current={isCurrent}
                      disabled={isCurrent}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isCurrent
                          ? 'cursor-default'
                          : 'bg-raised dark:bg-raised-dark text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-white'
                      }`}
                      style={
                        isCurrent
                          ? {
                              backgroundColor: `${stage.color}22`,
                              color: stage.color,
                              border: `1px solid ${stage.color}55`,
                            }
                          : { border: '1px solid transparent' }
                      }
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.label}
                      {isCurrent && <Check size={11} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {platforms.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {platforms.map((p) => (
                <span
                  key={p}
                  className={`${badge} bg-raised dark:bg-raised-dark text-ink-soft dark:text-ink-softdark`}
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          )}

          {/* Caption */}
          {caption ? (
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className={sectionLabel}>Caption</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleCopy('caption', caption)} className={inlineAction}>
                    {copied === 'caption'
                      ? <Check size={11} className="text-emerald-500" />
                      : <Copy size={11} />}
                    <span>{copied === 'caption' ? 'Copied!' : 'Copy'}</span>
                  </button>
                  {hashtags && (
                    <button
                      onClick={() => handleCopy('both', `${caption}\n\n${hashtags}`)}
                      className={inlineAction}
                    >
                      {copied === 'both'
                        ? <Check size={11} className="text-emerald-500" />
                        : <Copy size={11} />}
                      <span>{copied === 'both' ? 'Copied!' : '+ tags'}</span>
                    </button>
                  )}
                </div>
              </div>
              <p className={readout}>{caption}</p>
            </div>
          ) : (
            <p className={`text-xs italic ${faintText}`}>No caption added.</p>
          )}

          {hashtags && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className={sectionLabel}>Hashtags</span>
                <button onClick={() => handleCopy('hashtags', hashtags)} className={inlineAction}>
                  {copied === 'hashtags'
                    ? <Check size={11} className="text-emerald-500" />
                    : <Copy size={11} />}
                  <span>{copied === 'hashtags' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className={`${readout} break-words`}>{hashtags}</p>
            </div>
          )}

          {/* Internal notes — never shown to the client */}
          {!isClientRole && teamNotes && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500/80">
                Team Notes
              </span>
              <p className="mt-2 rounded-tile border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft dark:text-ink-softdark">
                {teamNotes}
              </p>
            </div>
          )}

          {/* Posting schedule */}
          {scheduledLabel && (
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-brand flex-shrink-0" />
              <span className={`text-xs ${faintText}`}>
                Scheduled:{' '}
                <span className={`font-medium ${bodyText}`}>{scheduledLabel}</span>
              </span>
            </div>
          )}

          {/* Review status (non-client sees read-only) */}
          {!isClientRole && <div className={divider}>{reviewStatusEl}</div>}

          {/* Client review UI */}
          {isClientRole && onReview && (
            <div className={divider}>
              {item.clientReview === 'approved' ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                  <CheckCircle size={15} />
                  You approved this content
                </div>
              ) : item.clientReview === 'declined' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-brand dark:text-red-400 text-sm font-semibold">
                    <XCircle size={15} />
                    You declined this content
                  </div>
                  {item.reviewNote && (
                    <p className={readout}>Your note: "{item.reviewNote}"</p>
                  )}
                  <button
                    onClick={() => { setDecliningMode(false); onReview('pending'); }}
                    className={`self-start text-xs transition-colors ${faintText} hover:text-ink dark:hover:text-ink-dark`}
                  >
                    Reset review
                  </button>
                </div>
              ) : decliningMode ? (
                <div className="flex flex-col gap-2">
                  <label className={sectionLabel}>Reason / Suggestions</label>
                  <textarea
                    value={declineNote}
                    onChange={(e) => setDeclineNote(e.target.value)}
                    rows={3}
                    placeholder="Tell us what needs to change..."
                    className={textarea}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setDecliningMode(false)} className={`${btnGhost} flex-1`}>
                      Cancel
                    </button>
                    <button onClick={handleDeclineSubmit} className={`${btnDanger} flex-1`}>
                      Confirm Decline
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleApprove} className={`${btnSuccess} flex-1`}>
                    <CheckCircle size={13} />
                    Approve
                  </button>
                  <button
                    onClick={() => setDecliningMode(true)}
                    className={`${btnGhost} flex-1 hover:text-brand hover:border-brand/30`}
                  >
                    <XCircle size={13} />
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}

          {versions.length > 0 && (
            <div>
              <span className={sectionLabel}>Earlier versions</span>
              <div className="flex flex-col gap-1.5 mt-2">
                {versions.map((v, i) => (
                  <a
                    key={`${v.replacedAt}-${i}`}
                    href={v.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 text-xs transition-colors ${bodyText} hover:text-brand`}
                  >
                    <History size={11} />
                    v{i + 1}
                    <span className={faintText}>
                      · replaced {new Date(v.replacedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </a>
                ))}
                <span className={`text-xs font-medium ${bodyText}`}>
                  v{versions.length + 1} — current
                </span>
              </div>
            </div>
          )}

          {onShare && (
            <div>
              <button
                onClick={async () => {
                  const url = await onShare();
                  if (!url) return;
                  setShareUrl(url);
                  navigator.clipboard.writeText(url).catch(() => {});
                }}
                className={inlineAction}
              >
                <Link2 size={12} />
                {shareUrl ? 'Link copied — create another' : 'Create review link'}
              </button>
              {shareUrl && (
                <>
                  <p className={`${readout} mt-2 text-[11px] font-mono break-all`}>{shareUrl}</p>
                  {/* A link built from a dev-server origin resolves only on this
                      machine, so sending it looks like a broken feature. */}
                  {isLocalOrigin(shareUrl) ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-brand dark:text-red-400">
                      This link points at a local address, so it will not open for
                      anyone else. Deploy the app and set VITE_PUBLIC_APP_URL to the
                      deployed origin before sending review links.
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-500/70">
                      Anyone with this link can view and review this item without
                      signing in. Send it only to people who should see it.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <CommentThread
            clientId={clientId}
            contentId={item.id}
            showTimestamp={!isGraphic}
            onSend={onComment}
          />

          {/* Drive link — always visible for ALL roles */}
          <div className={`${divider} flex items-center gap-2`}>
            <a
              href={item.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnGhost} flex-1`}
            >
              <ExternalLink size={13} />
              Open in {media.label}
            </a>

            {isGraphic && media.downloadUrl && (
              <a
                href={media.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnPrimary} flex-1`}
              >
                <Download size={13} />
                Download
              </a>
            )}

            {/* Edit / Delete — only when user has permission */}
            {!isClientRole && canEdit && (
              <button onClick={onEdit} className={btnGhost}>
                <Pencil size={13} />
                Edit
              </button>
            )}
            {!isClientRole && canDelete && (
              <button
                onClick={handleDeleteClick}
                onBlur={() => setConfirmDelete(false)}
                className={
                  confirmDelete
                    ? btnDanger
                    : `${btnGhost} hover:text-brand hover:border-brand/30`
                }
              >
                <Trash2 size={13} />
                {confirmDelete ? 'Confirm?' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
