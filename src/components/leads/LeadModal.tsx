import { useMemo, useRef, useState } from 'react';
import { X, AlertTriangle, ChevronDown } from 'lucide-react';
import { Lead, LeadDraft, LeadLostReason, LeadSource, LeadStatus } from '../../types';
import {
  FOLLOW_UP_PRESETS, LEAD_SOURCES, LEAD_STATUSES, LOST_REASONS, findDuplicates, followUpLabel,
  leadStatus, nameFromHandle, parseProfileInput, type SocialField,
} from '../../leads';
import { LeadStatusSelect, PotentialStars, SourceIcon } from './LeadBits';
import {
  sheetOverlay, sheetPanel, modalTitle, btnIcon, label, labelAside, input, textarea, btnPrimary,
  btnGhost, chip, hint, focusRing, faintText,
} from '../../ui';

interface Props {
  /** Absent when adding. */
  lead?: Lead;
  leads: Lead[];
  today: string;
  onClose: () => void;
  /** Resolves true once saved. */
  onSave: (draft: LeadDraft) => Promise<boolean>;
  onOpenLead: (id: string) => void;
}

const EMPTY: LeadDraft = {
  name: '', source: 'instagram', status: 'approached', note: '',
};

function draftOf(lead?: Lead): LeadDraft {
  if (!lead) return { ...EMPTY };
  const { id, ownerEmail, ownerName, createdAt, updatedAt, statusAt, clientId, ...draft } = lead;
  void id; void ownerEmail; void ownerName; void createdAt; void updatedAt; void statusAt; void clientId;
  return draft;
}

