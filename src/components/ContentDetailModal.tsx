import { useState } from 'react';
import {
  X, Copy, Check, ExternalLink, Calendar, Pencil, Trash2, Film, Image as ImageIcon,
  CheckCircle, XCircle, Clock, Download, History, Link2,
} from '../icons';
import CommentThread from './CommentThread';
import StagePill from './StagePill';
import { useFeedback } from './m3/Feedback';
import { ClientReview, ContentItem, ContentStatus } from '../types';
import {
  getMediaInfo, openLabel, mediaTypeOf, captionOf, teamNotesOf, PLATFORM_LABELS, isLocalOrigin, STAGES,
} from '../utils';
import {
  sheetOverlay, sheetPanelWide, sheetBody, sheetPane, faintText, bodyText, badge,
  sectionLabel, readout, readoutScroll, textarea, btnGhost, btnGhostDanger, btnSuccess,
  btnDanger, btnGhostSm, btnIcon, focusRing, modalTitle, segmented, segItem,
} from '../ui';

// On a phone the footer is icon buttons around one wide Open button.
const iconOnPhone = 'max-sm:!w-12 max-sm:!px-0 flex-shrink-0';

type CopyTarget = 'caption' | 'hashtags' | 'both';

// Small quiet action next to a section heading (Copy, + tags, Create link).
const inlineAction =
  `inline-flex items-center gap-1.5 h-6 px-2 -mr-2 text-[12px] font-medium text-ink-faint dark:text-ink-faintdark hover:text-brand-text dark:hover:text-brand-textdark hover:bg-hover dark:hover:bg-hover-dark transition-colors rounded-full ${focusRing}`;

