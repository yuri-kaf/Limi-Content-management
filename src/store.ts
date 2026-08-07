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
  arrayUnion,
  query,
  where,
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
  AppUser, Client, ClientReview, Comment, ContentItem, ContentStatus, Idea, IdeaStatus,
  MediaType, Platform, Share,
} from './types';
import { generateId, generateShareToken } from './utils';

// ─── Clients ─────────────────────────────────────────────────────────────────

// Content lives in clients/{clientId}/content/{itemId}. `legacyContent` holds
// whatever remains in the pre-migration array field so the migration can find
// it; it is not surfaced to the UI.
type BaseClient = Omit<Client, 'content'> & { legacyContent: ContentItem[] };

function contentDoc(clientId: string, contentId: string) {
  return doc(db, 'clients', clientId, 'content', contentId);
}

// Comments hang off content items and ideas alike — one primitive, two parents.
export type CommentParent = 'content' | 'ideas';

function commentsCol(clientId: string, parentId: string, parent: CommentParent = 'content') {
  return collection(db, 'clients', clientId, parent, parentId, 'comments');
}

function ideasCol(clientId: string) {
  return collection(db, 'clients', clientId, 'ideas');
}

// ─── Public review links ─────────────────────────────────────────────────────

// Rules can't see a token the caller merely holds — only one that's in the
// path. So a share can't grant access to the real content document; it carries
// a snapshot instead, and decisions are written back by the app (see
// useShareReconciler) the next time a team member is signed in.
export function useShare(token: string | undefined) {
  const [share, setShare] = useState<Share | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!token) {
      setState('missing');
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'shares', token),
      (snap) => {
        if (!snap.exists()) {
          setShare(null);
          setState('missing');
          return;
        }
        setShare({ ...(snap.data() as Omit<Share, 'id'>), id: snap.id });
        setState('ready');
      },
      (err) => {
        // A revoked link fails the read rule, which lands here.
        console.error('[limi] share subscription failed', err);
        setState('missing');
      }
    );
    return unsubscribe;
  }, [token]);

  const submitDecision = useCallback(
    async (decision: ClientReview, note: string) => {
      if (!token) return;
      await updateDoc(doc(db, 'shares', token), {
        decision,
        decisionNote: note,
        decidedAt: Date.now(),
      });
    },
    [token]
  );

  return { share, state, submitDecision };
}

export function useShares(clientId: string | undefined, enabled: boolean) {
  const [shares, setShares] = useState<Share[]>([]);

  useEffect(() => {
    if (!clientId || !enabled) {
      setShares([]);
      return;
    }
    const unsubscribe = onSnapshot(
      query(collection(db, 'shares'), where('clientId', '==', clientId)),
      (snap) => setShares(snap.docs.map((d) => ({ ...(d.data() as Omit<Share, 'id'>), id: d.id }))),
      (err) => console.error('[limi] shares subscription failed', err)
    );
    return unsubscribe;
  }, [clientId, enabled]);

  return shares;
}

export function useShareActions(clientId: string | undefined, clientName: string) {
  const { currentUser } = useAuth();

  const createShare = useCallback(
    async (item: ContentItem) => {
      if (!clientId) return '';
      const token = generateShareToken();
      const share: Omit<Share, 'id'> = {
        clientId,
        contentId: item.id,
        clientName,
        title: item.title,
        mediaLink: item.driveLink,
        mediaType: item.mediaType ?? 'video',
        caption: item.caption ?? item.notes ?? '',
        hashtags: item.hashtags ?? '',
        createdAt: Date.now(),
        createdByEmail: currentUser?.email ?? '',
        revoked: false,
      };
      await setDoc(doc(db, 'shares', token), share);
      return `${window.location.origin}/review/${token}`;
    },
    [clientId, clientName, currentUser]
  );

  const revokeShare = useCallback(async (token: string) => {
    await updateDoc(doc(db, 'shares', token), { revoked: true });
  }, []);

  return { createShare, revokeShare };
}

// Writes decisions made through public links back onto the content items.
// Runs for signed-in team members only — there is no server to do it.
export function useShareReconciler(clientId: string | undefined, enabled: boolean) {
  const shares = useShares(clientId, enabled);

  useEffect(() => {
    if (!enabled || !clientId) return;
    const unsynced = shares.filter(
      (s) => s.decision && s.decidedAt && (s.syncedAt ?? 0) < s.decidedAt
    );
    if (unsynced.length === 0) return;

    (async () => {
      for (const s of unsynced) {
        try {
          await updateDoc(contentDoc(s.clientId, s.contentId), {
            clientReview: s.decision,
            reviewNote: s.decisionNote ?? '',
          });
          await writeSystemComment(
            s.clientId,
            s.contentId,
            `${s.decision} this via a shared link`,
            { email: s.createdByEmail, name: 'A reviewer' }
          );
          await updateDoc(doc(db, 'shares', s.id), { syncedAt: Date.now() });
        } catch (err) {
          console.error('[limi] could not sync a shared review decision', err);
        }
      }
    })();
  }, [shares, clientId, enabled]);
}

// ─── Ideas ───────────────────────────────────────────────────────────────────

