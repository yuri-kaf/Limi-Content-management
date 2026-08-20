import { useState } from 'react';
import { X } from 'lucide-react';
import { Client } from '../types';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, labelAside,
  input, textarea, btnPrimary, btnGhost,
} from '../ui';

export interface ClientDraft {
  name: string;
  imageUrl?: string;
  about: string;
}

interface Props {
  /** Absent when creating. Present when editing an existing client. */
  client?: Client;
  onClose: () => void;
  onSave: (data: ClientDraft) => void;
}

// One modal for both creating and editing. Splitting them would duplicate the
// three fields and the validation, and they would drift.
export default function ClientModal({ client, onClose, onSave }: Props) {
  const editing = !!client;
  const [name, setName] = useState(client?.name ?? '');
  const [imageUrl, setImageUrl] = useState(client?.imageUrl ?? '');
  const [about, setAbout] = useState(client?.about ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), imageUrl: imageUrl.trim() || undefined, about: about.trim() });
    onClose();
  }

  return (
    <div
      className={overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={modalPanel}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={modalTitle}>{editing ? 'Edit client' : 'New client'}</h2>
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
              autoFocus
              className={input}
            />
          </div>

          <div>
            <label className={label}>
              Profile image URL <span className={labelAside}>(optional)</span>
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
              {editing ? 'Save changes' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
