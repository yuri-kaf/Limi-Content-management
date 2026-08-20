import { useState } from 'react';
import {
  X, Copy, Check, ExternalLink, Calendar, Pencil, Trash2, Play, Image as ImageIcon,
  CheckCircle, XCircle, Clock, Download, History, Link2,
} from 'lucide-react';
import CommentThread from './CommentThread';
import { ClientReview, ContentItem, ContentStatus } from '../types';
import {
  getMediaInfo, mediaTypeOf, captionOf, teamNotesOf, PLATFORM_LABELS, isLocalOrigin, STAGES,
} from '../utils';
import {
  sheetOverlay, sheetPanelWide, sheetBody, sheetPane, heading, faintText, bodyText, badge,
  sectionLabel, readout, readoutScroll, textarea, btnGhost, btnPrimary, btnSuccess,
  btnDanger, btnIcon,
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
  const stage = STAGES.find((s) => s.id === item.status);
  // A cross-origin frame reports a successful load even when what it rendered
  // is a permission wall, so failure can't be detected here. Signpost the way
  // out instead — but only for the providers where sharing is the likely cause;
  // it is noise on a public YouTube or Vimeo URL.
  const needsLinkSharing =
    media.provider === 'drive' || media.provider === 'onedrive' || media.provider === 'dropbox';

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
          {item.reviewNote && <p className={readoutScroll}>"{item.reviewNote}"</p>}
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
      <div
        className={sheetPanelWide}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Grabber (phones only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-hairline dark:bg-hairline-dark" />
        </div>

        {/* Pinned header. The old layout scrolled the whole panel, so the title
            and the close button slid away as soon as you read anything. */}
        <header className="flex items-start gap-3 px-5 py-3.5 border-b border-hairline dark:border-hairline-dark">
          <div className="flex-1 min-w-0">
            <h2 className={`${heading} text-base leading-snug line-clamp-2`}>{item.title}</h2>
            {stage && (
              <span
                className={`${badge} mt-1.5`}
                style={{ backgroundColor: `${stage.color}1f`, color: stage.color }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                {stage.label}
              </span>
            )}
          </div>
          <button onClick={onClose} className={`${btnIcon} flex-shrink-0`} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className={sheetBody}>
          {/* ── Left pane: the content itself ───────────────────────────── */}
          <div className={sheetPane}>
            {/* Media — an embedded viewer when the provider offers one,
                otherwise the still thumbnail, otherwise a placeholder. */}
            {/* flex-shrink-0 is load-bearing: this is a flex item in a pane of
                constrained height, and without it flex shrinking wins over
                aspect-ratio and squashes the player out of 16:9. */}
            <div
              className="relative flex-shrink-0 rounded-tile overflow-hidden bg-raised dark:bg-raised-dark"
              style={{ aspectRatio: '16/9' }}
            >
              {media.embedUrl && media.embedKind === 'video' && !isGraphic ? (
                // The one provider that serves the bytes, so it gets real
                // controls instead of someone else's player.
                <video
                  src={media.embedUrl}
                  poster={thumbnailUrl ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full bg-black"
                />
              ) : media.embedUrl && media.embedKind === 'iframe' ? (
                <iframe
                  src={media.embedUrl}
                  title={item.title}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
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
                // Nothing can be shown in place, so the box becomes the way
                // out rather than a dead film icon.
                <a
                  href={item.driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-full flex flex-col items-center justify-center gap-2 group/open hover:bg-hairline/40 dark:hover:bg-hairline-dark/40 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-surface dark:bg-surface-dark shadow-card flex items-center justify-center">
                    {isGraphic ? (
                      <ImageIcon size={20} className={faintText} />
                    ) : (
                      <Play size={20} className="text-brand ml-0.5" />
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${bodyText} group-hover/open:text-brand transition-colors`}>
                    Open in {media.label}
                  </span>
                </a>
              )}
            </div>

            {media.embedUrl && needsLinkSharing ? (
              <p className={`-mt-2 text-[11px] leading-relaxed ${faintText}`}>
                Not playing? The file has to be shared as “Anyone with the link”
                — otherwise use Open in {media.label} below.
              </p>
            ) : media.previewNote ? (
              <p className={`-mt-2 text-[11px] leading-relaxed ${faintText}`}>
                {media.previewNote}
              </p>
            ) : null}

            {/* Stage picker. Any stage reaches any other, and unlike the board's
                drag-and-drop it works below the sm breakpoint, where only one
                column is rendered and there is nothing to drag to. */}
            {onChangeStatus && (
              <div>
                <span className={sectionLabel}>Stage</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {STAGES.map((s) => {
                    const isCurrent = s.id === item.status;
                    return (
                      <button
                        key={s.id}
                        onClick={() => { if (!isCurrent) onChangeStatus(s.id); }}
                        aria-current={isCurrent}
                        disabled={isCurrent}
                        className={`flex items-center gap-1.5 px-3 h-9 rounded-tile text-xs font-semibold transition-colors ${
                          isCurrent
                            ? 'cursor-default'
                            : 'bg-raised dark:bg-raised-dark text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark'
                        }`}
                        style={
                          isCurrent
                            ? {
                                backgroundColor: `${s.color}22`,
                                color: s.color,
                                border: `1px solid ${s.color}55`,
                              }
                            : { border: '1px solid transparent' }
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.label}
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

            {/* Caption — capped at four lines and scrolled beyond that, so a
                long one no longer pushes the rest of the dialog out of reach. */}
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
                <p className={readoutScroll}>{caption}</p>
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
                <p className={`${readoutScroll} break-words`}>{hashtags}</p>
              </div>
            )}

            {/* Internal notes — never shown to the client */}
            {!isClientRole && teamNotes && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500/80">
                  Team Notes
                </span>
                <p className="mt-2 max-h-[7.25rem] overflow-y-auto overscroll-contain rounded-tile border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft dark:text-ink-softdark">
                  {teamNotes}
                </p>
              </div>
            )}

            {scheduledLabel && (
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-brand flex-shrink-0" />
                <span className={`text-xs ${faintText}`}>
                  Scheduled:{' '}
                  <span className={`font-medium ${bodyText}`}>{scheduledLabel}</span>
                </span>
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
          </div>

          {/* ── Right pane: decisions and discussion ────────────────────── */}
          <div
            className={`${sheetPane} border-t border-hairline dark:border-hairline-dark lg:border-t-0 lg:border-l bg-canvas/40 dark:bg-canvas-dark/40`}
          >
            {/* Review status (non-client sees read-only) */}
            {!isClientRole && reviewStatusEl}

            {/* Client review UI */}
            {isClientRole && onReview && (
              <div>
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
                      <p className={readoutScroll}>Your note: "{item.reviewNote}"</p>
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
                    {/* A link built from a dev-server origin resolves only on
                        this machine, so sending it looks like a broken feature. */}
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
          </div>
        </div>

        {/* Pinned footer. Actions stay reachable without scrolling to the end
            of the discussion to find them. */}
        <footer className="flex items-center gap-2 px-5 py-3.5 border-t border-hairline dark:border-hairline-dark">
          <a
            href={item.driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnGhost} flex-1`}
          >
            <ExternalLink size={13} />
            <span className="truncate">Open in {media.label}</span>
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

          {!isClientRole && canEdit && (
            <button onClick={onEdit} className={btnGhost}>
              <Pencil size={13} />
              <span className="hidden sm:inline">Edit</span>
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
              <span className="hidden sm:inline">{confirmDelete ? 'Confirm?' : 'Delete'}</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
