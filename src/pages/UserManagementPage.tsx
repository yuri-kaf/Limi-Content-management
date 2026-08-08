import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Eye, EyeOff, KeyRound, Pencil, Trash2, X, Sun, Moon, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUsers } from '../store';
import { useClients } from '../store';
import { AppUser, UserRole } from '../types';
import { runWrite } from '../utils';
import {
  page, card, tile, inset, heading, bodyText, faintText, badge, label, labelAside, hint,
  input, overlay, modalPanel, modalTitle, btnPrimary, btnGhost, btnIcon,
} from '../ui';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'social-media-manager', label: 'Social Media Manager' },
  { value: 'client', label: 'Client' },
];

// Role tints. Admin borrows the brand red; the other two reuse stage hues that
// are already validated for contrast, and every chip carries its text label.
const ROLE_TONE: Record<UserRole, { chip: string; avatar: string }> = {
  admin: {
    chip: 'bg-brand-soft dark:bg-brand-softdark text-brand',
    avatar: 'bg-brand-soft dark:bg-brand-softdark text-brand',
  },
  'social-media-manager': {
    chip: 'bg-sky-50 dark:bg-sky-950/40 text-stage-review dark:text-sky-400',
    avatar: 'bg-sky-50 dark:bg-sky-950/40 text-stage-review dark:text-sky-400',
  },
  client: {
    chip: 'bg-emerald-50 dark:bg-emerald-950/40 text-stage-posted dark:text-emerald-400',
    avatar: 'bg-emerald-50 dark:bg-emerald-950/40 text-stage-posted dark:text-emerald-400',
  },
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  'social-media-manager': 'Social Media Manager',
  client: 'Client',
};

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  assignedClientIds: string[];
}