// One form for adding and editing. Adding is the hot path, done tens of times
// a day from a phone with Instagram open beside it, so the top of the form is
// all it needs: paste the profile link into the name, set the status and the
// stars, save and add the next. Everything else is optional and folds away.
export default function LeadModal({ lead, leads, today, onClose, onSave, onOpenLead }: Props) {
  const editing = !!lead;
  const [d, setD] = useState<LeadDraft>(() => draftOf(lead));
  const [more, setMore] = useState(() => editing);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const duplicates = useMemo(() => findDuplicates(d, leads, lead?.id), [d, leads, lead?.id]);
  const industries = useMemo(
    () => [...new Set(leads.map((l) => l.industry?.trim()).filter(Boolean))].sort() as string[],
    [leads]
  );

  // A profile link pasted into a field goes where it belongs: into its own
  // platform's field, naming the source and, if there is no name yet, the
  // business. Only a full link is moved; a typed word stays where it is.
  function routeProfile(raw: string, from: 'name' | SocialField): boolean {
    if (!/[./]/.test(raw) || !/(instagram|tiktok|facebook|fb)\./i.test(raw)) return false;
    const parsed = parseProfileInput(raw);
    if (!parsed) return false;
    setD((prev) => ({
      ...prev,
      [parsed.field]: parsed.handle,
      ...(from === 'name' || !prev.name.trim() ? { name: nameFromHandle(parsed.handle) } : {}),
      ...(from === 'name' && !editing ? { source: parsed.field as LeadSource } : {}),
    }));
    return true;
  }

  function onSocial(field: SocialField, value: string) {
    if (!routeProfile(value, field)) set(field, value);
  }

  // Denied wants a reason; Onboarded is not offered here at all, because it
  // has to make the client, which the lead's own page does.
  function onStatus(status: LeadStatus) {
    setD((prev) => ({
      ...prev,
      status,
      lostReason: status === 'denied' ? prev.lostReason ?? 'not-interested' : undefined,
    }));
  }

  async function submit(addAnother: boolean) {
    if (!d.name.trim() || saving) return;
    setSaving(true);
    const ok = await onSave(d);
    setSaving(false);
    if (!ok) return;
    if (addAnother) {
      // Keep where and how she is working (source, status), clear the business.
      setD({ ...EMPTY, source: d.source, status: d.status });
      setSavedCount((n) => n + 1);
      nameRef.current?.focus();
    } else {
      onClose();
    }
  }

  const statusOptions = LEAD_STATUSES.filter((s) => s.id !== 'onboarded' || lead?.status === 'onboarded');

  return (
    <div className={sheetOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${sheetPanel} p-5 sm:p-6`} role="dialog" aria-modal="true" aria-labelledby="lead-modal-title">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="lead-modal-title" className={modalTitle}>{editing ? 'Edit lead' : 'New lead'}</h2>
            {savedCount > 0 && (
              <p className="text-[12px] text-success-text dark:text-success-textdark mt-0.5" role="status">
                {savedCount} added. Next one.
              </p>
            )}
          </div>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label className={label} htmlFor="lead-name">Business</label>
            <input
              id="lead-name"
              ref={nameRef}
              type="text"
              value={d.name}
              onChange={(e) => { if (!routeProfile(e.target.value, 'name')) set('name', e.target.value); }}
              placeholder="Name, or paste their Instagram or TikTok link"
              required
              autoFocus
              autoComplete="off"
              className={input}
            />
          </div>

          {/* Duplicates show as soon as they match: approaching a business twice,
              or one that already said no, is the mistake this saves. */}
          {duplicates.length > 0 && (
            <div className="rounded-tile border border-warning/30 dark:border-warning-textdark/25 bg-warning-soft dark:bg-warning-softdark p-3" role="alert">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-warning-text dark:text-warning-textdark">
                <AlertTriangle size={13} aria-hidden="true" />
                Already in leads
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {duplicates.slice(0, 3).map(({ lead: other, on }) => (
                  <li key={other.id} className="flex items-center gap-2 text-[12px] text-ink-soft dark:text-ink-softdark">
                    <span className="min-w-0 truncate">
                      <strong className="font-semibold text-ink dark:text-ink-dark">{other.name}</strong>
                      {' '}· {leadStatus(other.status).label} · same {on}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenLead(other.id)}
                      className={`ml-auto flex-shrink-0 text-[12px] font-semibold underline underline-offset-2 text-warning-text dark:text-warning-textdark rounded-chip ${focusRing}`}
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="lead-ig">Instagram</label>
              <input id="lead-ig" type="text" value={d.instagram ?? ''} onChange={(e) => onSocial('instagram', e.target.value)} placeholder="@handle or link" autoComplete="off" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="lead-tt">TikTok</label>
              <input id="lead-tt" type="text" value={d.tiktok ?? ''} onChange={(e) => onSocial('tiktok', e.target.value)} placeholder="@handle or link" autoComplete="off" className={input} />
            </div>
          </div>

          <div className="flex items-start gap-6 flex-wrap">
            <div>
              <span className={label}>Status</span>
              <LeadStatusSelect
                value={d.status}
                options={statusOptions.map((s) => s.id)}
                onChange={onStatus}
                leadName={d.name || 'this lead'}
                size="md"
              />
            </div>
            <div>
              <span className={label}>Potential</span>
              <PotentialStars value={d.potential} onChange={(p) => set('potential', p ?? undefined)} size={18} />
            </div>
          </div>

          {d.status === 'denied' && (
            <div>
              <label className={label} htmlFor="lead-reason">Why not</label>
              <select
                id="lead-reason"
                value={d.lostReason ?? 'not-interested'}
                onChange={(e) => set('lostReason', e.target.value as LeadLostReason)}
                className={input}
              >
                {LOST_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={label} htmlFor="lead-note">
              Note <span className={labelAside}>(what kind of lead this is)</span>
            </label>
            <textarea
              id="lead-note"
              value={d.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Bakery in Jhamsikhel, posts rarely. Owner liked our reels, no budget until Dashain."
              rows={3}
              className={textarea}
            />
          </div>

          <div>
            <span className={label}>Follow up</span>
            <div className="flex flex-wrap gap-1.5">
              {FOLLOW_UP_PRESETS.map((p) => {
                const day = p.day(today);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => set('followUpOn', d.followUpOn === day ? undefined : day)}
                    aria-pressed={d.followUpOn === day}
                    className={chip(d.followUpOn === day)}
                  >
                    {p.label}
                  </button>
                );
              })}
              <input
                type="date"
                value={d.followUpOn ?? ''}
                onChange={(e) => set('followUpOn', e.target.value || undefined)}
                aria-label="Follow-up day"
                className={`${input} !w-auto !py-1.5 !text-[12px]`}
              />
            </div>
            {d.followUpOn && (
              <p className={hint}>
                Shows under Follow up {followUpLabel(d.followUpOn, today).toLowerCase() === 'today' ? 'today' : `on ${followUpLabel(d.followUpOn, today)}`}.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            className={`self-start inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark rounded-chip ${focusRing}`}
          >
            <ChevronDown size={13} className={`transition-transform ${more ? 'rotate-180' : ''}`} aria-hidden="true" />
            {more ? 'Fewer details' : 'Contact, where found and more'}
          </button>

          {more && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <span className={label}>Found on</span>
                <div className="flex flex-wrap gap-1.5">
                  {LEAD_SOURCES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => set('source', s.id)}
                      aria-pressed={d.source === s.id}
                      className={chip(d.source === s.id)}
                    >
                      <SourceIcon source={s.id} size={13} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="lead-phone">Phone</label>
                  <input id="lead-phone" type="tel" value={d.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="98XXXXXXXX" className={input} />
                  <label className={`mt-1.5 inline-flex items-center gap-2 text-[12px] ${faintText}`}>
                    <input type="checkbox" checked={!!d.whatsapp} onChange={(e) => set('whatsapp', e.target.checked)} className="w-4 h-4 accent-success" />
                    On WhatsApp
                  </label>
                </div>
                <div>
                  <label className={label} htmlFor="lead-email">Email</label>
                  <input id="lead-email" type="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="name@business.com" className={input} />
                </div>
                <div>
                  <label className={label} htmlFor="lead-contact">
                    Contact person <span className={labelAside}>(optional)</span>
                  </label>
                  <input id="lead-contact" type="text" value={d.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} placeholder="Who you spoke to" className={input} />
                </div>
                <div>
                  <label className={label} htmlFor="lead-industry">Industry</label>
                  <input id="lead-industry" type="text" list="lead-industries" value={d.industry ?? ''} onChange={(e) => set('industry', e.target.value)} placeholder="Cafe, clothing, clinic…" className={input} />
                  <datalist id="lead-industries">
                    {industries.map((i) => <option key={i} value={i} />)}
                  </datalist>
                </div>
                <div>
                  <label className={label} htmlFor="lead-location">Location</label>
                  <input id="lead-location" type="text" value={d.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="Jhamsikhel, Lalitpur" className={input} />
                </div>
                <div>
                  <label className={label} htmlFor="lead-fb">Facebook</label>
                  <input id="lead-fb" type="text" value={d.facebook ?? ''} onChange={(e) => onSocial('facebook', e.target.value)} placeholder="Page name or link" autoComplete="off" className={input} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="lead-web">Website</label>
                  <input id="lead-web" type="text" value={d.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="business.com.np" autoComplete="off" className={input} />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} sm:flex-1`}>
              {savedCount > 0 ? 'Done' : 'Cancel'}
            </button>
            {!editing && (
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={!d.name.trim() || saving}
                className={`${btnGhost} sm:flex-1 whitespace-nowrap disabled:opacity-40`}
                title="Save this lead and start the next one"
              >
                Add another
              </button>
            )}
            <button type="submit" disabled={!d.name.trim() || saving} className={`${btnPrimary} sm:flex-1`}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

