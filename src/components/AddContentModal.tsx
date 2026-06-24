import { useState } from 'react';
import { X, Film } from 'lucide-react';
import { ContentItem, ContentStatus } from '../types';
import { extractDriveFileId, getDriveThumbnailUrl } from '../utils';

interface SubmitData {
  title: string;
  driveLink: string;
  driveFileId: string;
  notes?: string;
  status: ContentStatus;
  scheduledAt?: number;
}

interface Props {
  defaultStatus: ContentStatus;
  defaultScheduledAt?: number;
  existingItem?: ContentItem;
  onClose: () => void;
  onSubmit: (data: SubmitData) => void;
}

export default function AddContentModal({ defaultStatus, defaultScheduledAt, existingItem, onClose, onSubmit }: Props) {
  const isEdit = !!existingItem;

  const [title, setTitle] = useState(existingItem?.title ?? '');
  const [driveLink, setDriveLink] = useState(existingItem?.driveLink ?? '');
  const [notes, setNotes] = useState(existingItem?.notes ?? '');
  const [imgError, setImgError] = useState(false);

  const [schedDate, setSchedDate] = useState(() => {
    const ts = existingItem?.scheduledAt ?? defaultScheduledAt;
    if (ts && ts > 0) return new Date(ts).toISOString().slice(0, 10);
    return '';
  });
  const [schedTime, setSchedTime] = useState(() => {
    const ts = existingItem?.scheduledAt ?? defaultScheduledAt;
    if (ts && ts > 0) {
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return '';
  });

  const fileId = extractDriveFileId(driveLink.trim());
  const thumbnailUrl = fileId ? getDriveThumbnailUrl(fileId) : null;

  function handleDriveLinkChange(val: string) {
    setDriveLink(val);
    setImgError(false);
  }

  function getScheduledAt(): number | undefined {
    if (!schedDate) return undefined;
    const timeStr = schedTime || '00:00';
    const ts = new Date(`${schedDate}T${timeStr}`).getTime();
    return isNaN(ts) ? undefined : ts;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !driveLink.trim()) return;
    onSubmit({
      title: title.trim(),
      driveLink: driveLink.trim(),
      driveFileId: fileId || '',
      notes: notes.trim() || undefined,
      status: existingItem?.status ?? defaultStatus,
      scheduledAt: getScheduledAt(),
    });
    onClose();
  }

  const inputCls =
    'w-full bg-neutral-100 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#222] rounded-lg px-3 py-2.5 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-[#333] focus:outline-none focus:border-[#dc2626] transition-colors';
  const labelCls = 'block text-xs font-semibold text-neutral-500 dark:text-[#666] mb-1.5 uppercase tracking-wider';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">{isEdit ? 'Edit Content' : 'Add Content'}</h2>
          <button onClick={onClose} className="text-neutral-400 dark:text-[#444] hover:text-neutral-600 dark:hover:text-[#888] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Content Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title..."
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Drive Link</label>
            <input
              type="text"
              value={driveLink}
              onChange={(e) => handleDriveLinkChange(e.target.value)}
              placeholder="https://drive.google.com/..."
              required
              className={inputCls}
            />
          </div>

          {thumbnailUrl && (
            <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-[#1e1e1e]" style={{ aspectRatio: '16/9' }}>
              {!imgError ? (
                <img
                  src={thumbnailUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full bg-neutral-100 dark:bg-[#0c0c0c] flex items-center justify-center">
                  <Film size={22} className="text-neutral-300 dark:text-[#333]" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>
              Caption{' '}
              <span className="text-neutral-300 dark:text-[#333] normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Caption or notes for this video..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>
              Posting Schedule{' '}
              <span className="text-neutral-300 dark:text-[#333] normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                disabled={!schedDate}
                className={`${inputCls} w-32 disabled:opacity-40`}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-transparent border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] rounded-xl py-2.5 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-[#161616] hover:text-neutral-700 dark:hover:text-[#999] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !driveLink.trim()}
              className="flex-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-red-900/30"
            >
              {isEdit ? 'Save Changes' : 'Add Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
