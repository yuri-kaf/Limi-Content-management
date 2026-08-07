import { useState } from 'react';
import { Lightbulb, Plus, X, Link as LinkIcon, Check, Ban, Trash2, ArrowRight } from 'lucide-react';
import { Idea, IdeaStatus } from '../types';
import { useIdeas } from '../store';
import { runWrite } from '../utils';
import CommentThread from './CommentThread';

const STATUS_META: Record<IdeaStatus, { label: string; color: string }> = {
  new: { label: 'New', color: '#2563eb' },
  accepted: { label: 'Accepted', color: '#059669' },
  declined: { label: 'Declined', color: '#6b7280' },
};

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

  const inputCls =
    'w-full bg-neutral-100 dark:bg-[#0c0c0c] border border-neutral-200 dark:border-[#222] rounded-lg px-3 py-2.5 text-neutral-900 dark:text-white text-sm placeholder-neutral-400 dark:placeholder-[#333] focus:outline-none focus:border-[#dc2626] transition-colors';
  const labelCls =
    'block text-xs font-semibold text-neutral-500 dark:text-[#666] mb-1.5 uppercase tracking-wider';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">New Idea</h2>
          <button onClick={onClose} className="text-neutral-400 dark:text-[#444] hover:text-neutral-600 dark:hover:text-[#888] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Behind the scenes of the new store"
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the idea, and why now?"
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>
              Links{' '}
              <span className="text-neutral-300 dark:text-[#333] normal-case font-normal tracking-normal">(one per line)</span>
            </label>
            <textarea
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder={'https://drive.google.com/...\nhttps://example.com/reference'}
              rows={3}
              className={`${inputCls} resize-none font-mono text-xs`}
            />
            <p className="text-[11px] text-neutral-400 dark:text-[#555] mt-1.5">
              References, Drive files, anything worth pointing at.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-transparent border border-neutral-200 dark:border-[#222] text-neutral-500 dark:text-[#666] rounded-xl py-2.5 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-[#161616] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="flex-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Submit Idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function IdeasView({
  clientId,
  canTriage,
  onConvert,
}: {
  clientId: string;
  /** Admins and managers triage; clients submit and discuss. */
  canTriage: boolean;
  onConvert: (idea: Idea) => void;
}) {
  const { ideas, loading, addIdea, setIdeaStatus, deleteIdea, addIdeaComment } = useIdeas(clientId);
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
          <h2 className="text-sm font-semibold text-neutral-600 dark:text-[#888]">Ideas</h2>
          <p className="text-xs text-neutral-400 dark:text-[#555] mt-0.5">
            {ideas.length} submitted
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-red-900/30"
        >
          <Plus size={15} />
          New Idea
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-neutral-200 dark:border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] flex items-center justify-center mb-4">
            <Lightbulb size={22} className="text-neutral-300 dark:text-[#333]" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1.5">
            No ideas yet
          </h3>
          <p className="text-sm text-neutral-400 dark:text-[#444] max-w-xs leading-relaxed">
            Anything worth making — a concept, a reference, a rough thought — starts here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ideas.map((idea) => {
            const meta = STATUS_META[idea.status];
            const isOpen = expanded === idea.id;
            return (
              <div
                key={idea.id}
                className="bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {idea.title}
                      </h3>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {idea.convertedContentId && (
                        <span className="text-[10px] text-neutral-400 dark:text-[#555]">
                          · on the board
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 dark:text-[#555] mt-0.5">
                      {idea.createdByName} ·{' '}
                      {new Date(idea.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    {idea.description && (
                      <p className="text-sm text-neutral-500 dark:text-[#888] mt-2 leading-relaxed whitespace-pre-wrap">
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
                            className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-[#666] hover:text-[#dc2626] transition-colors truncate"
                          >
                            <LinkIcon size={11} className="flex-shrink-0" />
                            <span className="truncate">{l}</span>
                          </a>
                        ))}
                      </div>
                    )}

                    {idea.decisionNote && (
                      <p className="text-xs text-neutral-500 dark:text-[#777] mt-2 bg-neutral-50 dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#1a1a1a] rounded-lg p-2.5">
                        {idea.decisionNote}
                      </p>
                    )}
                  </div>

                  {canTriage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {idea.status !== 'accepted' && (
                        <button
                          onClick={() => handleDecision(idea, 'accepted')}
                          className="p-1.5 rounded-lg text-neutral-400 dark:text-[#444] hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-[#04140d] transition-colors"
                          aria-label="Accept"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {idea.status !== 'declined' && (
                        <button
                          onClick={() => handleDecision(idea, 'declined')}
                          className="p-1.5 rounded-lg text-neutral-400 dark:text-[#444] hover:text-neutral-600 dark:hover:text-[#999] hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors"
                          aria-label="Decline"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(idea)}
                        className="p-1.5 rounded-lg text-neutral-400 dark:text-[#444] hover:text-[#dc2626] hover:bg-red-50 dark:hover:bg-[#1a0808] transition-colors"
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
                    className="text-xs text-neutral-400 dark:text-[#555] hover:text-neutral-600 dark:hover:text-[#888] transition-colors"
                  >
                    {isOpen ? 'Hide discussion' : 'Discussion'}
                  </button>
                  {canTriage && idea.status === 'accepted' && !idea.convertedContentId && (
                    <button
                      onClick={() => onConvert(idea)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#dc2626] hover:text-[#b91c1c] transition-colors"
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

      {showForm && <IdeaForm onClose={() => setShowForm(false)} onSubmit={addIdea} />}
    </div>
  );
}
