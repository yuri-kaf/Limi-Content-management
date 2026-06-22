import { useState } from 'react';
import { X, Copy, Check, ExternalLink, Calendar, Pencil, Trash2, Film } from 'lucide-react';
import { ContentItem } from '../types';
import { getDriveThumbnailUrl } from '../utils';

interface Props {
  item: ContentItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ContentDetailModal({ item, onClose, onEdit, onDelete }: Props) {
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
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

          {/* Actions */}
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
            <button
              onClick={onEdit}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#222] text-[#666] hover:text-[#aaa] hover:border-[#333] transition-colors text-sm font-medium"
            >
              <Pencil size={13} />
              Edit
            </button>
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
          </div>
        </div>
      </div>
    </div>
  );
}
