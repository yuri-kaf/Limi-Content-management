import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Business, BusinessDraft, FolderColor } from '../types';
import { folderColor } from '../folderColors';
import ColorSwatchPicker from './ColorSwatchPicker';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, labelAside, hint,
  input, textarea, btnPrimary, btnGhost, btnGhostDanger,
} from '../ui';

interface Props {
  /** Absent when creating. */
  business?: Business;
  /** Why this business cannot be deleted, or null when it can. See businessDeleteBlocker(). */
  deleteBlocker?: string | null;
  onClose: () => void;
  /** Resolves false when the save failed, which keeps the form open with what was typed. */
  onSave: (draft: BusinessDraft) => Promise<boolean> | void;
  /** Absent when deleting is not offered at all. */
  onDelete?: () => void;
}

// One form for creating and editing, like ClientModal — split, the fields and
// their validation would drift apart.
export default function BusinessModal({
  business, deleteBlocker = null, onClose, onSave, onDelete,
}: Props) {
  const editing = !!business;
  const [name, setName] = useState(business?.name ?? '');
  // folderColor() mends a stored value that is not one of the ten.
  const [color, setColor] = useState<FolderColor>(folderColor(business?.color).id);
  const [logoUrl, setLogoUrl] = useState(business?.logoUrl ?? '');
  const [about, setAbout] = useState(business?.about ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const result = await onSave({
      name: name.trim(),
      color,
      logoUrl: logoUrl.trim() || undefined,
      about: about.trim(),
    });
    setSaving(false);
    if (result !== false) onClose();
  }

  function handleDelete() {
    if (!business || !onDelete || deleteBlocker) return;
    if (!confirm(`Delete "${business.name}"? This can't be undone.`)) return;
    onDelete();
    onClose();
  }

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalPanel} role="dialog" aria-modal="true" aria-labelledby="business-form-title">
        <div className="flex items-center justify-between mb-6">
          <h2 id="business-form-title" className={modalTitle}>
            {editing ? 'Edit business' : 'New business'}
          </h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={label} htmlFor="business-name">Name</label>
            <input
              id="business-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business name"
              required
              autoFocus
              className={input}
            />
          </div>

          <div>
            <span className={label}>Colour</span>
            <ColorSwatchPicker value={color} onChange={setColor} label="Business colour" />
          </div>

          <div>
            <label className={label} htmlFor="business-logo">
              Logo URL <span className={labelAside}>(optional)</span>
            </label>
            <input
              id="business-logo"
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className={input}
            />
          </div>

          <div>
            <label className={label} htmlFor="business-about">
              About <span className={labelAside}>(optional)</span>
            </label>
            <textarea
              id="business-about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="What this business sells, and to whom..."
              rows={3}
              className={textarea}
            />
          </div>

          {editing && onDelete && (
            <div>
              {/* aria-disabled rather than disabled: a disabled button drops out
                  of the Tab order, and with it the only way to reach the reason
                  written under it. handleDelete refuses while it is blocked. */}
              <button
                type="button"
                onClick={handleDelete}
                aria-disabled={!!deleteBlocker}
                aria-describedby={deleteBlocker ? 'business-delete-blocker' : undefined}
                className={`${deleteBlocker ? `${btnGhost} opacity-40 cursor-not-allowed` : btnGhostDanger} w-full`}
              >
                <Trash2 size={14} />
                Delete business
              </button>
              {deleteBlocker && (
                <p id="business-delete-blocker" className={hint}>{deleteBlocker}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || saving} className={`${btnPrimary} flex-1`}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