function UserForm({
  initial,
  onSubmit,
  onClose,
  clients,
  isEditingSelf,
  isEdit,
}: {
  initial?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => void;
  onClose: () => void;
  clients: { id: string; name: string }[];
  isEditingSelf: boolean;
  isEdit: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'social-media-manager');
  const [assignedClientIds, setAssignedClientIds] = useState<string[]>(initial?.assignedClientIds ?? []);
  const [showPw, setShowPw] = useState(false);

  function toggleClient(id: string) {
    setAssignedClientIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), password, role, assignedClientIds });
  }

  return (
    <div
      className={overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={modalPanel}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={modalTitle}>{initial ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={label}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Jane Smith"
              className={input}
            />
          </div>

          <div>
            <label className={label}>Email</label>
            {/* Changing an existing account's email address is an admin-only
                Auth operation, unavailable to the client SDK. */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="jane@example.com"
              className={`${input} disabled:opacity-60`}
              disabled={isEdit}
            />
            {isEdit && (
              <p className={hint}>Email can't be changed after the account is created.</p>
            )}
          </div>

          {/* Only at creation. Existing passwords are hashes we can't read or
              overwrite from the browser — those go through a reset email. */}
          {!isEdit && (
            <div>
              <label className={label}>Initial Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className={`${input} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className={`${btnIcon} absolute right-1 top-1/2 -translate-y-1/2`}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className={hint}>
                Share this with them once. It isn't stored and can't be viewed later.
              </p>
            </div>
          )}

          <div>
            <label className={label}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={`${input} disabled:opacity-60`}
              disabled={isEditingSelf}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {isEditingSelf && <p className={hint}>You can't change your own role.</p>}
          </div>

          {role === 'client' && clients.length > 0 && (
            <div>
              <label className={label}>
                Assigned Clients <span className={labelAside}>({assignedClientIds.length} selected)</span>
              </label>
              <div className={`${inset} flex flex-col gap-0.5 max-h-40 overflow-y-auto p-2`}>
                {clients.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2.5 cursor-pointer py-1.5 px-1.5 rounded-lg hover:bg-surface dark:hover:bg-surface-dark transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={assignedClientIds.includes(c.id)}
                      onChange={() => toggleClient(c.id)}
                      className="accent-brand w-4 h-4"
                    />
                    <span className={`text-sm ${bodyText}`}>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !email.trim() || (!isEdit && password.length < 6)}
              className={`${btnPrimary} flex-1`}
            >
              {initial ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { users, loading, addUser, updateUser, deleteUser, sendReset } = useUsers();
  const { clients } = useClients();
  const isAdmin = currentUser?.role === 'admin';

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  async function handleAdd(data: UserFormData) {
    const ok = await runWrite(() => addUser(data), 'add the user');
    if (ok) setShowAddForm(false);
  }

  async function handleEdit(data: UserFormData) {
    if (!editingUser) return;
    // Password isn't part of the profile document; email can't be reassigned.
    const ok = await runWrite(
      () =>
        updateUser(editingUser.id, {
          name: data.name,
          role: data.role,
          assignedClientIds: data.assignedClientIds,
        }),
      'save the user'
    );
    // The profile subscription in AuthContext picks up changes to your own
    // record on its own, so there's nothing to refresh by hand here.
    if (ok) setEditingUser(null);
  }

  async function handleSendReset(user: AppUser) {
    const ok = await runWrite(() => sendReset(user.email), 'send the reset email');
    if (ok) {
      setResetSentTo(user.id);
      setTimeout(() => setResetSentTo((id) => (id === user.id ? null : id)), 4000);
    }
  }

  async function handleDelete(user: AppUser) {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
      alert('Cannot delete the only admin.');
      return;
    }
    const confirmed = confirm(
      `Remove ${user.name}? They lose access immediately.\n\nTheir sign-in record stays in Firebase Authentication and grants nothing on its own — delete it from the Firebase console if you want it gone entirely.`
    );
    if (!confirmed) return;
    await runWrite(() => deleteUser(user.id), 'delete the user');
  }

  return (
    <div className={page}>
      {/* Header — mirrors the clients page so the two never drift apart */}
      <header
        className="bg-canvas/85 dark:bg-canvas-dark/85 backdrop-blur-xl sticky top-0 z-10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-pill">
              <span className="text-white font-bold text-xs leading-none">L</span>
            </div>
            <span className={`${heading} text-[15px]`}>Limi</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className={btnIcon} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={() => navigate('/')} className={`${btnGhost} h-9 min-h-0 px-3.5 text-xs`}>
              Home
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-5 sm:mb-8">
          <div>
            <button
              onClick={() => navigate('/')}
              className={`flex items-center gap-1.5 text-xs mb-2 transition-colors ${faintText} hover:text-ink dark:hover:text-ink-dark`}
            >
              <ArrowLeft size={13} />
              Back
            </button>
            <h1 className={`${heading} text-lg sm:text-xl`}>Team</h1>
            {!loading && (
              <p className={`text-sm mt-0.5 ${faintText}`}>
                {users.length} member{users.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {isAdmin && (
            <button onClick={() => setShowAddForm(true)} className={btnPrimary}>
              <Plus size={15} />
              <span className="hidden sm:inline">Add Member</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className={`${tile} w-16 h-16 flex items-center justify-center mb-4`}>
              <Users size={24} className={faintText} />
            </div>
            <h2 className={`${heading} text-base mb-2`}>No team members yet</h2>
            <p className={`text-sm max-w-xs leading-relaxed ${faintText}`}>
              Add your first member to give them access to the boards.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map((user) => {
              const tone = ROLE_TONE[user.role];
              const isMe = user.id === currentUser?.id;

              return (
                <div
                  key={user.id}
                  className={`${card} p-4 flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${tone.avatar}`}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm ${heading}`}>{user.name}</span>
                      {isMe && (
                        <span
                          className={`${badge} border border-hairline dark:border-hairline-dark ${faintText}`}
                        >
                          You
                        </span>
                      )}
                      <span className={`${badge} ${tone.chip}`}>{ROLE_LABELS[user.role]}</span>
                    </div>
                    <p className={`text-xs mt-0.5 truncate ${bodyText}`}>{user.email}</p>
                    {user.role === 'client' && user.assignedClientIds?.length > 0 && (
                      <p className={`text-[11px] mt-0.5 ${faintText}`}>
                        {user.assignedClientIds.length} client
                        {user.assignedClientIds.length !== 1 ? 's' : ''} assigned
                      </p>
                    )}
                  </div>

                  {/* Actions (admin only) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                      {/* Passwords are hashed by Firebase Auth and can't be read
                          back by anyone, so the only lever is a reset email. */}
                      <button
                        onClick={() => handleSendReset(user)}
                        disabled={resetSentTo === user.id}
                        className={`${btnGhost} h-9 min-h-0 px-3 text-xs disabled:opacity-60`}
                      >
                        <KeyRound size={12} />
                        {resetSentTo === user.id ? 'Reset sent' : 'Send reset'}
                      </button>
                      <button
                        onClick={() => setEditingUser(user)}
                        className={btnIcon}
                        aria-label={`Edit ${user.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      {!isMe && (
                        <button
                          onClick={() => handleDelete(user)}
                          className={`${btnIcon} hover:text-brand hover:bg-brand-soft dark:hover:bg-brand-softdark`}
                          aria-label={`Remove ${user.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showAddForm && (
        <UserForm
          clients={clients}
          isEditingSelf={false}
          isEdit={false}
          onClose={() => setShowAddForm(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingUser && (
        <UserForm
          initial={{
            name: editingUser.name,
            email: editingUser.email,
            role: editingUser.role,
            assignedClientIds: editingUser.assignedClientIds,
          }}
          clients={clients}
          isEditingSelf={editingUser.id === currentUser?.id}
          isEdit
          onClose={() => setEditingUser(null)}
          onSubmit={handleEdit}
        />
      )}
    </div>
  );
}
