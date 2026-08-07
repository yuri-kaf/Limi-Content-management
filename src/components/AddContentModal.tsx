import { useState } from 'react';
import { X, Film, Image as ImageIcon } from 'lucide-react';
import { ContentItem, ContentStatus, MediaType, Platform } from '../types';
import {
  extractDriveFileId, getMediaInfo, mediaTypeOf, captionOf, teamNotesOf, PLATFORM_LABELS,
} from '../utils';

interface SubmitData {
  title: string;
  driveLink: string;
  driveFileId: string;
  mediaType: MediaType;
  caption?: string;
  hashtags?: string;
  platforms?: Platform[];
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
  const [caption, setCaption] = useState(existingItem ? captionOf(existingItem) : '');
  const [hashtags, setHashtags] = useState(existingItem?.hashtags ?? '');
  const [platforms, setPlatforms] = useState<Platform[]>(existingItem?.platforms ?? []);
  const [notes, setNotes] = useState(existingItem ? teamNotesOf(existingItem) : '');
  const [mediaType, setMediaType] = useState<MediaType>(
    existingItem ? mediaTypeOf(existingItem) : 'video'
  );
  const [imgError, setImgError] = useState(false);
  const isGraphic = mediaType === 'graphic';

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

  const media = getMediaInfo(driveLink);
  // Still stored for Drive links so existing content keeps working unchanged.
  const fileId = media.provider === 'drive' ? extractDriveFileId(driveLink.trim()) : '';
  const thumbnailUrl = media.previewUrl;

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
      mediaType,
      caption: caption.trim(),
      hashtags: hashtags.trim(),
      platforms,
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
            <label className={labelCls}>Type</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'video' as const, label: 'Video', Icon: Film },
                { value: 'graphic' as const, label: 'Graphic', Icon: ImageIcon },
              ]).map(({ value, label, Icon }) => {
                const active = mediaType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setMediaType(value); setImgError(false); }}
                    className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium border transition-colors ${
                      active
                        ? 'bg-[#dc2626]/10 border-[#dc2626]/40 text-[#dc2626]'
                        : 'bg-neutral-100 dark:bg-[#0c0c0c] border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] hover:text-neutral-700 dark:hover:text-[#999]'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>Content Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isGraphic ? 'Graphic title...' : 'Video title...'}
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
            <p className="text-[11px] text-neutral-400 dark:text-[#555] mt-1.5">
              {driveLink.trim() === ''
                ? 'Google Drive, OneDrive, Dropbox, YouTube or a direct image URL.'
                : media.previewNote
                  ? `${media.label} — ${media.previewNote}`
                  : `${media.label}${isGraphic ? ' — share as "anyone with the link" so the preview and download work.' : ''}`}
            </p>
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
                <div className="w-full h-full bg-neutral-100 dark:bg-[#0c0c0c] flex flex-col items-center justify-center gap-1.5">
                  {isGraphic ? (
                    <ImageIcon size={22} className="text-neutral-300 dark:text-[#333]" />
                  ) : (
                    <Film size={22} className="text-neutral-300 dark:text-[#333]" />
                  )}
                  <span className="text-[10px] text-neutral-400 dark:text-[#444] px-4 text-center">
                    No preview — check the file is shared as "anyone with the link"
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>
              Caption{' '}
              <span className="text-neutral-300 dark:text-[#333] normal-case font-normal tracking-normal">(the client sees this)</span>
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="The copy that goes out with this post..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>
              Hashtags{' '}
              <span className="text-neutral-300 dark:text-[#333] normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <textarea
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#example #tags"
              rows={2}
              className={`${inputCls} resize-none`}
            />
            <p className="text-[11px] text-neutral-400 dark:text-[#555] mt-1.5">
              Kept separate so they can be copied on their own.
            </p>
          </div>

          <div>
            <label className={labelCls}>
              Platforms{' '}
              <span className="text-neutral-300 dark:text-[#333] normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => {
                const active = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setPlatforms((prev) =>
                        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-[#dc2626]/10 border-[#dc2626]/40 text-[#dc2626]'
                        : 'bg-neutral-100 dark:bg-[#0c0c0c] border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] hover:text-neutral-700 dark:hover:text-[#999]'
                    }`}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Team Notes{' '}
              <span className="text-neutral-300 dark:text-[#333] normal-case font-normal tracking-normal">(internal only)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reshoot the intro, waiting on logo files..."
              rows={2}
              className={`${inputCls} resize-none`}
            />
            <p className="text-[11px] text-neutral-400 dark:text-[#555] mt-1.5">
              Not shown to the client.
            </p>
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
