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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add Content</h2>
          <button onClick={onClose} className="text-[#888] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-[#888] mb-1.5">Content Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title or caption..."
              required
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-[#888] mb-1.5">Drive Link</label>
            <input
              type="text"
              value={driveLink}
              onChange={(e) => handleDriveLinkChange(e.target.value)}
              placeholder="https://drive.google.com/..."
              required
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          {thumbnailUrl && (
            <div className="rounded-lg overflow-hidden border border-[#2a2a2a]" style={{ aspectRatio: '16/9' }}>
              {!imgError ? (
                <img
                  src={thumbnailUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full bg-[#0f0f0f] flex items-center justify-center">
                  <Film size={24} className="text-[#555]" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-[#888] mb-1.5">
              Notes <span className="text-[#555]">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes or instructions..."
              rows={3}
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#6366f1] transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] text-[#888] rounded-lg py-2.5 text-sm font-medium hover:bg-[#222] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !driveLink.trim()}
              className="flex-1 bg-[#6366f1] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#5558e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Content
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
