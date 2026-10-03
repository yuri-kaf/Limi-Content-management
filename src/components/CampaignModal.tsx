import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import {
  Business, Campaign, CampaignDraft, CampaignStatus, Deliverable, FolderColor, MediaType,
} from '../types';
import { CAMPAIGN_STATUSES, endsBeforeStart } from '../campaigns';
import { generateId } from '../utils';
import ColorSwatchPicker from './ColorSwatchPicker';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, labelAside, hint,
  input, textarea, chip, btnPrimary, btnGhost, btnGhostDanger,
} from '../ui';

interface Props {
  /** Absent when creating. */
  campaign?: Campaign;
  businesses: Business[];
  /** Pre-selected business when creating — the workspace's current scope, if any. */
  defaultBusinessId?: string;
  onClose: () => void;
  onSave: (draft: CampaignDraft) => void;
  onDelete?: () => void;
}

// The editor works on strings so a half-typed count does not snap back to a
// number under the cursor; the draft is built from these on save.
interface Row {
  id: string;
  label: string;
  mediaType: MediaType | '';
  target: string;
}

function toRows(deliverables: Deliverable[]): Row[] {
  return deliverables.map((d) => ({
    id: d.id,
    label: d.label,
    mediaType: d.mediaType ?? '',
    target: String(d.target),
  }));
}

export default function CampaignModal({
  campaign, businesses, defaultBusinessId, onClose, onSave, onDelete,
}: Props) {
  const editing = !!campaign;
  const [name, setName] = useState(campaign?.name ?? '');
  const [businessId, setBusinessId] = useState(
    campaign?.businessId ?? defaultBusinessId ?? businesses[0]?.id ?? ''
  );
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status ?? 'planning');
  // Stored days are already the 'YYYY-MM-DD' a date input reads and writes.
  const [start, setStart] = useState(campaign?.startDate ?? '');
  const [end, setEnd] = useState(campaign?.endDate ?? '');
  const [color, setColor] = useState<FolderColor>(campaign?.color ?? 'green');
  const [brief, setBrief] = useState(campaign?.brief ?? '');
  // Existing ids are kept: content points at a deliverable by id, so an edit
  // must not quietly unlink everything filed under it.
  const [rows, setRows] = useState<Row[]>(campaign ? toRows(campaign.deliverables) : []);

  const datesBackwards = endsBeforeStart(start, end);
  const rowsInvalid = rows.some((r) => !r.label.trim() || !(Number(r.target) >= 1));
  const canSave = !!name.trim() && !!businessId && !datesBackwards && !rowsInvalid;

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      businessId,
      name: name.trim(),
      brief: brief.trim(),
      status,
      // An emptied date input is '', which means no date rather than a day.
      startDate: start || undefined,
      endDate: end || undefined,
      color,
      deliverables: rows.map((r) => ({
        id: r.id,
        label: r.label.trim(),
        ...(r.mediaType ? { mediaType: r.mediaType } : {}),
        target: Math.floor(Number(r.target)),
      })),
    });
    onClose();
  }

  function handleDelete() {
    if (!campaign || !onDelete) return;
    const ok = confirm(
      `Delete "${campaign.name}"? Its content stays on the board — it just won't be grouped under this campaign any more.`
    );
    if (!ok) return;
    onDelete();
    onClose();
  }

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalPanel} role="dialog" aria-modal="true" aria-labelledby="campaign-form-title">
        <div className="flex items-center justify-between mb-6">
          <h2 id="campaign-form-title" className={modalTitle}>
            {editing ? 'Edit campaign' : 'New campaign'}
          </h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={label} htmlFor="campaign-name">Name</label>
            <input
              id="campaign-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer menu launch"
              required
              autoFocus
              className={input}
            />
          </div>

          {businesses.length >= 2 && (
            <div>
              <label className={label} htmlFor="campaign-business">Business</label>
              <select
                id="campaign-business"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className={input}
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {businesses.length === 0 && (
            <p className={hint}>
              This client has no business yet. Run "Set up businesses" on the Clients page first.
            </p>
          )}

          <div>
            <label className={label}>Status</label>
            <div className="grid grid-cols-3 gap-2">
              {CAMPAIGN_STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id)}
                  aria-pressed={status === s.id}
                  className={chip(status === s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="campaign-start">Start</label>
              <input
                id="campaign-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label} htmlFor="campaign-end">End</label>
              <input
                id="campaign-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={input}
              />
            </div>
          </div>
          {datesBackwards && (
            <p className="-mt-2 text-[11px] text-brand dark:text-red-400">
              The end date is before the start date.
            </p>
          )}

          <div>
            <label className={label}>Colour</label>
            <ColorSwatchPicker value={color} onChange={setColor} label="Campaign colour" />
          </div>

          <div>
            <label className={label} htmlFor="campaign-brief">
              Brief <span className={labelAside}>(optional)</span>
            </label>
            <textarea
              id="campaign-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What this campaign is for, who it speaks to, and anything the team should know..."
              rows={3}
              className={textarea}
            />
          </div>

          <div>
            <label className={label}>
              Deliverables <span className={labelAside}>(what the campaign needs)</span>
            </label>
            <div className="flex flex-col gap-2">
              {rows.map((r, index) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input
                    aria-label={`Deliverable ${index + 1} name`}
                    value={r.label}
                    onChange={(e) => updateRow(r.id, { label: e.target.value })}
                    placeholder="Reels"
                    className={`${input} flex-1 min-w-0`}
                  />
                  <select
                    aria-label={`Deliverable ${index + 1} type`}
                    value={r.mediaType}
                    onChange={(e) => updateRow(r.id, { mediaType: e.target.value as MediaType | '' })}
                    className={`${input} w-[96px] px-2`}
                  >
                    <option value="">Any</option>
                    <option value="video">Video</option>
                    <option value="graphic">Graphic</option>
                  </select>
                  <input
                    aria-label={`Deliverable ${index + 1} count`}
                    type="number"
                    min={1}
                    value={r.target}
                    onChange={(e) => updateRow(r.id, { target: e.target.value })}
                    className={`${input} w-[64px] px-2 text-center`}
                  />
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                    className={`${btnIcon} flex-shrink-0`}
                    aria-label={`Remove deliverable ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setRows((prev) => [...prev, { id: generateId(), label: '', mediaType: '', target: '1' }])
                }
                className={`${btnGhost} h-9 min-h-0 text-[12px]`}
              >
                <Plus size={14} />
                Add deliverable
              </button>
            </div>
            <p className={hint}>
              For example 3 Reels and 2 carousel graphics. Progress fills in as content is linked
              and posted.
            </p>
          </div>

          {editing && onDelete && (
            <button type="button" onClick={handleDelete} className={`${btnGhostDanger} w-full`}>
              <Trash2 size={14} />
              Delete campaign
            </button>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button type="submit" disabled={!canSave} className={`${btnPrimary} flex-1`}>
              {editing ? 'Save changes' : 'Create campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
