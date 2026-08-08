import { useState } from 'react';
import { X } from 'lucide-react';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, labelAside,
  input, textarea, btnPrimary, btnGhost,
} from '../ui';

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

  return (
    <div
      className={overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={modalPanel}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={modalTitle}>New Client</h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={label}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              required
              className={input}
            />
          </div>

          <div>
            <label className={label}>
              Profile Image URL <span className={labelAside}>(optional)</span>
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className={input}
            />
          </div>

          <div>
            <label className={label}>About</label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Brief description of the client..."
              rows={3}
              className={textarea}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()} className={`${btnPrimary} flex-1`}>
              Add Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
