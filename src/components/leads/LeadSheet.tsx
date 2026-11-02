import { useState } from 'react';
import {
  X, Pencil, Trash2, Instagram, Facebook, Globe, MessageCircle, Phone, Mail, ArrowRight,
  Handshake, Send,
} from 'lucide-react';
import { Lead, LeadLostReason, LeadPotential, LeadStatus } from '../../types';
import { useLeadActivity } from '../../store';
import {
  ago, followUpLabel, leadStatus, lostReasonLabel, primaryHandle, profileUrl, sourceLabel,
  telUrl, websiteUrl, whatsappUrl,
} from '../../leads';
import { runWrite } from '../../utils';
import { FollowUpPicker, LeadStatusSelect, PotentialStars, SourceIcon } from './LeadBits';
import {
  sheetOverlay, sheetPanel, btnIcon, btnIconDanger, btnGhostSm, btnGhost, btnSuccess, heading,
  bodyText, faintText, readout, sectionLabel, textarea, btnPrimarySm, focusRing,
} from '../../ui';

interface Props {
  lead: Lead;
  today: string;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onStatus: (status: LeadStatus) => void;
  onPotential: (p: LeadPotential | null) => void;
  onFollowUp: (day: string | null) => void;
  onNote: (body: string) => Promise<void>;
  onOnboard: () => void;
  onOpenClient: (clientId: string) => void;
  onDelete: () => void;
}

// TikTok has no lucide mark; SourceIcon draws it.
const TikTok = () => <SourceIcon source="tiktok" size={13} />;

