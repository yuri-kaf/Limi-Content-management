import { useState } from 'react';
import {
  X, Copy, Check, ExternalLink, Calendar, Pencil, Trash2, Film,
  CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { ClientReview, ContentItem } from '../types';
import { getDriveThumbnailUrl } from '../utils';

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
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [declineNote, setDeclineNote] = useState(item.reviewNote ?? '');
  const [decliningMode, setDecliningMode] = useState(false);

  const thumbnailUrl = item.driveFileId ? getDriveThumbnailUrl(item.driveFileId) : null;

  function handleCopy() {
    if (item.notes) {
      navigator.clipboard.writeText(item.notes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
            <p className="text-xs text-[#666] bg-[#0d0d0d] rounded-lg p-2 border border-[#1a1a1a] leading-relaxed">
              "{item.reviewNote}"
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-[#555]">
        <Clock size={13} />
        <span className="text-xs font-semibold">Pending Client Review</span>
      </div>
    );
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
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
            <div className="w-full h-full bg-[#0c0c0c] flex items-center justify-center">
              <Film size={36} className="text-[#2a2a2a]" />
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
          <h2 className="text-base font-bold text-white leading-snug">{item.title}</h2>

          {/* Caption */}
          {item.notes ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#555] uppercase tracking-wider">Caption</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-[#444] hover:text-[#dc2626] transition-colors"
                >
                  {copied ? (
                    <Check size={11} className="text-emerald-500" />
                  ) : (
                    <Copy size={11} />
                  )}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-sm text-[#888] leading-relaxed bg-[#0d0d0d] rounded-xl p-3 border border-[#1a1a1a] whitespace-pre-wrap">
                {item.notes}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#333] italic">No caption added.</p>
          )}

          {/* Posting schedule */}
          {scheduledLabel && (
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-[#dc2626] flex-shrink-0" />
              <span className="text-xs text-[#555]">
                Scheduled:{' '}
                <span className="text-[#777] font-medium">{scheduledLabel}</span>
              </span>
            </div>
          )}

          {/* Review status (non-client sees read-only status) */}
          {!isClientRole && (
            <div className="pt-1 border-t border-[#1a1a1a]">
              {reviewStatusEl}
            </div>
          )}

          {/* Client review UI */}
          {isClientRole && onReview && (
            <div className="pt-1 border-t border-[#1a1a1a]">
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
                    <p className="text-xs text-[#666] bg-[#0d0d0d] rounded-lg p-2 border border-[#1a1a1a] leading-relaxed">
                      Your note: "{item.reviewNote}"
                    </p>
                  )}
                  <button
                    onClick={() => { setDecliningMode(false); onReview('pending'); }}
                    className="text-xs text-[#555] hover:text-[#888] transition-colors self-start"
                  >
                    Reset review
                  </button>
                </div>
              ) : decliningMode ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-[#555] uppercase tracking-wider">
                    Reason / Suggestions
                  </label>
                  <textarea
                    value={declineNote}
                    onChange={(e) => setDeclineNote(e.target.value)}
                    rows={3}
                    placeholder="Tell us what needs to change..."
                    className="w-full bg-[#0c0c0c] border border-[#222] rounded-lg px-3 py-2 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#dc2626] transition-colors resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDecliningMode(false)}
                      className="flex-1 py-2 rounded-xl border border-[#222] text-[#555] text-sm hover:text-[#888] hover:border-[#333] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeclineSubmit}
                      className="flex-1 py-2 rounded-xl bg-red-950/40 border border-red-900/60 text-red-400 text-sm font-semibold hover:bg-red-950/60 transition-colors"
                    >
                      Confirm Decline
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-sm font-semibold hover:bg-emerald-950/60 transition-colors"
                  >
                    <CheckCircle size={13} />
                    Approve
                  </button>
                  <button
                    onClick={() => setDecliningMode(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#222] text-[#666] text-sm font-semibold hover:text-red-400 hover:border-red-900/40 hover:bg-red-950/20 transition-colors"
                  >
                    <XCircle size={13} />
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Actions (non-client) */}
          {!isClientRole && (canEdit || canDelete) && (
            <div className="flex items-center gap-2 pt-1">
              <a
                href={item.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#222] text-[#666] hover:text-[#999] hover:border-[#333] transition-colors text-sm font-medium"
              >
                <ExternalLink size={13} />
                Open in Drive
              </a>
              {canEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#222] text-[#666] hover:text-[#aaa] hover:border-[#333] transition-colors text-sm font-medium"
                >
                  <Pencil size={13} />
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDeleteClick}
                  onBlur={() => setConfirmDelete(false)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    confirmDelete
                      ? 'bg-red-950/40 border border-red-900/60 text-red-400'
                      : 'border border-[#222] text-[#666] hover:text-red-500 hover:border-red-900/40 hover:bg-red-950/20'
                  }`}
                >
                  <Trash2 size={13} />
                  {confirmDelete ? 'Confirm?' : 'Delete'}
                </button>
              )}
            </div>
          )}

          {/* Drive link for client role */}
          {isClientRole && (
            <a
              href={item.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#222] text-[#666] hover:text-[#999] hover:border-[#333] transition-colors text-sm font-medium"
            >
              <ExternalLink size={13} />
              Open in Drive
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
