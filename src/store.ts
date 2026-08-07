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
import { AppUser, Client, ClientReview, ContentItem, ContentStatus } from './types';
import { generateId } from './utils';

// ─── Clients ─────────────────────────────────────────────────────────────────

const CLIENTS_CACHE_KEY = 'limi_clients_v1';

function readClientsCache(): Client[] {
  try {
    const raw = localStorage.getItem(CLIENTS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Client[]) : [];
  } catch {
    return [];
  }
}

function writeClientsCache(clients: Client[]) {
  try {
    localStorage.setItem(CLIENTS_CACHE_KEY, JSON.stringify(clients));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function useClients() {
  const cached = readClientsCache();
  const [clients, setClients] = useState<Client[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fresh = snapshot.docs.map((d) => ({ ...(d.data() as Omit<Client, 'id'>), id: d.id }));
        setClients(fresh);
        writeClientsCache(fresh);
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
  }, []);

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
