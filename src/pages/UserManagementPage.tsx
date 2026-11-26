import { useState } from 'react';
import { Plus, Eye, EyeOff, KeyRound, Pencil, Trash2, X, Users, MoreVertical, ChevronDown } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../store';
import { useClients } from '../store';
import { AppUser, UserRole } from '../types';
import { runWrite } from '../utils';
import Menu from '../components/m3/Menu';
import { useFeedback } from '../components/m3/Feedback';
import {
  shellPad, card, heading, bodyText, faintText, label, labelAside, hint, input, overlay,
  modalPanel, modalTitle, btnPrimary, btnPrimarySm, btnGhost, btnIcon, rowList, emptyState,
  emptyTitle, emptyBody, focusRing,
} from '../ui';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'social-media-manager', label: 'Social media manager' },
  { value: 'client', label: 'Client' },
];

// Role tints, all from contrast-tested tokens: admin in the brand red, the
// manager in info blue, the client in success green. Every chip carries its
// text label, so the colour is never the only cue.
const ROLE_TONE: Record<UserRole, { chip: string; avatar: string }> = {
  admin: {
    chip: 'bg-brand-soft dark:bg-brand-softdark text-brand-text dark:text-brand-textdark',
    avatar: 'bg-brand-soft dark:bg-brand-softdark text-brand-text dark:text-brand-textdark',
  },
  'social-media-manager': {
    chip: 'bg-info-soft dark:bg-info-softdark text-info-text dark:text-info-textdark',
    avatar: 'bg-info-soft dark:bg-info-softdark text-info-text dark:text-info-textdark',
  },
  client: {
    chip: 'bg-success-soft dark:bg-success-softdark text-success-text dark:text-success-textdark',
    avatar: 'bg-success-soft dark:bg-success-softdark text-success-text dark:text-success-textdark',
  },
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  'social-media-manager': 'Social media manager',
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
        <div className="flex items-center justify-between mb-5">
          <h2 className={modalTitle}>{initial ? 'Edit member' : 'Add member'}</h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={label}>Full name</label>
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
              <label className={label}>Initial password</label>
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
                Assigned clients <span className={labelAside}>({assignedClientIds.length} selected)</span>
              </label>
              <div className="bg-raised dark:bg-raised-dark rounded-tile flex flex-col gap-0.5 max-h-40 overflow-y-auto p-2">
                {clients.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2.5 cursor-pointer py-1.5 px-1.5 rounded-tile hover:bg-hover dark:hover:bg-hover-dark transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={assignedClientIds.includes(c.id)}
                      onChange={() => toggleClient(c.id)}
                      className="accent-brand w-4 h-4"
                    />
                    <span className={`text-[13px] ${bodyText}`}>{c.name}</span>
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
              {initial ? 'Save changes' : 'Add member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const { currentUser } = useAuth();
  const { confirm, notify } = useFeedback();
  const { users, loading, addUser, updateUser, deleteUser, sendReset } = useUsers();
  const { clients } = useClients();
  const isAdmin = currentUser?.role === 'admin';

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

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
    if (ok) notify(`Reset email sent to ${user.email}`);
  }

  async function handleRole(user: AppUser, role: UserRole) {
    if (role === user.role) return;
    const ok = await runWrite(() => updateUser(user.id, { role }), 'change the role');
    if (ok) notify(`${user.name} is now ${ROLE_LABELS[role].toLowerCase()}`);
  }

  async function handleDelete(user: AppUser) {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
      notify('There must be at least one admin, so the only admin cannot be removed.');
      return;
    }
    const confirmed = await confirm({
      title: `Remove ${user.name}?`,
      body: 'They lose access immediately. Their sign-in record stays in Firebase Authentication and grants nothing on its own: delete it from the Firebase console if you want it gone entirely.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    await runWrite(() => deleteUser(user.id), 'delete the user');
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* The shell's top bar already names the page, so this starts with the
          count and the one action. */}
      <main className={`${shellPad} py-5 pb-24 sm:pb-8`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className={`text-[13px] ${faintText}`}>
            {loading ? 'Loading…' : `${users.length} member${users.length !== 1 ? 's' : ''}`}
          </p>
          {isAdmin && (
            <button onClick={() => setShowAddForm(true)} className={btnPrimarySm}>
              <Plus size={16} />
              Add member
            </button>
          )}
        </div>

        {loading ? (
          <div className={rowList} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 h-[60px]">
                <div className="w-10 h-10 rounded-full bg-raised dark:bg-raised-dark animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-1/4 rounded bg-raised dark:bg-raised-dark animate-pulse" />
                  <div className="h-2 w-1/3 rounded bg-raised dark:bg-raised-dark animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className={emptyState}>
            <div className={`${card} w-12 h-12 flex items-center justify-center`}>
              <Users size={22} className={faintText} />
            </div>
            <p className={emptyTitle}>No team members yet</p>
            <p className={emptyBody}>Add a member to give them access to the boards.</p>
            {isAdmin && (
              <button onClick={() => setShowAddForm(true)} className={`${btnPrimarySm} mt-2`}>
                <Plus size={16} /> Add member
              </button>
            )}
          </div>
        ) : (
          <ul className={rowList} aria-label="Team members">
            {users.map((user) => {
              const tone = ROLE_TONE[user.role];
              const isMe = user.id === currentUser?.id;
              const canEditRole = isAdmin && !isMe;

              const roleChip = (
                <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[12px] font-medium whitespace-nowrap">
                  {ROLE_LABELS[user.role]}
                  {canEditRole && <ChevronDown size={14} aria-hidden="true" />}
                </span>
              );

              return (
                <li
                  key={user.id}
                  className="flex items-center gap-3 px-3 py-2 min-h-[60px] rounded-card hover:bg-raised dark:hover:bg-raised-dark transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] font-medium ${tone.avatar}`}
                    aria-hidden="true"
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] truncate ${heading}`}>
                      {user.name}
                      {isMe && <span className={`ml-1.5 font-normal ${faintText}`}>(you)</span>}
                    </p>
                    <p className={`sm:hidden text-[12px] ${faintText}`}>{ROLE_LABELS[user.role]}</p>
                    <p className={`text-[12px] truncate ${bodyText}`}>
                      {user.email}
                      {user.role === 'client' && user.assignedClientIds?.length > 0 && (
                        <span className={faintText}>
                          {' '}· {user.assignedClientIds.length} client
                          {user.assignedClientIds.length !== 1 ? 's' : ''} assigned
                        </span>
                      )}
                    </p>
                  </div>

                  {/* The role: a chip, and for an admin looking at someone else, its menu. */}
                  {canEditRole ? (
                    <Menu
                      label={`Role of ${user.name}`}
                      minWidth={200}
                      items={ROLE_OPTIONS.map((r) => ({
                        key: r.value,
                        label: r.label,
                        checked: r.value === user.role,
                        onSelect: () => handleRole(user, r.value),
                      }))}
                      trigger={(t) => (
                        <button
                          type="button"
                          {...t}
                          aria-label={`Role of ${user.name}: ${ROLE_LABELS[user.role]}, change`}
                          className={`hidden sm:inline-flex rounded-full flex-shrink-0 hover:brightness-95 dark:hover:brightness-110 ${tone.chip} ${focusRing}`}
                        >
                          {roleChip}
                        </button>
                      )}
                    />
                  ) : (
                    <span className={`hidden sm:inline-flex rounded-full flex-shrink-0 ${tone.chip}`}>{roleChip}</span>
                  )}

                  {/* Passwords are hashed by Firebase Auth and can't be read back by
                      anyone, so the only lever is a reset email. */}
                  {isAdmin && (
                    <Menu
                      label={`Actions for ${user.name}`}
                      align="end"
                      items={[
                        { key: 'edit', label: 'Edit', icon: <Pencil size={18} />, onSelect: () => setEditingUser(user) },
                        { key: 'reset', label: 'Send password reset', icon: <KeyRound size={18} />, onSelect: () => handleSendReset(user) },
                        ...(!isMe
                          ? ['divider' as const, { key: 'remove', label: 'Remove', icon: <Trash2 size={18} />, danger: true, onSelect: () => handleDelete(user) }]
                          : []),
                      ]}
                      trigger={(t) => (
                        <button type="button" {...t} className={`${btnIcon} flex-shrink-0`} aria-label={`Actions for ${user.name}`}>
                          <MoreVertical size={18} />
                        </button>
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ul>
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
