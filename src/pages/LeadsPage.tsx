import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Target, X, ExternalLink, MessageCircle } from 'lucide-react';
import { Lead, LeadLostReason, LeadPotential, LeadSource, LeadStatus } from '../types';
import { useClients, useLeads } from '../store';
import { useAuth } from '../contexts/AuthContext';
import {
  LEAD_SORTS, LEAD_SOURCES, LEAD_STATUSES, LEAD_VIEWS, ago, dayOf, inView, isDue, leadStatus,
  matchesQuery, primaryHandle, profileUrl, sortLeads, whatsappUrl, addMonths,
  type LeadSort, type LeadView,
} from '../leads';
import { runWrite } from '../utils';
import ToolbarSelect from '../components/ToolbarSelect';
import LeadModal from '../components/leads/LeadModal';
import LeadSheet from '../components/leads/LeadSheet';
import { DenyDialog, OnboardDialog } from '../components/leads/LeadDialogs';
import {
  FollowUpPicker, LeadStatusSelect, PotentialStars, SourceIcon,
} from '../components/leads/LeadBits';
import {
  shellPad, heading, faintText, bodyText, btnPrimarySm, btnGhostSm, btnIcon, segmented, segItem,
  rowList, emptyState, emptyTitle, emptyBody, card, scopeChip, focusRing, focusRingInset,
} from '../ui';

const PAGE = 100;

type PotentialFilter = 'any' | '3' | '2+' | 'unrated';

// What the empty list says, per tab: each one explains what belongs there.
const EMPTY: Record<LeadView, { title: string; body: string }> = {
  active: {
    title: 'No leads in progress',
    body: 'Add each business you message, and star the ones worth chasing. The best rise to the top.',
  },
  'follow-up': {
    title: 'Nothing to follow up today',
    body: 'Leads with a follow-up date land here on the day, and stay until you move them on.',
  },
  parked: {
    title: 'Nobody parked',
    body: 'A good fit who is not ready yet goes to Not now, with a date to try again.',
  },
  onboarded: {
    title: 'No one onboarded yet',
    body: 'Onboarding a lead makes them a client, with a content board of their own.',
  },
  denied: {
    title: 'No denied leads',
    body: 'When a business says no it is kept here with the reason, so nobody asks twice.',
  },
  all: { title: 'No leads yet', body: 'Add the first business you have reached out to.' },
};

