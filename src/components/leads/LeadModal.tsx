import { useMemo, useRef, useState } from 'react';
import { X, AlertTriangle, ChevronDown } from '../../icons';
import { Lead, LeadDraft, LeadLostReason, LeadSource, LeadStatus } from '../../types';
import {
  FOLLOW_UP_PRESETS, LEAD_SOURCES, LEAD_STATUSES, LOST_REASONS, findDuplicates, followUpLabel,
  leadStatus, nameFromHandle, parseProfileInput, profileUrl, primaryHandle, socialLinkLabel,
  type SocialField,
} from '../../leads';
import { parseLeadText, type LeadPaste } from '../../leadPaste';
import {
  PHONE_COUNTRIES, phoneCountry, parseStoredPhone, phoneValue, typedDigits, formatNational,
  type PhoneCountry,
} from '../../phone';
import { LeadStatusSelect, PotentialStars } from './LeadBits';
import {
  sheetOverlay, sheetPanel, modalTitle, btnIcon, label, labelAside, input, textarea, btnPrimary,
  btnGhost, chip, hint, focusRing,
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
  name: '', source: 'other', status: 'approached', note: '',
};

// The country picked last time, so a team working Nepali numbers switches
// once, not on every lead.
const COUNTRY_KEY = 'limi:lead-phone-country';

function rememberedCountry(): PhoneCountry {
  try {
    return phoneCountry(localStorage.getItem(COUNTRY_KEY) ?? undefined);
  } catch {
    return phoneCountry(undefined);
  }
}

function rememberCountry(c: PhoneCountry) {
  try {
    localStorage.setItem(COUNTRY_KEY, c.id);
  } catch {
    // Private mode or a full quota: the next form starts at the default.
  }
}

function draftOf(lead?: Lead): LeadDraft {
  if (!lead) return { ...EMPTY };
  const { id, ownerEmail, ownerName, createdAt, updatedAt, statusAt, clientId, ...draft } = lead;
  void id; void ownerEmail; void ownerName; void createdAt; void updatedAt; void statusAt; void clientId;
  // A lead saved with only a client name carries it as its name too; the
  // form shows that as a client name with no business.
  if (draft.contactName && draft.name === draft.contactName) draft.name = '';
  return draft;
}

const PLATFORM: Record<SocialField, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

/**
 * What the one social link field holds: an Instagram, TikTok or Facebook
 * profile (link or @handle) goes in that platform's own field, so the list
 * icons and the duplicate check keep working; any other link is kept as is.
 */
function readSocial(raw: string): { field: SocialField; handle: string } | { social: string } | null {
  const value = raw.trim();
  if (!value) return null;
  const isLink = /[./]/.test(value) && /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}/i.test(value);
  if (!isLink || /(instagram|tiktok|facebook|fb)\./i.test(value)) {
    const parsed = parseProfileInput(value.includes('/') || !isLink ? value : `${value}/`);
    if (parsed) return parsed;
  }
  return isLink ? { social: value } : null;
}

/** The link the field starts with when editing: the other link, else the main profile. */
function socialOf(lead?: Lead): string {
  if (!lead) return '';
  if (lead.social) return lead.social;
  const main = primaryHandle(lead);
  return main ? profileUrl(main.field, lead[main.field]) : '';
}

const PASTE_WORDS: Partial<Record<keyof LeadPaste, string>> = {
  phone: 'phone', email: 'email', website: 'website', instagram: 'Instagram', tiktok: 'TikTok',
  facebook: 'Facebook', location: 'location',
};

