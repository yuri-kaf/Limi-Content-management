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
    onAdd({ name: name.trim(), imageUrl: imageUrl.trim() || undefined, about: about.trim() });
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
          <h2 className="text-base font-bold text-white">New Client</h2>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Profile Image URL <span className="text-[#333] normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>About</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Brief description of the client..."
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
              disabled={!name.trim()}
              className="flex-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-red-900/30"
            >
              Add Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
