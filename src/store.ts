import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
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
import {
  AppUser, Client, ClientReview, ContentItem, ContentStatus, MediaType, Platform,
} from './types';
import { generateId } from './utils';

// ─── Clients ─────────────────────────────────────────────────────────────────

// Content lives in clients/{clientId}/content/{itemId}. `legacyContent` holds
// whatever remains in the pre-migration array field so the migration can find
// it; it is not surfaced to the UI.
type BaseClient = Omit<Client, 'content'> & { legacyContent: ContentItem[] };

function contentDoc(clientId: string, contentId: string) {
  return doc(db, 'clients', clientId, 'content', contentId);
}

function toBaseClient(id: string, data: Record<string, any>): BaseClient {
  return {
    id,
    name: data.name as string,
    imageUrl: data.imageUrl as string | undefined,
    about: data.about as string,
    createdAt: data.createdAt as number,
    legacyContent: (data.content as ContentItem[]) ?? [],
  };
}

// Cached clients are already-merged reads, so they carry no legacy array —
// which keeps a cold start from falsely reporting a pending migration.
function toBaseFromCache(c: Client): BaseClient {
  return {
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    about: c.about,
    createdAt: c.createdAt,
    legacyContent: [],
  };
}

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

  const [baseClients, setBaseClients] = useState<BaseClient[]>(() =>
    readClientsCache(uid).map(toBaseFromCache)
  );
  const [contentByClient, setContentByClient] = useState<Record<string, ContentItem[]>>(() =>
    Object.fromEntries(readClientsCache(uid).map((c) => [c.id, c.content]))
  );
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
        setBaseClients([]);
        setLoading(false);
        return;
      }

      const found = new Map<string, BaseClient>();
      const emit = () => {
        const list = ids
          .map((id) => found.get(id))
          .filter((c): c is BaseClient => !!c)
          .sort((a, b) => a.createdAt - b.createdAt);
        setBaseClients(list);
        setLoading(false);
      };

      const unsubscribes = ids.map((id) =>
        onSnapshot(
          doc(db, 'clients', id),
          (snap) => {
            if (snap.exists()) {
              found.set(id, toBaseClient(snap.id, snap.data()));
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
        setBaseClients(snapshot.docs.map((d) => toBaseClient(d.id, d.data())));
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

  // One subscription per client's content subcollection. Accurate by
  // construction, unlike denormalised counters; revisit around 50+ clients.
  const clientIdsKey = baseClients.map((c) => c.id).join(',');

  useEffect(() => {
    if (!uid) return;
    const ids = clientIdsKey ? clientIdsKey.split(',') : [];
    if (ids.length === 0) {
      setContentByClient({});
      return;
    }

    const unsubscribes = ids.map((id) =>
      onSnapshot(
        query(collection(db, 'clients', id, 'content'), orderBy('createdAt', 'asc')),
        (snap) => {
          const items = snap.docs.map((d) => ({
            ...(d.data() as Omit<ContentItem, 'id'>),
            id: d.id,
          }));
          setContentByClient((prev) => ({ ...prev, [id]: items }));
        },
        (err) => console.error(`[limi] content subscription for ${id} failed`, err)
      )
    );

    return () => unsubscribes.forEach((u) => u());
  }, [uid, clientIdsKey]);

  const clients = useMemo<Client[]>(
    () =>
      baseClients.map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: c.imageUrl,
        about: c.about,
        createdAt: c.createdAt,
        content: contentByClient[c.id] ?? [],
      })),
    [baseClients, contentByClient]
  );

  useEffect(() => {
    if (uid && clients.length > 0) writeClientsCache(uid, clients);
  }, [uid, clients]);

  // Clients still holding array items that aren't in the subcollection yet.
  const pendingMigration = useMemo(
    () =>
      baseClients.filter((c) => {
        const existing = new Set((contentByClient[c.id] ?? []).map((i) => i.id));
        return c.legacyContent.some((i) => !existing.has(i.id));
      }),
    [baseClients, contentByClient]
  );

  const addClient = useCallback(
    async (data: { name: string; imageUrl?: string; about: string }) => {
      await addDoc(collection(db, 'clients'), {
        name: data.name,
        imageUrl: data.imageUrl || '',
        about: data.about,
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
        mediaType: MediaType;
        caption?: string;
        hashtags?: string;
        platforms?: Platform[];
        notes?: string;
        status: ContentStatus;
        scheduledAt?: number;
        uploadedByEmail: string;
      }
    ) => {
      const id = generateId();
      const newItem: ContentItem = {
        id,
        title: data.title,
        driveLink: data.driveLink,
        driveFileId: data.driveFileId,
        mediaType: data.mediaType,
        caption: data.caption || '',
        hashtags: data.hashtags || '',
        platforms: data.platforms ?? [],
        notes: data.notes || '',
        status: data.status,
        createdAt: Date.now(),
        scheduledAt: data.scheduledAt || 0,
        uploadedByEmail: data.uploadedByEmail,
        clientReview: 'pending',
        reviewNote: '',
      };
      await setDoc(contentDoc(clientId, id), newItem);
    },
    []
  );

  // Every mutation below writes only the fields it changes, on the item's own
  // document. The previous implementation read the whole content array out of
  // local state and wrote it back, so two people acting at once silently
  // overwrote each other.
  const updateContent = useCallback(
    async (
      clientId: string,
      contentId: string,
      data: {
        title: string;
        driveLink: string;
        driveFileId: string;
        mediaType: MediaType;
        caption?: string;
        hashtags?: string;
        platforms?: Platform[];
        notes?: string;
        scheduledAt?: number;
      }
    ) => {
      await updateDoc(contentDoc(clientId, contentId), {
        title: data.title,
        driveLink: data.driveLink,
        driveFileId: data.driveFileId,
        mediaType: data.mediaType,
        caption: data.caption || '',
        hashtags: data.hashtags || '',
        platforms: data.platforms ?? [],
        notes: data.notes || '',
        scheduledAt: data.scheduledAt || 0,
      });
    },
    []
  );

  const deleteContent = useCallback(async (clientId: string, contentId: string) => {
    await deleteDoc(contentDoc(clientId, contentId));
  }, []);

  const updateContentStatus = useCallback(
    async (clientId: string, contentId: string, status: ContentStatus) => {
      await updateDoc(contentDoc(clientId, contentId), { status });
    },
    []
  );

  const updateClientReview = useCallback(
    async (
      clientId: string,
      contentId: string,
      review: ClientReview,
      reviewNote?: string
    ) => {
      // Exactly the two fields the security rules permit a client to touch.
      await updateDoc(contentDoc(clientId, contentId), {
        clientReview: review,
        reviewNote: reviewNote || '',
      });
    },
    []
  );

  // Copies each legacy array item into the subcollection. Idempotent: items
  // already migrated are skipped, so a partial failure is safe to re-run. The
  // legacy array is left in place as a rollback path.
  const migrateLegacyContent = useCallback(async () => {
    let migrated = 0;
    for (const client of pendingMigration) {
      const existing = new Set((contentByClient[client.id] ?? []).map((i) => i.id));
      const missing = client.legacyContent.filter((i) => !existing.has(i.id));
      if (missing.length === 0) continue;

      const batch = writeBatch(db);
      for (const item of missing) {
        batch.set(contentDoc(client.id, item.id), item);
      }
      await batch.commit();
      migrated += missing.length;
    }
    return migrated;
  }, [pendingMigration, contentByClient]);

  // Legacy items keep their caption copy in `notes`. Until this runs, the UI
  // falls back via captionOf(); afterwards `notes` means internal remarks only.
  const pendingCaptionMigration = useMemo(
    () =>
      clients.flatMap((c) =>
        c.content
          .filter((i) => i.caption === undefined && (i.notes ?? '') !== '')
          .map((i) => ({ clientId: c.id, item: i }))
      ),
    [clients]
  );

  const migrateLegacyCaptions = useCallback(async () => {
    if (pendingCaptionMigration.length === 0) return 0;
    const batch = writeBatch(db);
    for (const { clientId, item } of pendingCaptionMigration) {
      batch.update(contentDoc(clientId, item.id), {
        caption: item.notes ?? '',
        hashtags: '',
        platforms: [],
        notes: '',
      });
    }
    await batch.commit();
    return pendingCaptionMigration.length;
  }, [pendingCaptionMigration]);

  return {
    clients,
    loading,
    addClient,
    addContent,
    updateContent,
    deleteContent,
    updateContentStatus,
    updateClientReview,
    pendingMigration,
    migrateLegacyContent,
    pendingCaptionMigration,
    migrateLegacyCaptions,
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