// One short form for adding and editing: who (a client name, a business name,
// or both), how to reach them (one phone/WhatsApp number, email, website),
// a note and the status. That is all a new lead needs; stars and follow-ups
// are set from the list. Editing adds a folded section for the rest, so
// nothing an older lead holds becomes uneditable.
export default function LeadModal({ lead, leads, today, onClose, onSave, onOpenLead }: Props) {
  const editing = !!lead;
  const [d, setD] = useState<LeadDraft>(() => draftOf(lead));
  const [phone, setPhone] = useState(() => parseStoredPhone(lead?.phone, rememberedCountry()));
  // An older number is rewritten in the new format only once it is edited,
  // so an untouched landline is never reread as a US number.
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [socialText, setSocialText] = useState(() => socialOf(lead));
  const [socialTouched, setSocialTouched] = useState(false);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filled, setFilled] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const who = d.name.trim() || (d.contactName ?? '').trim();
  const socialRead = useMemo(() => readSocial(socialText), [socialText]);
  const final: LeadDraft = useMemo(() => {
    const out: LeadDraft = { ...d, name: who };
    if (socialTouched) {
      if (!socialRead) {
        // Cleared: drop what the field was showing.
        out.social = undefined;
        const main = lead && !lead.social ? primaryHandle(lead) : null;
        if (main) out[main.field] = undefined;
      } else if ('social' in socialRead) {
        out.social = socialRead.social;
      } else {
        out[socialRead.field] = socialRead.handle;
        if (!editing && out.source === 'other') out.source = socialRead.field as LeadSource;
      }
    }
    if (phoneTouched || !editing) {
      out.phone = phoneValue(phone.country, phone.digits) || undefined;
      // One field for phone and WhatsApp: a number given here gets both links.
      if (out.phone) out.whatsapp = true;
    }
    return out;
  }, [d, who, phone, phoneTouched, editing, socialRead, socialTouched, lead]);

  const duplicates = useMemo(() => findDuplicates(final, leads, lead?.id), [final, leads, lead?.id]);
  const industries = useMemo(
    () => [...new Set(leads.map((l) => l.industry?.trim()).filter(Boolean))].sort() as string[],
    [leads]
  );

  function setPhoneText(raw: string) {
    setPhoneTouched(true);
    // A number typed or pasted with its own country code picks that country.
    const country = raw.trim().startsWith('+') ? parseStoredPhone(raw, phone.country).country : phone.country;
    setPhone({ country, digits: typedDigits(country, raw) });
  }

  function setCountry(id: string) {
    const country = phoneCountry(id);
    rememberCountry(country);
    setPhoneTouched(true);
    setPhone((p) => ({ country, digits: typedDigits(country, p.digits) }));
  }

  // A profile link typed or pasted into a name names the business after the
  // handle and keeps the handle, as the form always has.
  function routeProfile(raw: string): boolean {
    if (!/[./]/.test(raw) || !/(instagram|tiktok|facebook|fb)\./i.test(raw)) return false;
    const parsed = parseProfileInput(raw);
    if (!parsed) return false;
    setD((prev) => ({
      ...prev,
      [parsed.field]: parsed.handle,
      name: nameFromHandle(parsed.handle),
      ...(!editing ? { source: parsed.field as LeadSource } : {}),
    }));
    if (!socialText.trim()) setSocialText(profileUrl(parsed.field, parsed.handle));
    return true;
  }

  // A whole paste (a copied bio, a business card line, "name - number") fills
  // every field it names. Fields already typed are kept.
  function onNamePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const p = parseLeadText(e.clipboardData.getData('text'));
    const found = (Object.keys(PASTE_WORDS) as (keyof LeadPaste)[]).filter((k) => p[k]);
    if (!found.length) return;
    e.preventDefault();
    setD((prev) => {
      const next = { ...prev };
      for (const k of found) {
        if (k === 'phone') continue;
        if (!String(prev[k] ?? '').trim()) (next as Record<string, unknown>)[k] = p[k];
      }
      if (p.name && !prev.name.trim()) next.name = p.name;
      if (p.source && !editing) next.source = p.source;
      return next;
    });
    if (p.phone && !phone.digits) {
      const country = p.phone.startsWith('+') ? parseStoredPhone(p.phone, phone.country).country : phone.country;
      setPhoneTouched(true);
      setPhone({ country, digits: typedDigits(country, p.phone) });
    }
    const firstSocial = (['instagram', 'tiktok', 'facebook'] as SocialField[]).find((f) => p[f]);
    if (firstSocial && !socialText.trim()) setSocialText(profileUrl(firstSocial, p[firstSocial]));
    setFilled(found.map((k) => PASTE_WORDS[k]!));
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

  async function submit() {
    setTried(true);
    if (!who || saving) {
      if (!who) nameRef.current?.focus();
      return;
    }
    setSaving(true);
    const ok = await onSave(final);
    setSaving(false);
    if (ok) onClose();
  }

  // An older number in no known format (a landline, say) is shown as it was
  // saved until someone edits it.
  const showRawPhone = editing && !phoneTouched && !!lead?.phone
    && !lead.phone.trim().startsWith('+') && phone.country.id !== 'NP';
  const statusOptions = LEAD_STATUSES.filter((s) => s.id !== 'onboarded' || lead?.status === 'onboarded');
  const needWho = tried && !who;

  return (
    <div className={sheetOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${sheetPanel} p-5 sm:p-6`} role="dialog" aria-modal="true" aria-labelledby="lead-modal-title">
        <div className="flex items-center justify-between mb-4">
          <h2 id="lead-modal-title" className={modalTitle}>{editing ? 'Edit lead' : 'New lead'}</h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="lead-contact">Client name</label>
                <input
                  id="lead-contact"
                  type="text"
                  value={d.contactName ?? ''}
                  onChange={(e) => set('contactName', e.target.value)}
                  onPaste={onNamePaste}
                  placeholder="Person you're talking to"
                  autoFocus
                  autoComplete="off"
                  aria-invalid={needWho || undefined}
                  aria-describedby="lead-who-hint"
                  className={input}
                />
              </div>
              <div>
                <label className={label} htmlFor="lead-name">Business name</label>
                <input
                  id="lead-name"
                  ref={nameRef}
                  type="text"
                  value={d.name}
                  onChange={(e) => { if (!routeProfile(e.target.value)) set('name', e.target.value); }}
                  onPaste={onNamePaste}
                  placeholder="Business, or paste a link"
                  autoComplete="off"
                  aria-invalid={needWho || undefined}
                  aria-describedby="lead-who-hint"
                  className={input}
                />
              </div>
            </div>
            <p id="lead-who-hint" className={needWho ? `${hint} !text-brand-text dark:!text-brand-textdark` : hint}>
              {needWho ? 'Add a client name or a business name.' : 'Either one is enough.'}
              {filled.length > 0 && <span aria-live="polite"> Filled in from the paste: {filled.join(', ')}.</span>}
            </p>
          </div>

          {/* Duplicates show as soon as they match: approaching a business twice,
              or one that already said no, is the mistake this saves. */}
          {duplicates.length > 0 && (
            <div className="rounded-card bg-warning-soft dark:bg-warning-softdark p-3" role="alert">
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

          <div>
            <label className={label} htmlFor="lead-phone">Phone / WhatsApp</label>
            <div className="flex gap-2">
              <select
                value={phone.country.id}
                onChange={(e) => setCountry(e.target.value)}
                aria-label="Country code"
                className={`${input} !w-auto flex-shrink-0 !pr-2`}
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label} +{c.code}</option>
                ))}
              </select>
              <input
                id="lead-phone"
                type="tel"
                inputMode="tel"
                value={showRawPhone ? lead!.phone : formatNational(phone.country, phone.digits)}
                onChange={(e) => setPhoneText(e.target.value)}
                placeholder={formatNational(phone.country, phone.country.example)}
                autoComplete="off"
                className={`${input} min-w-0`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="lead-email">Email</label>
              <input id="lead-email" type="email" inputMode="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="name@business.com" autoComplete="off" className={input} />
            </div>
            <div>
              <label className={label} htmlFor="lead-web">Website</label>
              <input id="lead-web" type="text" inputMode="url" value={d.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="business.com" autoComplete="off" className={input} />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="lead-social">Social media link</label>
            <input
              id="lead-social"
              type="text"
              inputMode="url"
              value={socialText}
              onChange={(e) => { setSocialText(e.target.value); setSocialTouched(true); }}
              placeholder="Instagram, TikTok, LinkedIn… link"
              autoComplete="off"
              aria-describedby={socialRead ? 'lead-social-hint' : undefined}
              className={input}
            />
            {socialRead && (
              <p id="lead-social-hint" className={hint}>
                {'social' in socialRead
                  ? `Saved as ${socialLinkLabel(socialRead.social) === 'Profile' ? 'a profile' : `a ${socialLinkLabel(socialRead.social)}`} link.`
                  : `Saved as ${PLATFORM[socialRead.field]} @${socialRead.handle}.`}
              </p>
            )}
          </div>

          <div>
            <label className={label} htmlFor="lead-note">Notes</label>
            <textarea
              id="lead-note"
              value={d.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="What they do, what they need, what was said."
              rows={3}
              className={textarea}
            />
          </div>

          <div className="flex items-start gap-4 flex-wrap">
            <div>
              <span className={label}>Status</span>
              <LeadStatusSelect
                value={d.status}
                options={statusOptions.map((s) => s.id)}
                onChange={onStatus}
                leadName={who || 'this lead'}
                size="md"
              />
            </div>
            {d.status === 'denied' && (
              <div className="flex-1 min-w-[12rem]">
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
          </div>

          {editing && (
            <>
              <button
                type="button"
                onClick={() => setMore((m) => !m)}
                aria-expanded={more}
                className={`self-start inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark rounded-chip ${focusRing}`}
              >
                <ChevronDown size={13} className={`transition-transform ${more ? 'rotate-180' : ''}`} aria-hidden="true" />
                {more ? 'Fewer details' : 'Social profiles, follow-up and more'}
              </button>
              {more && <MoreFields d={d} set={set} today={today} industries={industries} />}
            </>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} sm:flex-1`}>Cancel</button>
            <button type="submit" disabled={saving} className={`${btnPrimary} sm:flex-1`}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface MoreProps {
  d: LeadDraft;
  set: <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) => void;
  today: string;
  industries: string[];
}