// Everything about one lead on one sheet: who they are, how to reach them in
// one tap, where they stand, and what has been said so far, newest first.
export default function LeadSheet({
  lead, today, canDelete, onClose, onEdit, onStatus, onPotential, onFollowUp, onNote,
  onOnboard, onOpenClient, onDelete,
}: Props) {
  const { entries, loading } = useLeadActivity(lead.id);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const handle = primaryHandle(lead);
  const status = leadStatus(lead.status);
  const now = Date.now();

  const contacts = [
    lead.instagram && { href: profileUrl('instagram', lead.instagram), label: 'Instagram', icon: <Instagram size={13} /> },
    lead.tiktok && { href: profileUrl('tiktok', lead.tiktok), label: 'TikTok', icon: <TikTok /> },
    lead.facebook && { href: profileUrl('facebook', lead.facebook), label: 'Facebook', icon: <Facebook size={13} /> },
    lead.website && { href: websiteUrl(lead.website), label: 'Website', icon: <Globe size={13} /> },
    lead.phone && lead.whatsapp && { href: whatsappUrl(lead.phone), label: 'WhatsApp', icon: <MessageCircle size={13} /> },
    lead.phone && { href: telUrl(lead.phone), label: lead.phone, icon: <Phone size={13} />, self: true },
    lead.email && { href: `mailto:${lead.email}`, label: lead.email, icon: <Mail size={13} />, self: true },
  ].filter(Boolean) as { href: string; label: string; icon: JSX.Element; self?: boolean }[];

  const facts = [
    lead.contactName && ['Contact', lead.contactName],
    lead.industry && ['Industry', lead.industry],
    lead.location && ['Location', lead.location],
    ['Found on', sourceLabel(lead.source)],
    ['Added', `${new Date(lead.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} by ${lead.ownerName}`],
    ['In this status', ago(lead.statusAt ?? lead.updatedAt, now).replace(' ago', '')],
  ].filter(Boolean) as [string, string][];

  async function send() {
    const body = note.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await runWrite(() => onNote(body), 'save the note');
    setSending(false);
    if (ok) setNote('');
  }

  return (
    <div className={sheetOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={sheetPanel} role="dialog" aria-modal="true" aria-labelledby="lead-sheet-title">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="w-10 h-10 rounded-tile bg-tint dark:bg-tint-dark border border-hairline dark:border-hairline-dark flex items-center justify-center text-ink-soft dark:text-ink-softdark flex-shrink-0">
            <SourceIcon source={lead.source} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="lead-sheet-title" className={`${heading} text-base truncate`}>{lead.name}</h2>
            <p className={`text-[12px] truncate ${faintText}`}>
              {[handle && `@${handle.handle}`, lead.industry, lead.location].filter(Boolean).join(' · ') || sourceLabel(lead.source)}
            </p>
          </div>
          <button onClick={onEdit} className={btnIcon} aria-label="Edit lead" title="Edit">
            <Pencil size={15} />
          </button>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-4">
          {/* Where it stands, changeable in place. */}
          <div className="flex items-center gap-2 flex-wrap">
            <LeadStatusSelect value={lead.status} onChange={onStatus} leadName={lead.name} size="md" />
            <PotentialStars value={lead.potential} onChange={onPotential} size={17} />
            {status.group !== 'closed' && (
              <FollowUpPicker
                status={lead.status}
                value={lead.followUpOn}
                today={today}
                onChange={onFollowUp}
                leadName={lead.name}
              />
            )}
          </div>

          {lead.status === 'denied' && lead.lostReason && (
            <p className={`text-[12px] ${bodyText}`}>
              Said no: <strong className="font-semibold">{lostReasonLabel(lead.lostReason as LeadLostReason)}</strong>
            </p>
          )}

          {lead.status === 'onboarded' && lead.clientId && (
            <button
              onClick={() => onOpenClient(lead.clientId!)}
              className={`flex items-center gap-2 w-full p-3 rounded-tile bg-success-soft dark:bg-success-softdark border border-success/25 text-left text-[13px] font-semibold text-success-text dark:text-success-textdark ${focusRing}`}
            >
              <Handshake size={15} aria-hidden="true" />
              A client now. Open their board
              <ArrowRight size={14} className="ml-auto" aria-hidden="true" />
            </button>
          )}

          {contacts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {contacts.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target={c.self ? undefined : '_blank'}
                  rel={c.self ? undefined : 'noopener noreferrer'}
                  className={`${btnGhostSm} max-w-full`}
                >
                  {c.icon}
                  <span className="truncate">{c.label}</span>
                </a>
              ))}
            </div>
          )}

          <div>
            <p className={`${sectionLabel} mb-1.5`}>Note</p>
            {lead.note ? (
              <p className={readout}>{lead.note}</p>
            ) : (
              <button onClick={onEdit} className={`text-[13px] ${faintText} hover:text-ink dark:hover:text-ink-dark rounded-chip ${focusRing}`}>
                No note yet. Add one so anyone can tell what kind of lead this is.
              </button>
            )}
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className={faintText}>{k}</dt>
                <dd className={`${bodyText} min-w-0 truncate`}>{v}</dd>
              </div>
            ))}
            {lead.followUpOn && status.group !== 'closed' && (
              <div className="contents">
                <dt className={faintText}>Follow up</dt>
                <dd className={bodyText}>{followUpLabel(lead.followUpOn, today)}</dd>
              </div>
            )}
          </dl>

          {/* History: what was said and every status move. */}
          <div className="pt-3 border-t border-hairline dark:border-hairline-dark">
            <p className={`${sectionLabel} mb-2`}>History</p>
            <div className="flex gap-2 mb-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
                }}
                placeholder="What happened? e.g. Called, asked to message after Tihar."
                rows={2}
                aria-label="Add to the history"
                className={`${textarea} text-[13px]`}
              />
              <button
                onClick={send}
                disabled={!note.trim() || sending}
                className={`${btnPrimarySm} self-end`}
                aria-label="Add to history"
              >
                <Send size={13} />
              </button>
            </div>
            {loading ? (
              <p className={`text-[12px] ${faintText}`}>Loading…</p>
            ) : entries.length === 0 ? (
              <p className={`text-[12px] ${faintText}`}>Nothing yet.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {entries.map((e) =>
                  e.kind === 'system' ? (
                    <li key={e.id} className={`text-[12px] ${faintText}`}>
                      <span className="font-medium text-ink-soft dark:text-ink-softdark">{e.authorName}</span>{' '}
                      {e.body} · {ago(e.createdAt, now)}
                    </li>
                  ) : (
                    <li key={e.id} className="rounded-tile bg-tint dark:bg-tint-dark border border-hairline dark:border-hairline-dark px-3 py-2">
                      <p className={`text-[11px] ${faintText}`}>
                        <span className="font-semibold text-ink-soft dark:text-ink-softdark">{e.authorName}</span> · {ago(e.createdAt, now)}
                      </p>
                      <p className={`text-[13px] whitespace-pre-wrap mt-0.5 ${bodyText}`}>{e.body}</p>
                    </li>
                  )
                )}
              </ol>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {lead.status !== 'onboarded' && (
              <button onClick={onOnboard} className={`${btnSuccess} flex-1`}>
                <Handshake size={15} />
                Onboard as client
              </button>
            )}
            <button onClick={onEdit} className={`${btnGhost} ${lead.status === 'onboarded' ? 'flex-1' : ''}`}>
              <Pencil size={14} />
              Edit
            </button>
            {canDelete && (
              <button onClick={onDelete} className={`${btnIconDanger} !w-11 !h-11`} aria-label="Delete lead" title="Delete">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
