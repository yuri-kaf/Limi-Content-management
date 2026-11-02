import { useState } from 'react';
import { X, PartyPopper, ArrowRight } from 'lucide-react';
import { Client, FolderColor, Lead, LeadLostReason } from '../../types';
import { LOST_REASONS, sourceLabel } from '../../leads';
import { folderColor } from '../../folderColors';
import ColorSwatchPicker from '../ColorSwatchPicker';
import FolderIcon from '../FolderIcon';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, input, textarea, btnPrimary, btnGhost,
  btnSuccessSolid, chip, bodyText, faintText, focusRing,
} from '../../ui';

// ─── Onboard ─────────────────────────────────────────────────────────────────

type OnboardTarget = { clientId: string } | { client: { name: string; about: string; color: FolderColor } };

interface OnboardProps {
  lead: Lead;
  clients: Client[];
  onClose: () => void;
  /** Resolves the client's id, or null when the write failed. */
  onConfirm: (target: OnboardTarget) => Promise<string | null>;
  onOpenClient: (clientId: string) => void;
}

// What the client's About starts as: the lead's note plus the facts a team
// member opening the new board would want, so nothing typed on the lead is
// lost in the move.
function aboutFrom(lead: Lead): string {
  const facts = [
    lead.industry,
    lead.location,
    lead.contactName ? `Contact: ${lead.contactName}` : '',
    lead.phone ? `Phone: ${lead.phone}` : '',
    `Found on ${sourceLabel(lead.source)}`,
  ].filter(Boolean);
  return [lead.note.trim(), facts.join(' · ')].filter(Boolean).join('\n\n');
}

export function OnboardDialog({ lead, clients, onClose, onConfirm, onOpenClient }: OnboardProps) {
  const existing = clients.find((c) => c.name.trim().toLowerCase() === lead.name.trim().toLowerCase());
  const [mode, setMode] = useState<'new' | 'link'>(existing ? 'link' : 'new');
  const [name, setName] = useState(lead.name);
  const [about, setAbout] = useState(() => aboutFrom(lead));
  const [color, setColor] = useState<FolderColor>(folderColor(undefined).id);
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  async function confirm() {
    if (busy || (mode === 'new' && !name.trim())) return;
    setBusy(true);
    const id = await onConfirm(
      mode === 'link' && existing
        ? { clientId: existing.id }
        : { client: { name: name.trim(), about: about.trim(), color } }
    );
    setBusy(false);
    if (id) setDoneId(id);
  }

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalPanel} role="dialog" aria-modal="true" aria-labelledby="onboard-title">
        <div className="flex items-center justify-between mb-4">
          <h2 id="onboard-title" className={modalTitle}>
            {doneId ? 'Onboarded' : `Onboard ${lead.name}`}
          </h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {doneId ? (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="w-12 h-12 rounded-full bg-success-soft dark:bg-success-softdark flex items-center justify-center">
              <PartyPopper size={22} className="text-success-text dark:text-success-textdark" />
            </div>
            <p className={`text-sm ${bodyText}`}>
              {mode === 'link' && existing ? existing.name : name} is on the client board now. The lead
              stays here, marked Onboarded.
            </p>
            <div className="flex gap-3 w-full pt-1">
              <button onClick={onClose} className={`${btnGhost} flex-1`}>Back to leads</button>
              <button onClick={() => onOpenClient(doneId)} className={`${btnPrimary} flex-1`}>
                Open board <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className={`text-[13px] leading-relaxed ${bodyText}`}>
              This adds them to Clients with a content board of their own. The lead stays in Leads,
              marked Onboarded, with its history.
            </p>

            {existing && (
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Which client">
                <button type="button" role="radio" aria-checked={mode === 'link'} onClick={() => setMode('link')} className={`${chip(mode === 'link')} !justify-start`}>
                  <FolderIcon color={existing.color} size={16} label={existing.name} />
                  Link to {existing.name}, already a client
                </button>
                <button type="button" role="radio" aria-checked={mode === 'new'} onClick={() => setMode('new')} className={`${chip(mode === 'new')} !justify-start`}>
                  Create a new client
                </button>
              </div>
            )}

            {mode === 'new' && (
              <>
                <div>
                  <label className={label} htmlFor="onboard-name">Client name</label>
                  <input id="onboard-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={input} required />
                </div>
                <div>
                  <span className={label}>Folder colour</span>
                  <div className="flex items-center gap-3">
                    <FolderIcon color={color} size={44} label={name} />
                    <div className="flex-1 min-w-0 max-w-[172px]">
                      <ColorSwatchPicker value={color} onChange={setColor} label="Folder colour" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={label} htmlFor="onboard-about">About</label>
                  <textarea id="onboard-about" value={about} onChange={(e) => setAbout(e.target.value)} rows={4} className={textarea} />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>Cancel</button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy || (mode === 'new' && !name.trim())}
                className={`${btnSuccessSolid} flex-1`}
              >
                {busy ? 'Onboarding…' : mode === 'link' ? 'Link and onboard' : 'Create client'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Deny ────────────────────────────────────────────────────────────────────

interface DenyProps {
  lead: Lead;
  onClose: () => void;
  onConfirm: (reason: LeadLostReason) => void;
}

// One tap for the reason. Reasons are what tell the team, months later,
// whether a no was about money, timing or fit, and whether to try again.
export function DenyDialog({ lead, onClose, onConfirm }: DenyProps) {
  const [reason, setReason] = useState<LeadLostReason>(lead.lostReason ?? 'not-interested');
  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalPanel} role="dialog" aria-modal="true" aria-labelledby="deny-title">
        <div className="flex items-center justify-between mb-3">
          <h2 id="deny-title" className={modalTitle}>Why did {lead.name} say no?</h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className={`text-[12px] mb-3 ${faintText}`}>
          The lead is kept under Denied, so nobody approaches them again by mistake.
        </p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Reason">
          {LOST_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={reason === r.id}
              onClick={() => setReason(r.id)}
              onDoubleClick={() => onConfirm(r.id)}
              className={chip(reason === r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 pt-5">
          <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>Cancel</button>
          <button type="button" onClick={() => onConfirm(reason)} className={`${btnPrimary} flex-1 ${focusRing}`}>
            Mark denied
          </button>
        </div>
      </div>
    </div>
  );
}