// The salesperson's desk. One list, cut into tabs by where each lead stands,
// ranked best first, with every common change (status, stars, follow-up) made
// in the row itself. Denied and onboarded leads are never deleted, only moved
// to tabs of their own, so the working list stays short while the history
// stays one tap away.
export default function LeadsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { clients } = useClients();
  const {
    leads, loading, addLead, updateLead, setLeadStatus, setLeadPotential, setLeadFollowUp,
    addLeadNote, onboardLead, bulkSetLeadStatus, deleteLead,
  } = useLeads();

  const view = (LEAD_VIEWS.some((v) => v.id === params.get('view')) ? params.get('view') : 'active') as LeadView;
  const openId = params.get('lead');

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [source, setSource] = useState<LeadSource | 'all'>('all');
  const [potential, setPotential] = useState<PotentialFilter>('any');
  const [owner, setOwner] = useState<string>('all');
  const [sort, setSort] = useState<LeadSort>('best');
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ mode: 'new' } | { mode: 'edit'; lead: Lead } | null>(null);
  const [onboarding, setOnboarding] = useState<Lead | null>(null);
  const [denying, setDenying] = useState<Lead | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const now = Date.now();
  const today = dayOf(now);
  const isAdmin = currentUser?.role === 'admin';

  // A new day changes what is due; the date is read on render, and this
  // re-renders at midnight-ish by ticking once a minute.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  function setView(next: LeadView) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (next === 'active') n.delete('view');
      else n.set('view', next);
      return n;
    }, { replace: true });
    setStatusFilter('all');
    setSelected(new Set());
    setLimit(PAGE);
  }

  // The open lead lives in the URL, so Back closes the sheet on a phone and a
  // link to one lead can be shared with the team.
  function openLead(id: string | null) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (id) n.set('lead', id);
      else n.delete('lead');
      return n;
    }, { replace: !id ? true : !!openId });
  }

  // "/" searches and "n" adds, as in Linear, when not typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'n') {
        e.preventDefault();
        setModal({ mode: 'new' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((l) => map.set(l.ownerEmail, l.ownerName));
    return [...map.entries()];
  }, [leads]);

  const counts = useMemo(() => {
    const c = {} as Record<LeadView, number>;
    LEAD_VIEWS.forEach((v) => { c[v.id] = leads.filter((l) => inView(l, v.id, today)).length; });
    return c;
  }, [leads, today]);

  // Everything but the status chip, so the chips can count within it.
  const filteredBase = useMemo(
    () =>
      leads.filter(
        (l) =>
          inView(l, view, today) &&
          matchesQuery(l, query) &&
          (source === 'all' || l.source === source) &&
          (owner === 'all' || l.ownerEmail === owner) &&
          (potential === 'any' ||
            (potential === '3' && l.potential === 3) ||
            (potential === '2+' && (l.potential ?? 0) >= 2) ||
            (potential === 'unrated' && !l.potential))
      ),
    [leads, view, today, query, source, owner, potential]
  );

  const visible = useMemo(
    () =>
      sortLeads(
        filteredBase.filter((l) => statusFilter === 'all' || l.status === statusFilter),
        sort,
        today
      ),
    [filteredBase, statusFilter, sort, today]
  );

  // The statuses inside this tab, as filter chips with counts. Only where a tab
  // holds more than one status.
  const chipStatuses =
    view === 'active' || view === 'parked'
      ? LEAD_STATUSES.filter((s) => s.group === view)
      : view === 'follow-up' || view === 'all'
        ? LEAD_STATUSES.filter((s) => filteredBase.some((l) => l.status === s.id))
        : [];

  const filtersOn = query.trim() !== '' || source !== 'all' || potential !== 'any' || owner !== 'all' || statusFilter !== 'all';
  function clearFilters() {
    setQuery('');
    setSource('all');
    setPotential('any');
    setOwner('all');
    setStatusFilter('all');
  }

  const addedToday = leads.filter((l) => dayOf(l.createdAt) === today).length;
  const monthStart = today.slice(0, 7);
  const onboardedThisMonth = leads.filter((l) => l.status === 'onboarded' && dayOf(l.statusAt ?? l.updatedAt).startsWith(monthStart)).length;
  const dueCount = counts['follow-up'];

  const openLeadObj = openId ? leads.find((l) => l.id === openId) : undefined;

  // ── Changes ────────────────────────────────────────────────────────────────

  function changeStatus(lead: Lead, status: LeadStatus) {
    if (status === lead.status) return;
    if (status === 'onboarded') return setOnboarding(lead);
    if (status === 'denied') return setDenying(lead);
    runWrite(async () => {
      await setLeadStatus(lead, status);
      // "Not now" without a date is how a good lead gets forgotten, so it gets
      // a month by default, which the chip beside it changes in a tap.
      if (status === 'later' && !lead.followUpOn) await setLeadFollowUp(lead.id, addMonths(today, 1));
    }, 'change the status');
  }

  const changePotential = (lead: Lead, p: LeadPotential | null) =>
    runWrite(() => setLeadPotential(lead.id, p), 'rate the lead');

  const changeFollowUp = (lead: Lead, day: string | null) =>
    runWrite(() => setLeadFollowUp(lead.id, day), 'set the follow-up');

  async function bulk(status: LeadStatus) {
    const targets = leads.filter((l) => selected.has(l.id));
    const ok = await runWrite(() => bulkSetLeadStatus(targets, status), 'update the leads');
    if (ok) setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const shown = visible.slice(0, limit);
  const allShownSelected = shown.length > 0 && shown.every((l) => selected.has(l.id));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shellPad} max-w-[1240px] py-6`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className={`${heading} text-lg`}>Leads</h1>
            <p className={`text-[13px] mt-0.5 ${faintText}`}>
              {loading
                ? 'Loading…'
                : [
                    `${counts.active} in progress`,
                    dueCount > 0 && `${dueCount} to follow up`,
                    addedToday > 0 && `${addedToday} added today`,
                    onboardedThisMonth > 0 && `${onboardedThisMonth} onboarded this month`,
                  ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={() => setModal({ mode: 'new' })} className={`${btnPrimarySm} flex-shrink-0 whitespace-nowrap`} title="New lead (N)" aria-label="New lead">
            <Plus size={14} />
            <span className="hidden sm:inline">New lead</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {/* Tabs: where each lead stands. Scrolls sideways on a phone. */}
        <div className="overflow-x-auto [scrollbar-width:none] -mx-1 px-1 mb-3">
          <div className={segmented} role="tablist" aria-label="Lead views">
            {LEAD_VIEWS.map((v) => {
              const active = view === v.id;
              const urgent = v.id === 'follow-up' && counts[v.id] > 0;
              return (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(v.id)}
                  className={segItem(active)}
                >
                  {v.label}
                  <span
                    className={`tabular-nums text-[11px] font-semibold ${
                      urgent ? 'text-brand-text dark:text-brand-textdark' : faintText
                    }`}
                  >
                    {counts[v.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <label className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${faintText}`} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, @handle, phone, note"
              aria-label="Search leads"
              className={`w-full h-9 [@media(hover:none)]:h-11 pl-8 pr-3 rounded-tile bg-canvas dark:bg-canvas-dark border border-hairline dark:border-hairline-dark text-[12px] text-ink dark:text-ink-dark placeholder-ink-faint dark:placeholder-ink-faintdark ${focusRing}`}
            />
          </label>
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] -mx-1 px-1 sm:mx-0 sm:px-0 [&>*]:flex-shrink-0">
          <ToolbarSelect value={source} onChange={(e) => setSource(e.target.value as LeadSource | 'all')} aria-label="Found on">
            <option value="all">Any source</option>
            {LEAD_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </ToolbarSelect>
          <ToolbarSelect value={potential} onChange={(e) => setPotential(e.target.value as PotentialFilter)} aria-label="Potential">
            <option value="any">Any potential</option>
            <option value="3">★★★ only</option>
            <option value="2+">★★ and up</option>
            <option value="unrated">Not rated</option>
          </ToolbarSelect>
          {owners.length > 1 && (
            <ToolbarSelect value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
              <option value="all">Everyone</option>
              {owners.map(([email, name]) => (
                <option key={email} value={email}>{email === currentUser?.email ? `Mine (${name})` : name}</option>
              ))}
            </ToolbarSelect>
          )}
          <ToolbarSelect value={sort} onChange={(e) => setSort(e.target.value as LeadSort)} aria-label="Sort">
            {LEAD_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </ToolbarSelect>
          </div>
        </div>

        {/* Status chips within the tab */}
        {chipStatuses.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex-wrap -mx-1 px-1 mb-3" role="group" aria-label="Status">
            <button onClick={() => setStatusFilter('all')} aria-pressed={statusFilter === 'all'} className={scopeChip(statusFilter === 'all')}>
              All <span className="tabular-nums">{filteredBase.length}</span>
            </button>
            {chipStatuses.map((s) => {
              const n = filteredBase.filter((l) => l.status === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(statusFilter === s.id ? 'all' : s.id)}
                  aria-pressed={statusFilter === s.id}
                  className={scopeChip(statusFilter === s.id)}
                  title={s.hint}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.text }} aria-hidden="true" />
                  {s.label} <span className="tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className={`${card} sticky top-0 z-10 flex items-center gap-2 flex-wrap px-3 py-2 mb-2 shadow-float`} role="region" aria-label="Selected leads">
            <span className={`text-[12px] font-semibold ${bodyText}`}>{selected.size} selected</span>
            <span className={`text-[12px] ${faintText}`}>Move to</span>
            {(['approached', 'no-reply', 'later', 'denied'] as LeadStatus[]).map((s) => (
              <button key={s} onClick={() => bulk(s)} className={btnGhostSm}>
                {leadStatus(s).label}
              </button>
            ))}
            <button onClick={() => setSelected(new Set())} className={`${btnIcon} ml-auto`} aria-label="Clear selection">
              <X size={15} />
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className={`${card} p-1`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 h-[60px]">
                <div className="w-8 h-8 rounded-tile bg-tint dark:bg-tint-dark animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-1/3 rounded bg-tint dark:bg-tint-dark animate-pulse" />
                  <div className="h-2 w-1/5 rounded bg-tint dark:bg-tint-dark animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className={emptyState}>
            <div className={`${card} w-12 h-12 flex items-center justify-center`}>
              <Target size={20} className={faintText} />
            </div>
            {filtersOn ? (
              <>
                <p className={emptyTitle}>No leads match</p>
                <p className={emptyBody}>Nothing in {LEAD_VIEWS.find((v) => v.id === view)!.label} fits these filters.</p>
                <button onClick={clearFilters} className={`${btnGhostSm} mt-2`}>Clear filters</button>
              </>
            ) : (
              <>
                <p className={emptyTitle}>{EMPTY[view].title}</p>
                <p className={emptyBody}>{EMPTY[view].body}</p>
                {(view === 'active' || view === 'all') && (
                  <button onClick={() => setModal({ mode: 'new' })} className={`${btnPrimarySm} mt-2`}>
                    <Plus size={14} /> Add a lead
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <ul className={rowList} aria-label="Leads">
              {/* Column heads, and select-all, where there is room for both. */}
              <li className="hidden md:flex items-center gap-3 px-3 h-9 bg-tint dark:bg-tint-dark" aria-hidden="true">
                <input
                  type="checkbox"
                  checked={allShownSelected}
                  onChange={() =>
                    setSelected(allShownSelected ? new Set() : new Set(shown.map((l) => l.id)))
                  }
                  tabIndex={-1}
                  className="w-4 h-4 accent-ink dark:[color-scheme:dark]"
                />
                <span className="w-8" />
                <span className={`w-[28%] text-[11px] font-medium ${faintText}`}>Business</span>
                <span className={`flex-1 text-[11px] font-medium ${faintText}`}>Note</span>
                <span className={`text-[11px] font-medium ${faintText} pr-1`}>Status · potential · follow-up</span>
              </li>
              {shown.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  today={today}
                  now={now}
                  selected={selected.has(lead.id)}
                  onToggle={() => toggle(lead.id)}
                  onOpen={() => openLead(lead.id)}
                  onStatus={(s) => changeStatus(lead, s)}
                  onPotential={(p) => changePotential(lead, p)}
                  onFollowUp={(d) => changeFollowUp(lead, d)}
                />
              ))}
            </ul>
            {visible.length > limit && (
              <div className="flex justify-center mt-3">
                <button onClick={() => setLimit((n) => n + PAGE)} className={btnGhostSm}>
                  Show {Math.min(PAGE, visible.length - limit)} more of {visible.length - limit}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <LeadModal
          lead={modal.mode === 'edit' ? modal.lead : undefined}
          leads={leads}
          today={today}
          onClose={() => setModal(null)}
          onOpenLead={(id) => {
            setModal(null);
            openLead(id);
          }}
          onSave={(draft) =>
            runWrite(
              () => (modal.mode === 'edit' ? updateLead(modal.lead, draft) : addLead(draft)),
              'save the lead'
            )
          }
        />
      )}

      {openLeadObj && !modal && !onboarding && !denying && (
        <LeadSheet
          lead={openLeadObj}
          today={today}
          canDelete={isAdmin}
          onClose={() => openLead(null)}
          onEdit={() => setModal({ mode: 'edit', lead: openLeadObj })}
          onStatus={(s) => changeStatus(openLeadObj, s)}
          onPotential={(p) => changePotential(openLeadObj, p)}
          onFollowUp={(d) => changeFollowUp(openLeadObj, d)}
          onNote={(body) => addLeadNote(openLeadObj.id, body)}
          onOnboard={() => setOnboarding(openLeadObj)}
          onOpenClient={(id) => navigate(`/client/${id}`)}
          onDelete={async () => {
            if (!confirm(`Delete "${openLeadObj.name}" for good? Marking it Denied keeps it on record instead.`)) return;
            const ok = await runWrite(() => deleteLead(openLeadObj.id), 'delete the lead');
            if (ok) openLead(null);
          }}
        />
      )}

      {onboarding && (
        <OnboardDialog
          lead={onboarding}
          clients={clients}
          onClose={() => setOnboarding(null)}
          onOpenClient={(id) => navigate(`/client/${id}`)}
          onConfirm={async (target) => {
            let id: string | null = null;
            await runWrite(async () => { id = await onboardLead(onboarding, target); }, 'onboard the lead');
            return id;
          }}
        />
      )}

      {denying && (
        <DenyDialog
          lead={denying}
          onClose={() => setDenying(null)}
          onConfirm={async (reason: LeadLostReason) => {
            const lead = denying;
            setDenying(null);
            await runWrite(() => setLeadStatus(lead, 'denied', reason), 'mark the lead denied');
          }}
        />
      )}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  lead: Lead;
  today: string;
  now: number;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStatus: (s: LeadStatus) => void;
  onPotential: (p: LeadPotential | null) => void;
  onFollowUp: (d: string | null) => void;
}

// One business per row. The name opens it; status, stars and follow-up change
// right here, because those are what change tens of times a day. A phone stacks
// the row in three lines; a desktop reads it as a table.
function LeadRow({ lead, today, now, selected, onToggle, onOpen, onStatus, onPotential, onFollowUp }: RowProps) {
  const handle = primaryHandle(lead);
  const closed = leadStatus(lead.status).group === 'closed';
  const due = isDue(lead, today);
  const sub = [handle && `@${handle.handle}`, lead.industry, lead.location].filter(Boolean).join(' · ');
  const profile = handle ? profileUrl(handle.field, handle.handle) : '';
  const wa = lead.whatsapp ? whatsappUrl(lead.phone) : '';

  return (
    <li
      className={`group flex items-start md:items-center gap-3 px-3 py-2.5 md:py-2 min-h-[56px] cursor-pointer transition-colors hover:bg-hover dark:hover:bg-hover-dark ${
        selected ? 'bg-hover dark:bg-hover-dark' : ''
      }`}
      onClick={onOpen}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${lead.name}`}
        className="hidden md:block w-4 h-4 accent-ink dark:[color-scheme:dark] flex-shrink-0"
      />
      <div
        className={`w-8 h-8 mt-0.5 md:mt-0 rounded-tile border border-hairline dark:border-hairline-dark flex items-center justify-center flex-shrink-0 ${
          due ? 'bg-warning-soft dark:bg-warning-softdark text-warning-text dark:text-warning-textdark' : 'bg-tint dark:bg-tint-dark text-ink-soft dark:text-ink-softdark'
        }`}
        title={due ? 'Follow-up due' : undefined}
      >
        <SourceIcon source={lead.source} size={15} />
      </div>

      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
        <div className="md:w-[28%] min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className={`text-[13px] font-semibold truncate text-left rounded-chip ${focusRingInset} ${
                closed && lead.status === 'denied' ? 'text-ink-soft dark:text-ink-softdark' : 'text-ink dark:text-ink-dark'
              }`}
            >
              {lead.name}
            </button>
            <span className="md:hidden flex-shrink-0"><PotentialStars value={lead.potential} size={11} /></span>
          </div>
          {sub && <p className={`text-[12px] truncate ${faintText}`}>{sub}</p>}
        </div>

        {lead.note ? (
          <p className={`text-[12px] line-clamp-1 md:flex-1 min-w-0 ${bodyText}`} title={lead.note}>{lead.note}</p>
        ) : (
          <p className={`hidden md:block md:flex-1 text-[12px] ${faintText}`}>No note</p>
        )}

        <div className="flex items-center gap-1 flex-wrap md:flex-nowrap md:flex-shrink-0 mt-1 md:mt-0" onClick={(e) => e.stopPropagation()}>
          <span className="flex md:w-[118px]">
            <LeadStatusSelect value={lead.status} onChange={onStatus} leadName={lead.name} fill />
          </span>
          <span className="hidden md:inline-flex"><PotentialStars value={lead.potential} onChange={onPotential} size={13} /></span>
          <span className="flex md:w-[118px]">
            {!closed && (
              <FollowUpPicker
                status={lead.status}
                value={lead.followUpOn}
                today={today}
                onChange={onFollowUp}
                leadName={lead.name}
                quietWhenEmpty
              />
            )}
          </span>
          <span className={`hidden lg:inline w-14 text-right text-[11px] tabular-nums ${faintText}`} title="Last updated">
            {ago(lead.updatedAt, now)}
          </span>
          <span className="hidden md:flex w-8">
          {profile && (
            <a
              href={profile}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnIcon} !w-8 !h-8 [@media(hover:none)]:!w-10 [@media(hover:none)]:!h-10`}
              aria-label={`Open ${lead.name}'s profile`}
              title="Open profile"
            >
              <ExternalLink size={13} />
            </a>
          )}
          </span>
          <span className="hidden md:flex w-8">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btnIcon} !w-8 !h-8 [@media(hover:none)]:!w-10 [@media(hover:none)]:!h-10`}
              aria-label={`WhatsApp ${lead.name}`}
              title="WhatsApp"
            >
              <MessageCircle size={13} />
            </a>
          )}
          </span>
        </div>
      </div>
    </li>
  );
}
