import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onAdd: (data: { name: string; imageUrl?: string; about: string }) => void;
}

export default function AddClientModal({ onClose, onAdd }: Props) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [about, setAbout] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      imageUrl: imageUrl.trim() || undefined,
      about: about.trim(),
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
          <h2 className="text-lg font-semibold text-white">Add Client</h2>
          <button onClick={onClose} className="text-[#888] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm text-[#888] mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              required
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-[#888] mb-1.5">
              Profile Image URL <span className="text-[#555]">(optional)</span>
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-[#888] mb-1.5">About</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Brief description..."
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
              disabled={!name.trim()}
              className="flex-1 bg-[#6366f1] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#5558e3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
