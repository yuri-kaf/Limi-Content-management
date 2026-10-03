import { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import {
  Business, Campaign, CampaignDraft, CampaignStatus, Deliverable, FolderColor, MediaType,
} from '../types';
import { CAMPAIGN_STATUSES, endsBeforeStart } from '../campaigns';
import { folderColor } from '../folderColors';
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
  /**
   * Resolves false when the save failed, which keeps the form open with what
   * was typed: a brief and a list of deliverables are too much to retype.
   */
  onSave: (draft: CampaignDraft) => Promise<boolean> | void;
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

// The shared input recipe is full width with roomy padding. These fixed
// columns override both with `!`: Tailwind orders same-property utilities by
// its own rules, not by their order in the class list, so a plain w-[96px]
// placed after `input` would lose to its w-full.
const typeSelect = `${input} !w-[96px] !px-2 flex-shrink-0`;
const countInput = `${input} !w-[64px] !px-2 text-center flex-shrink-0`;

const errorText = 'text-[11px] text-brand dark:text-red-400';

export default function CampaignModal({
  campaign, businesses, defaultBusinessId, onClose, onSave, onDelete,
}: Props) {
  const editing = !!campaign;
  const [name, setName] = useState(campaign?.name ?? '');
  const [chosenBusiness, setChosenBusiness] = useState(
    campaign?.businessId ?? defaultBusinessId ?? ''
  );
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status ?? 'planning');
  // Stored days are already the 'YYYY-MM-DD' a date input reads and writes.
  const [start, setStart] = useState(campaign?.startDate ?? '');
  const [end, setEnd] = useState(campaign?.endDate ?? '');
  // Green rather than the folder default (blue), so a campaign reads apart
  // from its client's folder. folderColor() also mends a stored value that is
  // not one of the ten.
  const [color, setColor] = useState<FolderColor>(folderColor(campaign?.color ?? 'green').id);
  const [brief, setBrief] = useState(campaign?.brief ?? '');
  // Existing ids are kept: content points at a deliverable by id, so an edit
  // must not quietly unlink everything filed under it. Removing a row does
  // unlink its content — the items stay in the campaign, just unslotted.
  const [rows, setRows] = useState<Row[]>(campaign ? toRows(campaign.deliverables) : []);
  const [saving, setSaving] = useState(false);
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  // Worked out on every render rather than fixed when the form opened, so a
  // business deleted meanwhile — or none chosen yet — falls back to the first.
  const businessId = businesses.some((b) => b.id === chosenBusiness)
    ? chosenBusiness
    : businesses[0]?.id ?? '';
  const datesBackwards = endsBeforeStart(start, end);
  const rowsInvalid = rows.some((r) => !r.label.trim() || !(Number(r.target) >= 1));
  const canSave = !!name.trim() && !!businessId && !datesBackwards && !rowsInvalid && !saving;

  // A new row's name box takes focus, so typing can start straight away.
  useEffect(() => {
    if (!focusRow) return;
    document.getElementById(`deliverable-${focusRow}`)?.focus();
    setFocusRow(null);
  }, [focusRow]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const id = generateId();
    setRows((prev) => [...prev, { id, label: '', mediaType: '', target: '1' }]);
    setFocusRow(id);
  }

  // The removed row's button goes with it, so focus moves to Add rather than
  // falling back to the page behind the dialog.
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    addButton.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const result = await onSave({
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
    setSaving(false);
    if (result !== false) onClose();
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
                onChange={(e) => setChosenBusiness(e.target.value)}
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
            <span id="campaign-status-label" className={label}>Status</span>
            <div role="group" aria-labelledby="campaign-status-label" className="grid grid-cols-3 gap-2">
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
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
                aria-invalid={datesBackwards}
                aria-describedby={datesBackwards ? 'campaign-dates-error' : undefined}
                className={input}
              />
            </div>
          </div>
          {datesBackwards && (
            <p id="campaign-dates-error" role="alert" className={`-mt-2 ${errorText}`}>
              The end date is before the start date.
            </p>
          )}

          <div>
            <span className={label}>Colour</span>
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
            <span id="campaign-deliverables-label" className={label}>
              Deliverables <span className={labelAside}>(what the campaign needs)</span>
            </span>
            <div role="group" aria-labelledby="campaign-deliverables-label" className="flex flex-col gap-2">
              {rows.map((r, index) => (
                // Below sm the name takes a line of its own and the rest sit
                // under it; from sm up the row is one line. basis-full forces
                // the wrap without fighting the input's own w-full.
                <div key={r.id} className="flex flex-wrap items-center gap-2">
                  <input
                    id={`deliverable-${r.id}`}
                    aria-label={`Deliverable ${index + 1} name`}
                    aria-invalid={!r.label.trim()}
                    value={r.label}
                    onChange={(e) => updateRow(r.id, { label: e.target.value })}
                    placeholder="Reels"
                    className={`${input} basis-full sm:basis-0 sm:flex-1 min-w-0`}
                  />
                  <select
                    aria-label={`Deliverable ${index + 1} type`}
                    value={r.mediaType}
                    onChange={(e) => updateRow(r.id, { mediaType: e.target.value as MediaType | '' })}
                    className={typeSelect}
                  >
                    <option value="">Any</option>
                    <option value="video">Video</option>
                    <option value="graphic">Graphic</option>
                  </select>
                  <input
                    aria-label={`Deliverable ${index + 1} count`}
                    aria-invalid={!(Number(r.target) >= 1)}
                    type="number"
                    min={1}
                    step={1}
                    value={r.target}
                    onChange={(e) => updateRow(r.id, { target: e.target.value })}
                    className={countInput}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    className={`${btnIcon} flex-shrink-0 ml-auto sm:ml-0`}
                    aria-label={`Remove deliverable ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button ref={addButton} type="button" onClick={addRow} className={btnGhost}>
                <Plus size={14} />
                Add deliverable
              </button>
            </div>
            {/* Says why Create is disabled, rather than leaving a dimmed button
                to explain itself. */}
            {rowsInvalid ? (
              <p role="alert" className={`mt-1.5 ${errorText}`}>
                Each deliverable needs a name and a count of at least 1.
              </p>
            ) : (
              <p className={hint}>
                For example 3 Reels and 2 carousel graphics. Progress fills in as content is linked
                and posted.
              </p>
            )}
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
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
