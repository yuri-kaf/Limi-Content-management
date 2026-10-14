import { useState } from 'react';
import { Lightbulb, Plus, X, Link as LinkIcon, Check, Ban, Trash2, ArrowRight } from 'lucide-react';
import { Business, FolderColor, Idea, IdeaStatus } from '../types';
import { businessIdOf } from '../campaigns';
import { useIdeas } from '../store';
import { runWrite } from '../utils';
import CommentThread from './CommentThread';
import ColorLabel from './ColorLabel';
import {
  overlay, modalPanel, modalTitle, btnIcon, btnPrimary, btnGhost, label, labelAside, hint,
  input, textarea, card, heading, bodyText, faintText, readout,
  emptyState, emptyTitle, emptyBody,
} from '../ui';

// Each status as a tinted label in one of the folder colours, which are
// contrast-tested in both themes.
const STATUS_META: Record<IdeaStatus, { label: string; color: FolderColor }> = {
  new: { label: 'New', color: 'blue' },
  accepted: { label: 'Accepted', color: 'green' },
  declined: { label: 'Declined', color: 'graphite' },
};

// A small icon action on an idea. Each one colours itself on hover by what it does.
const ideaAction =
  'w-8 h-8 inline-flex items-center justify-center rounded-tile text-ink-faint dark:text-ink-faintdark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30';

function IdeaForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; links: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const ok = await runWrite(
      () =>
        onSubmit({
          title: title.trim(),
          description: description.trim(),
          links: links
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      'save the idea'
    );
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <div className={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={modalPanel} role="dialog" aria-modal="true" aria-labelledby="idea-form-title">
        <div className="flex items-center justify-between mb-6">
          <h2 id="idea-form-title" className={modalTitle}>New idea</h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="idea-title" className={label}>Title</label>
            <input
              id="idea-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Behind the scenes of the new store"
              required
              className={input}
            />
          </div>

          <div>
            <label htmlFor="idea-description" className={label}>Description</label>
            <textarea
              id="idea-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the idea, and why now?"
              rows={4}
              className={textarea}
            />
          </div>

          <div>
            <label htmlFor="idea-links" className={label}>
              Links <span className={labelAside}>(one per line)</span>
            </label>
            {/* !text-xs: the textarea recipe already sets text-sm, and of two
                font sizes Tailwind's own order picks the winner, not the list. */}
            <textarea
              id="idea-links"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder={'https://drive.google.com/...\nhttps://example.com/reference'}
              rows={3}
              className={`${textarea} font-mono !text-xs`}
            />
            <p className={hint}>References, Drive files, anything worth pointing at.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button type="submit" disabled={!title.trim() || saving} className={`${btnPrimary} flex-1`}>
              {saving ? 'Saving…' : 'Submit idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function IdeasView({
  clientId,
  businesses,
  businessId,
  canTriage,
  onConvert,
}: {
  clientId: string;
  /** The client's businesses, for placing ideas submitted before businesses existed. */
  businesses: Business[];
  /** Shows only this business's ideas, and files new ones under it. */
  businessId?: string;
  /** Admins and managers triage; clients submit and discuss. */
  canTriage: boolean;
  onConvert: (idea: Idea) => void;
}) {
  const {
    ideas: allIdeas, loading, addIdea, setIdeaStatus, deleteIdea, addIdeaComment,
  } = useIdeas(clientId);
  const ideas = businessId
    ? allIdeas.filter((i) => businessIdOf(i, businesses) === businessId)
    : allIdeas;
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleDecision(idea: Idea, status: IdeaStatus) {
    const note =
      status === 'declined'
        ? prompt('Why is this being declined? (optional — the client will see it)') ?? ''
        : '';
    await runWrite(() => setIdeaStatus(idea.id, status, note), 'update the idea');
  }

  async function handleDelete(idea: Idea) {
    if (!confirm(`Delete "${idea.title}"? This can't be undone.`)) return;
    await runWrite(() => deleteIdea(idea.id), 'delete the idea');
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className={`${heading} text-sm`}>Ideas</h2>
          <p className={`text-xs mt-0.5 ${faintText}`}>{ideas.length} submitted</p>
        </div>
        <button onClick={() => setShowForm(true)} className={btnPrimary}>
          <Plus size={15} />
          New idea
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
        </div>
      ) : ideas.length === 0 ? (
        <div className={emptyState}>
          <div className={`${card} w-12 h-12 flex items-center justify-center`}>
            <Lightbulb size={20} className={faintText} />
          </div>
          <p className={emptyTitle}>No ideas yet</p>
          <p className={emptyBody}>
            Anything worth making — a concept, a reference, a rough thought — starts here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ideas.map((idea) => {
            const meta = STATUS_META[idea.status];
            const isOpen = expanded === idea.id;
            return (
              <div key={idea.id} className={`${card} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`${heading} text-sm`}>{idea.title}</h3>
                      <ColorLabel color={meta.color}>{meta.label}</ColorLabel>
                      {idea.convertedContentId && (
                        <span className={`text-[11px] ${faintText}`}>· on the board</span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${faintText}`}>
                      {idea.createdByName} ·{' '}
                      {new Date(idea.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {idea.description && (
                      <p className={`text-sm mt-2 leading-relaxed whitespace-pre-wrap ${bodyText}`}>
                        {idea.description}
                      </p>
                    )}

                    {idea.links.length > 0 && (
                      <div className="flex flex-col gap-1 mt-2">
                        {idea.links.map((l) => (
                          <a
                            key={l}
                            href={l}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 text-xs truncate transition-colors ${faintText} hover:text-brand-text dark:hover:text-brand-textdark`}
                          >
                            <LinkIcon size={11} className="flex-shrink-0" />
                            <span className="truncate">{l}</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {idea.decisionNote && <p className={`${readout} mt-2`}>{idea.decisionNote}</p>}
                  </div>

                  {canTriage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {idea.status !== 'accepted' && (
                        <button
                          onClick={() => handleDecision(idea, 'accepted')}
                          className={`${ideaAction} hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40`}
                          aria-label="Accept"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {idea.status !== 'declined' && (
                        <button
                          onClick={() => handleDecision(idea, 'declined')}
                          className={`${ideaAction} hover:text-ink dark:hover:text-ink-dark hover:bg-hover dark:hover:bg-hover-dark`}
                          aria-label="Decline"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(idea)}
                        className={`${ideaAction} hover:text-brand-text dark:hover:text-brand-textdark hover:bg-brand-soft dark:hover:bg-brand-softdark`}
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => setExpanded(isOpen ? null : idea.id)}
                    className={`text-xs transition-colors hover:text-ink dark:hover:text-ink-dark ${faintText}`}
                  >
                    {isOpen ? 'Hide discussion' : 'Discussion'}
                  </button>
                  {canTriage && idea.status === 'accepted' && !idea.convertedContentId && (
                    <button
                      onClick={() => onConvert(idea)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand-text dark:text-brand-textdark hover:underline underline-offset-2"
                    >
                      Make content
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3">
                    <CommentThread
                      clientId={clientId}
                      contentId={idea.id}
                      parent="ideas"
                      showTimestamp={false}
                      onSend={(body) => addIdeaComment(idea.id, body)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <IdeaForm
          onClose={() => setShowForm(false)}
          onSubmit={(data) => addIdea({ ...data, ...(businessId ? { businessId } : {}) })}
        />
      )}
    </div>
  );
}
