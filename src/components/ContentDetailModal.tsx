import { useState } from 'react';
import {
  X, Copy, Check, ExternalLink, Calendar, Pencil, Trash2, Film,
  CheckCircle, XCircle, Clock, Download,
} from 'lucide-react';
import { ClientReview, ContentItem } from '../types';
import {
  getMediaInfo, mediaTypeOf, captionOf, teamNotesOf, PLATFORM_LABELS,
} from '../utils';

type CopyTarget = 'caption' | 'hashtags' | 'both';

interface Props {
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
        <div className="flex items-center gap-1.5 text-emerald-500">
          <CheckCircle size={13} />
          <span className="text-xs font-semibold">Client Approved</span>
        </div>
      );
    }
    if (item.clientReview === 'declined') {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-red-400">
            <XCircle size={13} />
            <span className="text-xs font-semibold">Client Declined</span>
          </div>
          {item.reviewNote && (
            <p className="text-xs text-neutral-500 dark:text-[#666] bg-neutral-100 dark:bg-[#0d0d0d] rounded-lg p-2 border border-neutral-200 dark:border-[#1a1a1a] leading-relaxed">
              "{item.reviewNote}"
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-neutral-400 dark:text-[#555]">
        <Clock size={13} />
        <span className="text-xs font-semibold">Pending Client Review</span>
      </div>
    );
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex sm:items-center sm:justify-center items-end"
      style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] w-full sm:max-w-lg shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto
                   rounded-t-2xl sm:rounded-2xl sm:mx-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-200 dark:bg-[#2a2a2a]" />
        </div>

        {/* Thumbnail */}
        <div className="relative" style={{ aspectRatio: '16/9' }}>
          {thumbnailUrl && !imgError ? (
            <img
              src={thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-neutral-100 dark:bg-[#0c0c0c] flex items-center justify-center">
              <Film size={36} className="text-neutral-300 dark:text-[#2a2a2a]" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/70 text-[#888] hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          {/* Title */}
          <h2 className="text-base font-bold text-neutral-900 dark:text-white leading-snug">{item.title}</h2>

          {platforms.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {platforms.map((p) => (
                <span
                  key={p}
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-[#1e1e1e] text-neutral-500 dark:text-[#777]"
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          )}

          {/* Caption */}
          {caption ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-400 dark:text-[#555] uppercase tracking-wider">Caption</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleCopy('caption', caption)}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-[#444] hover:text-[#dc2626] transition-colors"
                  >
                    {copied === 'caption' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    <span>{copied === 'caption' ? 'Copied!' : 'Copy'}</span>
                  </button>
                  {hashtags && (
                    <button
                      onClick={() => handleCopy('both', `${caption}\n\n${hashtags}`)}
                      className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-[#444] hover:text-[#dc2626] transition-colors"
                    >
                      {copied === 'both' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      <span>{copied === 'both' ? 'Copied!' : '+ tags'}</span>
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-neutral-500 dark:text-[#888] leading-relaxed bg-neutral-50 dark:bg-[#0d0d0d] rounded-xl p-3 border border-neutral-200 dark:border-[#1a1a1a] whitespace-pre-wrap">
                {caption}
              </p>
            </div>
          ) : (
            <p className="text-xs text-neutral-300 dark:text-[#333] italic">No caption added.</p>
          )}

          {hashtags && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-400 dark:text-[#555] uppercase tracking-wider">Hashtags</span>
                <button
                  onClick={() => handleCopy('hashtags', hashtags)}
                  className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-[#444] hover:text-[#dc2626] transition-colors"
                >
                  {copied === 'hashtags' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  <span>{copied === 'hashtags' ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-sm text-neutral-500 dark:text-[#888] leading-relaxed bg-neutral-50 dark:bg-[#0d0d0d] rounded-xl p-3 border border-neutral-200 dark:border-[#1a1a1a] whitespace-pre-wrap break-words">
                {hashtags}
              </p>
            </div>
          )}

          {/* Internal notes — never shown to the client */}
          {!isClientRole && teamNotes && (
            <div>
              <span className="text-xs font-semibold text-amber-600/80 dark:text-amber-500/70 uppercase tracking-wider">
                Team Notes
              </span>
              <p className="mt-2 text-sm text-neutral-500 dark:text-[#888] leading-relaxed bg-amber-50 dark:bg-[#17130a] rounded-xl p-3 border border-amber-200 dark:border-amber-900/40 whitespace-pre-wrap">
                {teamNotes}
              </p>
            </div>
          )}

          {/* Posting schedule */}
          {scheduledLabel && (
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-[#dc2626] flex-shrink-0" />
              <span className="text-xs text-neutral-400 dark:text-[#555]">
                Scheduled:{' '}
                <span className="text-neutral-500 dark:text-[#777] font-medium">{scheduledLabel}</span>
              </span>
            </div>
          )}

          {/* Review status (non-client sees read-only) */}
          {!isClientRole && (
            <div className="pt-1 border-t border-neutral-100 dark:border-[#1a1a1a]">
              {reviewStatusEl}
            </div>
          )}

          {/* Client review UI */}
          {isClientRole && onReview && (
            <div className="pt-1 border-t border-neutral-100 dark:border-[#1a1a1a]">
              {item.clientReview === 'approved' ? (
                <div className="flex items-center gap-2 text-emerald-500 text-sm font-semibold">
                  <CheckCircle size={15} />
                  You approved this content
                </div>
              ) : item.clientReview === 'declined' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                    <XCircle size={15} />
                    You declined this content
                  </div>
                  {item.reviewNote && (
                    <p className="text-xs text-neutral-500 dark:text-[#666] bg-neutral-50 dark:bg-[#0d0d0d] rounded-lg p-2 border border-neutral-200 dark:border-[#1a1a1a] leading-relaxed">
                      Your note: "{item.reviewNote}"
                    </p>
                  )}
                  <button
                    onClick={() => { setDecliningMode(false); onReview('pending'); }}
                    className="text-xs text-neutral-400 dark:text-[#555] hover:text-neutral-600 dark:hover:text-[#888] transition-colors self-start"
                  >
                    Reset review
                  </button>
                </div>
              ) : decliningMode ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-neutral-500 dark:text-[#555] uppercase tracking-wider">
                    Reason / Suggestions
                  </label>
                  <textarea
                    value={declineNote}
                    onChange={(e) => setDeclineNote(e.target.value)}
                    rows={3}
                    placeholder="Tell us what needs to change..."
                    className="w-full bg-neutral-100 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#222] rounded-lg px-3 py-2 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-[#333] focus:outline-none focus:border-[#dc2626] transition-colors resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDecliningMode(false)}
                      className="flex-1 py-3 rounded-xl border border-neutral-200 dark:border-[#222] text-neutral-400 dark:text-[#555] text-sm hover:text-neutral-600 dark:hover:text-[#888] hover:border-neutral-300 dark:hover:border-[#333] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeclineSubmit}
                      className="flex-1 py-3 rounded-xl bg-red-950/40 border border-red-900/60 text-red-400 text-sm font-semibold hover:bg-red-950/60 transition-colors"
                    >
                      Confirm Decline
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-sm font-semibold hover:bg-emerald-950/60 transition-colors"
                  >
                    <CheckCircle size={13} />
                    Approve
                  </button>
                  <button
                    onClick={() => setDecliningMode(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] text-sm font-semibold hover:text-red-400 hover:border-red-900/40 hover:bg-red-950/20 transition-colors"
                  >
                    <XCircle size={13} />
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Drive link — always visible for ALL roles */}
          <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 dark:border-[#1a1a1a]">
            <a
              href={item.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] hover:text-neutral-700 dark:hover:text-[#999] hover:border-neutral-300 dark:hover:border-[#333] active:bg-neutral-100 dark:active:bg-[#1a1a1a] transition-colors text-sm font-medium"
            >
              <ExternalLink size={13} />
              Open in Drive
            </a>

            {isGraphic && media.downloadUrl && (
              <a
                href={media.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white transition-colors text-sm font-semibold"
              >
                <Download size={13} />
                Download
              </a>
            )}

            {/* Edit / Delete — only when user has permission */}
            {!isClientRole && canEdit && (
              <button
                onClick={onEdit}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] hover:text-neutral-700 dark:hover:text-[#aaa] hover:border-neutral-300 dark:hover:border-[#333] active:bg-neutral-100 dark:active:bg-[#1a1a1a] transition-colors text-sm font-medium"
              >
                <Pencil size={13} />
                Edit
              </button>
            )}
            {!isClientRole && canDelete && (
              <button
                onClick={handleDeleteClick}
                onBlur={() => setConfirmDelete(false)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  confirmDelete
                    ? 'bg-red-950/40 border border-red-900/60 text-red-400'
                    : 'border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] hover:text-red-500 hover:border-red-900/40 hover:bg-red-950/20'
                }`}
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