interface Props {
  clientId: string;
  onComment: (body: string, atSeconds?: number) => Promise<void>;
  /** Absent for client-role users, who can't create public links. */
  onShare?: () => Promise<string>;
  /**
   * Absent for anyone who may not move content. Every stage is reachable from
   * every other, and this works at any screen width — the board only renders
   * one column below the lg breakpoint, and its cards do not drag there.
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
  const { confirm } = useFeedback();
  const [declineNote, setDeclineNote] = useState(item.reviewNote ?? '');
  const [decliningMode, setDecliningMode] = useState(false);

  const media = getMediaInfo(item.driveLink);
  const openText = openLabel(media);
  const thumbnailUrl = media.previewUrl;
  const isGraphic = mediaTypeOf(item) === 'graphic';
  const caption = captionOf(item);
  const hashtags = item.hashtags ?? '';
  const teamNotes = teamNotesOf(item);
  const platforms = item.platforms ?? [];
  const versions = item.versions ?? [];
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

  async function handleDeleteClick() {
    const ok = await confirm({
      title: 'Delete this post?',
      body: `"${item.title}" will be removed from the board. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) onDelete();
  }

  function handleApprove() {
    onReview?.('approved');
    onClose();
  }

  function handleDeclineSubmit() {
    onReview?.('declined', declineNote.trim() || undefined);
    onClose();
  }

  // What the left pane can actually show. A file with nothing to embed (OneDrive
  // above all) gets a compact file panel, never an empty 16:9 box.
  const showVideo = !!media.embedUrl && media.embedKind === 'video' && !isGraphic;
  const showFrame = !!media.embedUrl && media.embedKind === 'iframe';
  const showImage = !showVideo && !showFrame && !!thumbnailUrl && !imgError;
  const showFile = !showVideo && !showFrame && !showImage;

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
    const base = 'inline-flex items-center gap-1.5 h-7 pl-2 pr-3 rounded-full text-[12px] font-medium';
    if (item.clientReview === 'approved') {
      return (
        <div className="flex flex-col gap-2">
          <span className={`${base} self-start bg-success-soft dark:bg-success-softdark text-success-text dark:text-success-textdark`}>
            <CheckCircle size={14} />
            Client approved
          </span>
        </div>
      );
    }
    if (item.clientReview === 'declined') {
      return (
        <div className="flex flex-col gap-2">
          <span className={`${base} self-start bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark`}>
            <XCircle size={14} />
            Client asked for changes
          </span>
          {item.reviewNote && <p className={readoutScroll}>"{item.reviewNote}"</p>}
        </div>
      );
    }
    return (
      <span className={`${base} self-start bg-hover dark:bg-hover-dark ${bodyText}`}>
        <Clock size={14} />
        Waiting for client review
      </span>
    );
  })();

  const copyIcon = (which: CopyTarget) =>
    copied === which
      ? <Check size={14} className="text-success-text dark:text-success-textdark" />
      : <Copy size={14} />;

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
          <div className="w-10 h-1 rounded-full bg-outline/60 dark:bg-outline-dark/60" />
        </div>

        {/* Pinned header: the title and the close button stay put while the
            panes scroll. */}
        <header className="flex items-start gap-3 pl-6 pr-3 pt-4 pb-3">
          <div className="flex-1 min-w-0">
            <h2 className={`${modalTitle} line-clamp-2`}>{item.title}</h2>
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <StagePill status={item.status} />
              {platforms.map((p) => (
                <span
                  key={p}
                  className={`${badge} h-5 bg-hover dark:bg-hover-dark text-ink-soft dark:text-ink-softdark`}
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
              {scheduledLabel && (
                <span className={`inline-flex items-center gap-1 text-[12px] ml-1 ${faintText}`}>
                  <Calendar size={14} className="flex-shrink-0" />
                  {scheduledLabel}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className={`${btnIcon} flex-shrink-0`} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <div className={sheetBody}>
          {/* Left pane: the content itself */}
          <div className={sheetPane}>
            {/* flex-shrink-0 is load-bearing: this is a flex item in a pane of
                constrained height, and without it flex shrinking wins over
                aspect-ratio and squashes the player out of 16:9. */}
            {showFile ? (
              <a
                href={item.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-shrink-0 flex items-center gap-3 p-3 pr-4 rounded-card bg-raised dark:bg-raised-dark hover:bg-hover dark:hover:bg-hover-dark transition-colors ${focusRing}`}
              >
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
                <span className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-hover dark:bg-hover-dark text-[13px] font-medium text-ink dark:text-ink-dark flex-shrink-0">
                  <ExternalLink size={14} />
                  Open
                </span>
              </a>
            ) : (
              <div
                className="relative flex-shrink-0 rounded-card overflow-hidden bg-raised dark:bg-raised-dark"
                style={{ aspectRatio: '16/9' }}
              >
                {showVideo ? (
                  // The one provider that serves the bytes, so it gets real
                  // controls instead of someone else's player.
                  <video
                    src={media.embedUrl!}
                    poster={thumbnailUrl ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full h-full bg-black"
                  />
                ) : showFrame ? (
                  <iframe
                    src={media.embedUrl!}
                    title={item.title}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                  />
                ) : (
                  <img
                    src={thumbnailUrl!}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                )}
              </div>
            )}

            {media.embedUrl && needsLinkSharing ? (
              <p className={`-mt-2 text-[12px] leading-relaxed ${faintText}`}>
                Not playing? The file has to be shared as “Anyone with the link”.
                Otherwise use {openText} below.
              </p>
            ) : media.previewNote ? (
              <p className={`-mt-2 text-[12px] leading-relaxed ${faintText}`}>
                {media.previewNote}
              </p>
            ) : null}

            {/* Stage picker. Any stage reaches any other, and unlike the board's
                drag-and-drop it works below the lg breakpoint, where only one
                column is rendered and there is nothing to drag to. */}
            {onChangeStatus && (
              <div>
                <span className={sectionLabel}>Stage</span>
                <div className="mt-2 overflow-x-auto [scrollbar-width:none]">
                  <div role="group" aria-label="Stage" className={`${segmented} [@media(hover:none)]:!h-10`}>
                    {STAGES.map((s) => {
                      const isCurrent = s.id === item.status;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { if (!isCurrent) onChangeStatus(s.id); }}
                          aria-pressed={isCurrent}
                          aria-current={isCurrent}
                          className={segItem(isCurrent)}
                        >
                          {isCurrent
                            ? <Check size={14} />
                            : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />}
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Caption, capped at four lines and scrolled beyond that, so a
                long one no longer pushes the rest of the dialog out of reach. */}
            {caption ? (
              <div>
                <div className="flex items-center justify-between gap-3 mb-1.5 min-h-6">
                  <span className={sectionLabel}>Caption</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleCopy('caption', caption)} className={inlineAction}>
                      {copyIcon('caption')}
                      <span>{copied === 'caption' ? 'Copied' : 'Copy'}</span>
                    </button>
                    {hashtags && (
                      <button
                        onClick={() => handleCopy('both', `${caption}\n\n${hashtags}`)}
                        className={inlineAction}
                      >
                        {copyIcon('both')}
                        <span>{copied === 'both' ? 'Copied' : 'Copy with tags'}</span>
                      </button>
                    )}
                  </div>
                </div>
                <p className={readoutScroll}>{caption}</p>
              </div>
            ) : (
              <p className={`text-[13px] ${faintText}`}>No caption yet.</p>
            )}

            {hashtags && (
              <div>
                <div className="flex items-center justify-between gap-3 mb-1.5 min-h-6">
                  <span className={sectionLabel}>Hashtags</span>
                  <button onClick={() => handleCopy('hashtags', hashtags)} className={inlineAction}>
                    {copyIcon('hashtags')}
                    <span>{copied === 'hashtags' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className={`${readoutScroll} break-words`}>{hashtags}</p>
              </div>
            )}

            {/* Internal notes, never shown to the client */}
            {!isClientRole && teamNotes && (
              <div>
                <span className="text-[12px] font-medium text-warning-text dark:text-warning-textdark">
                  Team notes (not shown to the client)
                </span>
                <p className="mt-1.5 max-h-[7.25rem] overflow-y-auto overscroll-contain rounded-tile bg-warning-soft dark:bg-warning-softdark p-3 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-soft dark:text-ink-softdark">
                  {teamNotes}
                </p>
              </div>
            )}

            {versions.length > 0 && (
              <div>
                <span className={sectionLabel}>Earlier versions</span>
                <div className="flex flex-col gap-1 mt-1.5">
                  {versions.map((v, i) => (
                    <a
                      key={`${v.replacedAt}-${i}`}
                      href={v.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 text-[13px] transition-colors ${bodyText} hover:text-brand-text dark:hover:text-brand-textdark rounded-chip ${focusRing}`}
                    >
                      <History size={14} />
                      v{i + 1}
                      <span className={faintText}>
                        · replaced {new Date(v.replacedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </a>
                  ))}
                  <span className={`text-[13px] font-medium ${bodyText}`}>
                    v{versions.length + 1} (current)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right pane: decisions and discussion. A fill, not a hairline,
              tells it from the content. */}
          <div className={`${sheetPane} bg-raised/60 dark:bg-canvas-dark/40`}>
            {/* Review status (non-client sees read-only) */}
            {!isClientRole && reviewStatusEl}

            {/* Client review UI */}
            {isClientRole && onReview && (
              <div>
                {item.clientReview === 'approved' ? (
                  <div className="flex items-center gap-2 text-success-text dark:text-success-textdark text-[14px] font-medium">
                    <CheckCircle size={18} />
                    You approved this post
                  </div>
                ) : item.clientReview === 'declined' ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-brand-text dark:text-brand-textdark text-[14px] font-medium">
                      <XCircle size={18} />
                      You asked for changes
                    </div>
                    {item.reviewNote && (
                      <p className={readoutScroll}>Your note: "{item.reviewNote}"</p>
                    )}
                    <button
                      onClick={() => { setDecliningMode(false); onReview('pending'); }}
                      className={`${inlineAction} self-start`}
                    >
                      Reset review
                    </button>
                  </div>
                ) : decliningMode ? (
                  <div className="flex flex-col gap-2">
                    <label className={sectionLabel} htmlFor="decline-note">What should change?</label>
                    <textarea
                      id="decline-note"
                      value={declineNote}
                      onChange={(e) => setDeclineNote(e.target.value)}
                      rows={3}
                      placeholder="Tell us what needs to change..."
                      className={textarea}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setDecliningMode(false)} className={btnGhost}>
                        Cancel
                      </button>
                      <button onClick={handleDeclineSubmit} className={btnDanger}>
                        Send feedback
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleApprove} className={`${btnSuccess} flex-1`}>
                      <CheckCircle size={16} />
                      Approve
                    </button>
                    <button
                      onClick={() => setDecliningMode(true)}
                      className={`${btnGhost} flex-1`}
                    >
                      <XCircle size={16} />
                      Ask for changes
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
                  className={btnGhostSm}
                >
                  <Link2 size={14} />
                  {shareUrl ? 'Link copied, copy a new one' : 'Copy review link'}
                </button>
                {shareUrl && (
                  <>
                    <p className={`${readout} mt-2 text-[12px] break-all`}>{shareUrl}</p>
                    {/* A link built from a dev-server origin resolves only on
                        this machine, so sending it looks like a broken feature. */}
                    {isLocalOrigin(shareUrl) ? (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-brand-text dark:text-brand-textdark">
                        This link points at a local address, so it will not open for
                        anyone else. Deploy the app and set VITE_PUBLIC_APP_URL to the
                        deployed origin before sending review links.
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-warning-text dark:text-warning-textdark">
                        Anyone with this link can view and review this post without
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

        {/* Pinned footer, so the actions stay reachable without scrolling to
            the end of the discussion. */}
        <footer className="flex items-center gap-2 px-6 py-3 border-t border-hairline dark:border-hairline-dark">
          {!isClientRole && canDelete && (
            <button onClick={handleDeleteClick} className={`${btnGhostDanger} ${iconOnPhone}`} aria-label="Delete">
              <Trash2 size={16} />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
          <span className="hidden sm:block flex-1" />
          {!isClientRole && canEdit && (
            <button onClick={onEdit} className={`${btnGhost} ${iconOnPhone}`} aria-label="Edit">
              <Pencil size={16} />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
          {isGraphic && media.downloadUrl && (
            <a
              href={media.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnGhost} ${iconOnPhone}`}
              aria-label="Download"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
          <a
            href={item.driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnGhost} min-w-0 max-sm:flex-1`}
          >
            <ExternalLink size={16} />
            <span className="truncate">{openText}</span>
          </a>
        </footer>
      </div>
    </div>
  );
}