export function useIdeas(clientId: string | undefined) {
  const { currentUser } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setIdeas([]);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      query(ideasCol(clientId), orderBy('createdAt', 'desc')),
      (snap) => {
        setIdeas(snap.docs.map((d) => ({ ...(d.data() as Omit<Idea, 'id'>), id: d.id })));
        setLoading(false);
      },
      (err) => {
        console.error('[limi] ideas subscription failed', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [clientId]);

  const addIdea = useCallback(
    async (data: { title: string; description: string; links: string[] }) => {
      if (!clientId) return;
      const id = generateId();
      const idea: Idea = {
        id,
        title: data.title,
        description: data.description,
        links: data.links,
        status: 'new',
        createdByEmail: currentUser?.email ?? '',
        createdByName: currentUser?.name ?? 'Someone',
        createdAt: Date.now(),
      };
      await setDoc(doc(ideasCol(clientId), id), idea);
    },
    [clientId, currentUser]
  );

  const setIdeaStatus = useCallback(
    async (ideaId: string, status: IdeaStatus, decisionNote?: string) => {
      if (!clientId) return;
      await updateDoc(doc(ideasCol(clientId), ideaId), {
        status,
        decisionNote: decisionNote ?? '',
      });
    },
    [clientId]
  );

  const markConverted = useCallback(
    async (ideaId: string, contentId: string) => {
      if (!clientId) return;
      await updateDoc(doc(ideasCol(clientId), ideaId), { convertedContentId: contentId });
    },
    [clientId]
  );

  const deleteIdea = useCallback(
    async (ideaId: string) => {
      if (!clientId) return;
      await deleteDoc(doc(ideasCol(clientId), ideaId));
    },
    [clientId]
  );

  const addIdeaComment = useCallback(
    async (ideaId: string, body: string) => {
      if (!clientId) return;
      const id = generateId();
      const comment: Comment = {
        id,
        kind: 'user',
        body,
        authorEmail: currentUser?.email ?? '',
        authorName: currentUser?.name ?? 'Someone',
        createdAt: Date.now(),
      };
      await setDoc(doc(commentsCol(clientId, ideaId, 'ideas'), id), comment);
    },
    [clientId, currentUser]
  );

  return { ideas, loading, addIdea, setIdeaStatus, markConverted, deleteIdea, addIdeaComment };
}

const STATUS_LABELS: Record<ContentStatus, string> = {
  editing: 'Editing',
  review: 'Review',
  'to-post': 'To Post',
  posted: 'Posted',
};

interface Actor {
  email: string;
  name: string;
}

// System entries double as the activity trail. Failures here must never fail
// the action that triggered them — losing a log line is better than losing the
// status change the user actually asked for.
async function writeSystemComment(
  clientId: string,
  contentId: string,
  body: string,
  actor: Actor
) {
  try {
    const id = generateId();
    const entry: Comment = {
      id,
      kind: 'system',
      body,
      authorEmail: actor.email,
      authorName: actor.name,
      createdAt: Date.now(),
    };
    await setDoc(doc(commentsCol(clientId, contentId), id), entry);
  } catch (err) {
    console.error('[limi] could not write activity entry', err);
  }
}

// ─── Comments ────────────────────────────────────────────────────────────────

export function useComments(
  clientId: string | undefined,
  contentId: string | undefined,
  parent: CommentParent = 'content'
) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId || !contentId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(commentsCol(clientId, contentId, parent), orderBy('createdAt', 'asc')),
      (snap) => {
        setComments(
          snap.docs.map((d) => ({ ...(d.data() as Omit<Comment, 'id'>), id: d.id }))
        );
        setLoading(false);
      },
      (err) => {
        console.error('[limi] comments subscription failed', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [clientId, contentId, parent]);

  return { comments, loading };
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
  const me = useMemo<Actor>(
    () => ({ email: currentUser?.email ?? '', name: currentUser?.name ?? 'Someone' }),
    [currentUser]
  );

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
      const previous = clients
        .find((c) => c.id === clientId)
        ?.content.find((i) => i.id === contentId);

      // A changed link means a new cut, not a correction — keep the old one so
      // the revision history survives. arrayUnion appends atomically, so this
      // isn't the read-modify-write pattern that used to lose data.
      const linkChanged = !!previous && previous.driveLink !== data.driveLink;

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
        ...(linkChanged
          ? {
              versions: arrayUnion({
                link: previous!.driveLink,
                mediaType: previous!.mediaType ?? 'video',
                replacedAt: Date.now(),
                replacedByEmail: me.email,
              }),
            }
          : {}),
      });

      if (linkChanged) {
        const version = (previous?.versions?.length ?? 0) + 2;
        await writeSystemComment(clientId, contentId, `uploaded v${version}`, me);
      }
    },
    [clients, me]
  );

  const deleteContent = useCallback(async (clientId: string, contentId: string) => {
    await deleteDoc(contentDoc(clientId, contentId));
  }, []);

  const updateContentStatus = useCallback(
    async (clientId: string, contentId: string, status: ContentStatus) => {
      await updateDoc(contentDoc(clientId, contentId), { status });
      await writeSystemComment(clientId, contentId, `moved this to ${STATUS_LABELS[status]}`, me);
    },
    [me]
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
      await writeSystemComment(
        clientId,
        contentId,
        reviewNote ? `${review} this — "${reviewNote}"` : `${review} this`,
        me
      );
    },
    [me]
  );

  const addComment = useCallback(
    async (clientId: string, contentId: string, body: string, atSeconds?: number) => {
      const id = generateId();
      const comment: Comment = {
        id,
        kind: 'user',
        body,
        authorEmail: me.email,
        authorName: me.name,
        createdAt: Date.now(),
        ...(atSeconds !== undefined ? { atSeconds } : {}),
      };
      await setDoc(doc(commentsCol(clientId, contentId), id), comment);
    },
    [me]
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
    addComment,
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
