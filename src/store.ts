import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth, db, getProvisioningAuth } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { AppUser, Client, ClientReview, ContentItem, ContentStatus } from './types';
import { generateId } from './utils';

// ─── Clients ─────────────────────────────────────────────────────────────────

// Keyed per user: one browser can be shared, and a client-role user must not
// start up showing an admin's cached list.
function clientsCacheKey(uid: string) {
  return `limi_clients_v2_${uid}`;
}

function readClientsCache(uid: string | null): Client[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(clientsCacheKey(uid));
    return raw ? (JSON.parse(raw) as Client[]) : [];
  } catch {
    return [];
  }
}

function writeClientsCache(uid: string | null, clients: Client[]) {
  if (!uid) return;
  try {
    localStorage.setItem(clientsCacheKey(uid), JSON.stringify(clients));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function useClients() {
  const { currentUser } = useAuth();
  const uid = currentUser?.id ?? null;
  const role = currentUser?.role;
  // Joined into a primitive so the effect doesn't resubscribe on every render
  // just because the array identity changed.
  const assignedKey = (currentUser?.assignedClientIds ?? []).join(',');

  const [clients, setClients] = useState<Client[]>(() => readClientsCache(uid));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    // Security rules are not filters: a collection query is rejected outright
    // unless the rules permit every document it could return. A client-role
    // user is only allowed their assigned clients, which is a per-document
    // condition, so the collection query below would be denied wholesale.
    // Reading each assigned document by ID is the shape rules can evaluate.
    if (role === 'client') {
      const ids = assignedKey ? assignedKey.split(',') : [];
      if (ids.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const found = new Map<string, Client>();
      const emit = () => {
        const list = ids
          .map((id) => found.get(id))
          .filter((c): c is Client => !!c)
          .sort((a, b) => a.createdAt - b.createdAt);
        setClients(list);
        writeClientsCache(uid, list);
        setLoading(false);
      };

      const unsubscribes = ids.map((id) =>
        onSnapshot(
          doc(db, 'clients', id),
          (snap) => {
            if (snap.exists()) {
              found.set(id, { ...(snap.data() as Omit<Client, 'id'>), id: snap.id });
            } else {
              found.delete(id);
            }
            emit();
          },
          (err) => {
            console.error(`[limi] client ${id} subscription failed`, err);
            setLoading(false);
          }
        )
      );

      return () => unsubscribes.forEach((u) => u());
    }

    const q = query(collection(db, 'clients'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fresh = snapshot.docs.map((d) => ({ ...(d.data() as Omit<Client, 'id'>), id: d.id }));
        setClients(fresh);
        writeClientsCache(uid, fresh);
        setLoading(false);
      },
      (err) => {
        // Don't swallow this: a denied read means the cached list below is
        // stale, not live, and every write is going to fail too.
        console.error('[limi] clients subscription failed', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid, role, assignedKey]);

  const addClient = useCallback(
    async (data: { name: string; imageUrl?: string; about: string }) => {
      await addDoc(collection(db, 'clients'), {
        name: data.name,
        imageUrl: data.imageUrl || '',
        about: data.about,
        content: [],
        createdAt: Date.now(),
      });
    },
    []
  );

  const addContent = useCallback(
    async (
      clientId: string,
      data: {
        title: string;
        driveLink: string;
        driveFileId: string;
        notes?: string;
        status: ContentStatus;
        scheduledAt?: number;
        uploadedByEmail: string;
      }
    ) => {
      const newItem: ContentItem = {
        id: generateId(),
        title: data.title,
        driveLink: data.driveLink,
        driveFileId: data.driveFileId,
        notes: data.notes || '',
        status: data.status,
        createdAt: Date.now(),
        scheduledAt: data.scheduledAt || 0,
        uploadedByEmail: data.uploadedByEmail,
        clientReview: 'pending',
        reviewNote: '',
      };
      await updateDoc(doc(db, 'clients', clientId), { content: arrayUnion(newItem) });
    },
    []
  );

  const updateContent = useCallback(
    async (
      clientId: string,
      contentId: string,
      data: {
        title: string;
        driveLink: string;
        driveFileId: string;
        notes?: string;
        scheduledAt?: number;
      }
    ) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      const updatedContent = client.content.map((item) =>
        item.id === contentId
          ? {
              ...item,
              title: data.title,
              driveLink: data.driveLink,
              driveFileId: data.driveFileId,
              notes: data.notes || '',
              scheduledAt: data.scheduledAt || 0,
            }
          : item
      );
      await updateDoc(doc(db, 'clients', clientId), { content: updatedContent });
    },
    [clients]
  );

  const deleteContent = useCallback(
    async (clientId: string, contentId: string) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      const updatedContent = client.content.filter((item) => item.id !== contentId);
      await updateDoc(doc(db, 'clients', clientId), { content: updatedContent });
    },
    [clients]
  );

  const updateContentStatus = useCallback(
    async (clientId: string, contentId: string, status: ContentStatus) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      const updatedContent = client.content.map((item) =>
        item.id === contentId ? { ...item, status } : item
      );
      await updateDoc(doc(db, 'clients', clientId), { content: updatedContent });
    },
    [clients]
  );

  const updateClientReview = useCallback(
    async (
      clientId: string,
      contentId: string,
      review: ClientReview,
      reviewNote?: string
    ) => {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;
      const updatedContent = client.content.map((item) =>
        item.id === contentId
          ? { ...item, clientReview: review, reviewNote: reviewNote || '' }
          : item
      );
      await updateDoc(doc(db, 'clients', clientId), { content: updatedContent });
    },
    [clients]
  );

  return {
    clients,
    loading,
    addClient,
    addContent,
    updateContent,
    deleteContent,
    updateContentStatus,
    updateClientReview,
  };
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUsers(
          snapshot.docs.map((d) => ({ ...(d.data() as Omit<AppUser, 'id'>), id: d.id }))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[limi] users subscription failed', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  // Creates the Auth account and its profile document. The profile is keyed by
  // the Auth UID so rules can resolve a caller's role from request.auth.uid.
  const addUser = useCallback(
    async (data: Omit<AppUser, 'id' | 'createdAt'> & { password: string }) => {
      const provisioningAuth = getProvisioningAuth();
      try {
        const credential = await createUserWithEmailAndPassword(
          provisioningAuth,
          data.email,
          data.password
        );
        await setDoc(doc(db, 'users', credential.user.uid), {
          name: data.name,
          email: data.email,
          role: data.role,
          assignedClientIds: data.assignedClientIds,
          createdAt: Date.now(),
        });
      } finally {
        // Always drop the secondary session, including when the profile write
        // fails, so a stray signed-in instance can't linger.
        await signOut(provisioningAuth);
      }
    },
    []
  );

  const sendReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const updateUser = useCallback(
    async (userId: string, data: Partial<Omit<AppUser, 'id' | 'createdAt'>>) => {
      await updateDoc(doc(db, 'users', userId), data);
    },
    []
  );

  const deleteUser = useCallback(async (userId: string) => {
    await deleteDoc(doc(db, 'users', userId));
  }, []);

  return { users, loading, addUser, updateUser, deleteUser, sendReset };
}
