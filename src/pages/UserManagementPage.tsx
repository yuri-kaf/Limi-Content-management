import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Eye, EyeOff, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../store';
import { useClients } from '../store';
import { AppUser, UserRole } from '../types';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'social-media-manager', label: 'Social Media Manager' },
  { value: 'client', label: 'Client' },
];

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  admin: { bg: '#dc262620', text: '#dc2626' },
  'social-media-manager': { bg: '#2563eb20', text: '#60a5fa' },
  client: { bg: '#05966920', text: '#34d399' },
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
}: {
  initial?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => void;
  onClose: () => void;
  clients: { id: string; name: string }[];
  isEditingSelf: boolean;
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

  const inputCls = 'w-full bg-[#0c0c0c] border border-[#222] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#333] focus:outline-none focus:border-[#dc2626] transition-colors';
  const labelCls = 'block text-xs font-semibold text-[#666] mb-1.5 uppercase tracking-wider';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-white">
            {initial ? 'Edit User' : 'Add User'}
          </h2>
          <button onClick={onClose} className="text-[#444] hover:text-[#888] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Smith" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jane@example.com" className={inputCls} disabled={isEditingSelf} />
          </div>

          <div>
            <label className={labelCls}>Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Set password"
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={inputCls}
              disabled={isEditingSelf}
              style={{ colorScheme: 'dark' }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {role === 'client' && clients.length > 0 && (
            <div>
              <label className={labelCls}>Assigned Clients</label>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto p-2 bg-[#0c0c0c] rounded-lg border border-[#222]">
                {clients.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 cursor-pointer py-1 px-1 rounded-md hover:bg-[#161616] transition-colors">
                    <input
                      type="checkbox"
                      checked={assignedClientIds.includes(c.id)}
                      onChange={() => toggleClient(c.id)}
                      className="accent-[#dc2626]"
                    />
                    <span className="text-sm text-[#aaa]">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-transparent border border-[#222] text-[#666] rounded-xl py-2.5 text-sm font-medium hover:bg-[#161616] hover:text-[#999] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !email.trim() || !password}
              className="flex-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-red-900/30"
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
  const { currentUser, refreshCurrentUser } = useAuth();
  const { users, loading, addUser, updateUser, deleteUser } = useUsers();
  const { clients } = useClients();
  const isAdmin = currentUser?.role === 'admin';

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  function togglePassword(userId: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleAdd(data: Omit<AppUser, 'id' | 'createdAt'>) {
    await addUser(data);
    setShowAddForm(false);
  }

  async function handleEdit(data: Omit<AppUser, 'id' | 'createdAt'>) {
    if (!editingUser) return;
    await updateUser(editingUser.id, data);
    if (editingUser.id === currentUser?.id) {
      refreshCurrentUser({ ...currentUser, ...data });
    }
    setEditingUser(null);
  }

  async function handleDelete(user: AppUser) {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
      alert('Cannot delete the only admin.');
      return;
    }
    await deleteUser(user.id);
  }

  const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Admin',
    'social-media-manager': 'Social Media Manager',
    client: 'Client',
  };

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <header className="border-b border-[#161616] bg-[#080808] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center shadow-md shadow-red-900/40">
              <span className="text-white font-bold text-xs leading-none">L</span>
            </div>
            <span className="text-white font-bold text-[15px] tracking-tight">Limi</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-[#666] hover:text-[#999] border border-[#1e1e1e] hover:border-[#2e2e2e] px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-[#444] hover:text-[#888] text-xs mb-2 transition-colors"
            >
              <ArrowLeft size={13} />
              Back
            </button>
            <h1 className="text-xl font-bold text-white">Team</h1>
            {!loading && (
              <p className="text-sm text-[#555] mt-1">{users.length} member{users.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-red-900/30"
            >
              <Plus size={15} />
              Add Member
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-5 h-5 border-2 border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((user) => {
              const colors = ROLE_COLORS[user.role];
              const isMe = user.id === currentUser?.id;
              const pwVisible = visiblePasswords.has(user.id);

              return (
                <div
                  key={user.id}
                  className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 flex items-center gap-4"
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ backgroundColor: `${colors.text}20`, color: colors.text }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{user.name}</span>
                      {isMe && <span className="text-[10px] text-[#555] border border-[#222] rounded-full px-2 py-0.5">You</span>}
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                    </div>
                    <p className="text-xs text-[#555] mt-0.5 truncate">{user.email}</p>
                    {user.role === 'client' && user.assignedClientIds?.length > 0 && (
                      <p className="text-[11px] text-[#444] mt-0.5">
                        {user.assignedClientIds.length} client{user.assignedClientIds.length !== 1 ? 's' : ''} assigned
                      </p>
                    )}
                  </div>

                  {/* Password (admin only) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 bg-[#0c0c0c] border border-[#1a1a1a] rounded-lg px-2.5 py-1.5">
                      <span className="text-xs text-[#666] font-mono">
                        {pwVisible ? user.password : '••••••••'}
                      </span>
                      <button
                        onClick={() => togglePassword(user.id)}
                        className="text-[#333] hover:text-[#666] transition-colors ml-1"
                      >
                        {pwVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  )}

                  {/* Actions (admin only) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="p-1.5 rounded-lg text-[#444] hover:text-[#aaa] hover:bg-[#1a1a1a] transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      {!isMe && (
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 rounded-lg text-[#444] hover:text-[#dc2626] hover:bg-[#1a0808] transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 size={13} />
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
          onClose={() => setShowAddForm(false)}
          onSubmit={handleAdd}
        />
      )}

      {editingUser && (
        <UserForm
          initial={{
            name: editingUser.name,
            email: editingUser.email,
            password: editingUser.password,
            role: editingUser.role,
            assignedClientIds: editingUser.assignedClientIds,
          }}
          clients={clients}
          isEditingSelf={editingUser.id === currentUser?.id}
          onClose={() => setEditingUser(null)}
          onSubmit={handleEdit}
        />
      )}
    </div>
  );
}
