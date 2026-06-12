import { useState } from 'react';
import { X, Film } from 'lucide-react';
import { ContentStatus } from '../types';
import { extractDriveFileId, getDriveThumbnailUrl } from '../utils';

interface Props {
  defaultStatus: ContentStatus;
  onClose: () => void;
  onAdd: (data: {
    title: string;
    driveLink: string;
    driveFileId: string;
    notes?: string;
    status: ContentStatus;
  }) => void;
}

export default function AddContentModal({ defaultStatus, onClose, onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [notes, setNotes] = useState('');
  const [imgError, setImgError] = useState(false);

  const fileId = extractDriveFileId(driveLink.trim());
  const thumbnailUrl = fileId ? getDriveThumbnailUrl(fileId) : null;

  function handleDriveLinkChange(val: string) {
    setDriveLink(val);
    setImgError(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !driveLink.trim()) return;
    onAdd({
      title: title.trim(),
      driveLink: driveLink.trim(),
      driveFileId: fileId || '',
      notes: notes.trim() || undefined,
      status: defaultStatus,
    });
    onClose();
  }

  const inputCls =
    'w-full bg-[#0c0c0c] border border-[#222] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#dc2626] transition-colors';
  const labelCls = 'block text-xs font-semibold text-[#666] mb-1.5 uppercase tracking-wider';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-white">Add Content</h2>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors">
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
              placeholder="Video title or caption..."
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
            <div className="rounded-xl overflow-hidden border border-[#1e1e1e]" style={{ aspectRatio: '16/9' }}>
              {!imgError ? (
                <img
                  src={thumbnailUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full bg-[#0c0c0c] flex items-center justify-center">
                  <Film size={22} className="text-[#333]" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>
              Notes <span className="text-[#333] normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes or instructions..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-transparent border border-[#222] text-[#666] rounded-xl py-2.5 text-sm font-medium hover:bg-[#161616] hover:text-[#999] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !driveLink.trim()}
              className="flex-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-red-900/30"
            >
              Add Content
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