// What an older or well-worked lead may also hold. Only in the edit form.
function MoreFields({ d, set, today, industries }: MoreProps) {
  const social = (field: SocialField, value: string) => {
    // A link pasted into the wrong platform's field goes to the right one.
    const parsed = /(instagram|tiktok|facebook|fb)\./i.test(value) ? parseProfileInput(value) : null;
    if (parsed && parsed.field !== field) {
      set(parsed.field, parsed.handle);
      set(field, '');
    } else {
      set(field, value);
    }
  };
  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor="lead-ig">Instagram</label>
          <input id="lead-ig" type="text" value={d.instagram ?? ''} onChange={(e) => social('instagram', e.target.value)} placeholder="@handle or link" autoComplete="off" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="lead-tt">TikTok</label>
          <input id="lead-tt" type="text" value={d.tiktok ?? ''} onChange={(e) => social('tiktok', e.target.value)} placeholder="@handle or link" autoComplete="off" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="lead-fb">Facebook</label>
          <input id="lead-fb" type="text" value={d.facebook ?? ''} onChange={(e) => social('facebook', e.target.value)} placeholder="Page name or link" autoComplete="off" className={input} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor="lead-source">Found on</label>
          <select id="lead-source" value={d.source} onChange={(e) => set('source', e.target.value as LeadSource)} className={input}>
            {LEAD_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="lead-industry">Industry</label>
          <input id="lead-industry" type="text" list="lead-industries" value={d.industry ?? ''} onChange={(e) => set('industry', e.target.value)} placeholder="Cafe, clinic…" className={input} />
          <datalist id="lead-industries">
            {industries.map((i) => <option key={i} value={i} />)}
          </datalist>
        </div>
        <div>
          <label className={label} htmlFor="lead-location">Location</label>
          <input id="lead-location" type="text" value={d.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="City" className={input} />
        </div>
      </div>
      <div>
        <span className={label}>Potential</span>
        <PotentialStars value={d.potential} onChange={(p) => set('potential', p ?? undefined)} size={18} />
      </div>
      <div>
        <span className={label}>Follow up <span className={labelAside}>(optional)</span></span>
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
    </div>
  );
}
