import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDocs,
  writeBatch,
  arrayUnion,
  query,
  where,
  orderBy,
  WriteBatch,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth, db, getProvisioningAuth } from './firebase';
import { useAuth } from './contexts/AuthContext';
import {
  AppUser, Business, BusinessDraft, Campaign, CampaignDraft, CampaignStatus, Client, ClientReview,
  Comment, ContentItem, ContentStatus, FolderColor, Idea, IdeaStatus, MediaType, Platform, Share,
} from './types';
import { generateId, generateShareToken, publicAppOrigin } from './utils';
import { DEFAULT_BUSINESS_ID, defaultBusinessFor, planBusinessMigration } from './campaigns';
import { DEFAULT_FOLDER_COLOR } from './folderColors';

// ─── Clients ─────────────────────────────────────────────────────────────────

// Content lives in clients/{clientId}/content/{itemId}. `legacyContent` holds
// whatever remains in the pre-migration array field so the migration can find
// it; it is not surfaced to the UI.
type BaseClient = Omit<Client, 'content' | 'businesses'> & { legacyContent: ContentItem[] };

function contentDoc(clientId: string, contentId: string) {
  return doc(db, 'clients', clientId, 'content', contentId);
}

function businessesCol(clientId: string) {
  return collection(db, 'clients', clientId, 'businesses');
}

function campaignsCol(clientId: string) {
  return collection(db, 'clients', clientId, 'campaigns');
}

// Firestore rejects a field whose value is undefined — the whole write fails —
// so optional fields are dropped rather than written empty. One level deep;
// nested objects are cleaned by their callers.
function defined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as T;
}

// A batch holds at most 500 writes. Chunked well under that so one large
// client cannot fail the business migration on size alone.
const BATCH_LIMIT = 400;

async function commitInChunks(writes: ((batch: WriteBatch) => void)[]) {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    writes.slice(i, i + BATCH_LIMIT).forEach((write) => write(batch));
    await batch.commit();
  }
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
      return `${publicAppOrigin()}/review/${token}`;
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
    async (data: { title: string; description: string; links: string[]; businessId?: string }) => {
      if (!clientId) return;
      const id = generateId();
      const idea: Idea = {
        id,
        title: data.title,
        description: data.description,
        links: data.links,
        ...(data.businessId ? { businessId: data.businessId } : {}),
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

  return { ideas, loading, addIdea, setIdeaStatus, deleteIdea, addIdeaComment };
}

// Marks an accepted idea as turned into content, so it stops offering "Make
// content". A plain function rather than part of useIdeas: the conversion
// finishes in the workspace page, which does not hold that hook. The old board
// never called the hook's version, so converted ideas kept the button forever.
export async function markIdeaConverted(clientId: string, ideaId: string, contentId: string) {
  await updateDoc(doc(ideasCol(clientId), ideaId), { convertedContentId: contentId });
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

// Deliverables are written whole, and their optional mediaType must be dropped
// when unset: Firestore rejects undefined even nested inside an array.
function cleanDraft(draft: CampaignDraft) {
  return defined({
    businessId: draft.businessId,
    name: draft.name,
    brief: draft.brief,
    status: draft.status,
    startDate: draft.startDate,
    endDate: draft.endDate,
    color: draft.color,
    deliverables: draft.deliverables.map((d) => defined({ ...d })),
  });
}

function campaignContent(clientId: string, campaignId: string) {
  return query(collection(db, 'clients', clientId, 'content'), where('campaignId', '==', campaignId));
}

export function useCampaigns(clientId: string | undefined) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(campaignsCol(clientId), orderBy('createdAt', 'asc')),
      (snap) => {
        setCampaigns(snap.docs.map((d) => ({ ...(d.data() as Omit<Campaign, 'id'>), id: d.id })));
        setLoading(false);
      },
      (err) => {
        console.error('[limi] campaigns subscription failed', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [clientId]);

  const addCampaign = useCallback(
    async (draft: CampaignDraft) => {
      if (!clientId) return '';
      const ref = doc(campaignsCol(clientId));
      await setDoc(ref, { ...cleanDraft(draft), createdAt: Date.now() });
      return ref.id;
    },
    [clientId]
  );

  // Content in a campaign carries that campaign's business. Moving a campaign
  // to another business moves its content in the same batch, so the two can
  // never disagree.
  const updateCampaign = useCallback(
    async (campaignId: string, draft: CampaignDraft) => {
      if (!clientId) return;
      const previous = campaigns.find((c) => c.id === campaignId);
      const batch = writeBatch(db);
      batch.update(doc(campaignsCol(clientId), campaignId), {
        ...cleanDraft(draft),
        // A cleared date has to be removed, not merely left out of the update.
        ...(draft.startDate === undefined ? { startDate: deleteField() } : {}),
        ...(draft.endDate === undefined ? { endDate: deleteField() } : {}),
      });
      if (previous && previous.businessId !== draft.businessId) {
        const linked = await getDocs(campaignContent(clientId, campaignId));
        linked.docs.forEach((d) => batch.update(d.ref, { businessId: draft.businessId }));
      }
      await batch.commit();
    },
    [clientId, campaigns]
  );

  const setCampaignStatus = useCallback(
    async (campaignId: string, status: CampaignStatus) => {
      if (!clientId) return;
      await updateDoc(doc(campaignsCol(clientId), campaignId), { status });
    },
    [clientId]
  );

  // Deleting a campaign never deletes its content: the items stay on the board,
  // just no longer grouped. One batch, so no item is left pointing at a campaign
  // that is gone — and if one ever is, campaignIdOf() ignores it.
  const deleteCampaign = useCallback(
    async (campaignId: string) => {
      if (!clientId) return;
      const linked = await getDocs(campaignContent(clientId, campaignId));
      const batch = writeBatch(db);
      linked.docs.forEach((d) =>
        batch.update(d.ref, { campaignId: deleteField(), deliverableId: deleteField() })
      );
      batch.delete(doc(campaignsCol(clientId), campaignId));
      await batch.commit();
    },
    [clientId]
  );

  return { campaigns, loading, addCampaign, updateCampaign, setCampaignStatus, deleteCampaign };
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
    color: data.color as FolderColor | undefined,
    createdAt: data.createdAt as number,
    legacyContent: (data.content as ContentItem[]) ?? [],
  };
}

// Cached clients are already-merged reads, so they carry no legacy array —
// which keeps a cold start from falsely reporting a pending migration.
function toBaseFromCache(c: CachedClient): BaseClient {
  return {
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    about: c.about,
    color: c.color,
    createdAt: c.createdAt,
    legacyContent: [],
  };
}

// Keyed per user: one browser can be shared, and a client-role user must not
// start up showing an admin's cached list.
function clientsCacheKey(uid: string) {
  return `limi_clients_v2_${uid}`;
}

// What the cache holds. Typed apart from Client because entries written before
// businesses existed have no `businesses`.
type CachedClient = Omit<Client, 'businesses'> & { businesses?: Business[] };

function readClientsCache(uid: string | null): CachedClient[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(clientsCacheKey(uid));
    return raw ? (JSON.parse(raw) as CachedClient[]) : [];
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

  // Parsed once: every initial list below is seeded from the same read.
  const [cached] = useState(() => readClientsCache(uid));
  const [baseClients, setBaseClients] = useState<BaseClient[]>(() => cached.map(toBaseFromCache));
  const [contentByClient, setContentByClient] = useState<Record<string, ContentItem[]>>(() =>
    Object.fromEntries(cached.map((c) => [c.id, c.content]))
  );
  // Caches written before businesses existed have none, hence the fallback.
  const [businessesByClient, setBusinessesByClient] = useState<Record<string, Business[]>>(() =>
    Object.fromEntries(cached.map((c) => [c.id, c.businesses ?? []]))
  );
  // Which listeners have delivered a live snapshot, keyed `content:<id>` and
  // `businesses:<id>`. The cache seeds the lists above, so without this a cold
  // start would plan the business migration against stale data.
  const [loaded, setLoaded] = useState<Record<string, true>>({});
  const markLoaded = useCallback((key: string) => {
    setLoaded((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);
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

  // One listener per client for its content, and one more for its businesses
  // (below) — every client's, because the business migration has to see them
  // all. Accurate by construction, unlike denormalised counters; revisit
  // around 50+ clients, when two listeners each start to add up.
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
          markLoaded(`content:${id}`);
        },
        (err) => console.error(`[limi] content subscription for ${id} failed`, err)
      )
    );

    return () => unsubscribes.forEach((u) => u());
  }, [uid, clientIdsKey, markLoaded]);

  // Same shape as the content subscription: one listener per client, oldest
  // business first, because the first one is the default.
  useEffect(() => {
    if (!uid) return;
    const ids = clientIdsKey ? clientIdsKey.split(',') : [];
    if (ids.length === 0) {
      setBusinessesByClient({});
      return;
    }

    const unsubscribes = ids.map((id) =>
      onSnapshot(
        query(businessesCol(id), orderBy('createdAt', 'asc')),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Business, 'id'>), id: d.id }));
          setBusinessesByClient((prev) => ({ ...prev, [id]: list }));
          markLoaded(`businesses:${id}`);
        },
        (err) => console.error(`[limi] businesses subscription for ${id} failed`, err)
      )
    );

    return () => unsubscribes.forEach((u) => u());
  }, [uid, clientIdsKey, markLoaded]);

  const clients = useMemo<Client[]>(
    () =>
      baseClients.map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: c.imageUrl,
        about: c.about,
        color: c.color,
        createdAt: c.createdAt,
        content: contentByClient[c.id] ?? [],
        businesses: businessesByClient[c.id] ?? [],
      })),
    [baseClients, contentByClient, businessesByClient]
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

  // Only clients whose content and businesses have both arrived live. Planning
  // against the cache could create a second default business, or stamp an
  // item that has since been deleted — and one bad update fails its batch.
  const pendingBusinessMigration = useMemo(
    () =>
      planBusinessMigration(
        clients.filter((c) => loaded[`content:${c.id}`] && loaded[`businesses:${c.id}`])
      ),
    [clients, loaded]
  );

  // The client and its first business are written in one batch, so no client
  // ever exists without a business.
  const addClient = useCallback(
    async (data: { name: string; imageUrl?: string; about: string; color?: FolderColor }) => {
      const clientRef = doc(collection(db, 'clients'));
      const now = Date.now();
      const batch = writeBatch(db);
      batch.set(clientRef, {
        name: data.name,
        imageUrl: data.imageUrl || '',
        about: data.about,
        color: data.color ?? DEFAULT_FOLDER_COLOR,
        createdAt: now,
      });
      batch.set(doc(businessesCol(clientRef.id), DEFAULT_BUSINESS_ID), defaultBusinessFor(data, now));
      await batch.commit();
    },
    []
  );

  // Writes only the editable fields, so createdAt and anything added to the
  // document later survive an edit untouched.
  const updateClient = useCallback(
    async (
      clientId: string,
      data: { name: string; imageUrl?: string; about: string; color?: FolderColor }
    ) => {
      await updateDoc(doc(db, 'clients', clientId), {
        name: data.name,
        imageUrl: data.imageUrl || '',
        about: data.about,
        ...(data.color ? { color: data.color } : {}),
      });
    },
    []
  );

  const addBusiness = useCallback(async (clientId: string, draft: BusinessDraft) => {
    const ref = doc(businessesCol(clientId));
    await setDoc(
      ref,
      defined({
        name: draft.name,
        color: draft.color,
        logoUrl: draft.logoUrl || undefined,
        about: draft.about,
        createdAt: Date.now(),
      })
    );
    return ref.id;
  }, []);

  const updateBusiness = useCallback(
    async (clientId: string, businessId: string, draft: BusinessDraft) => {
      await updateDoc(doc(businessesCol(clientId), businessId), {
        name: draft.name,
        color: draft.color,
        about: draft.about,
        logoUrl: draft.logoUrl || deleteField(),
      });
    },
    []
  );

  // The UI only offers this for a business with no content and no campaigns
  // that is not the first one — see businessDeleteBlocker(). Ideas do not
  // block it: any filed under this business are moved to the first business
  // (dropping their businessId does exactly that) in the same batch as the
  // delete, so none is left pointing at a business that is gone.
  const deleteBusiness = useCallback(async (clientId: string, businessId: string) => {
    const ideas = await getDocs(query(ideasCol(clientId), where('businessId', '==', businessId)));
    const batch = writeBatch(db);
    ideas.docs.forEach((d) => batch.update(d.ref, { businessId: deleteField() }));
    batch.delete(doc(businessesCol(clientId), businessId));
    await batch.commit();
  }, []);

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
        businessId?: string;
        campaignId?: string | null;
        deliverableId?: string | null;
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
        businessId: data.businessId,
        campaignId: data.campaignId ?? undefined,
        deliverableId: data.deliverableId ?? undefined,
      };
      // The three filing fields are optional; defined() drops the unset ones.
      await setDoc(contentDoc(clientId, id), defined(newItem));
      return id;
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
        businessId?: string;
        /** undefined leaves it as it is; null takes the item out of its campaign. */
        campaignId?: string | null;
        deliverableId?: string | null;
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
        // Only ever set, never cleared: content always belongs to a business.
        ...(data.businessId ? { businessId: data.businessId } : {}),
        ...(data.campaignId === undefined
          ? {}
          : { campaignId: data.campaignId ?? deleteField() }),
        ...(data.deliverableId === undefined
          ? {}
          : { deliverableId: data.deliverableId ?? deleteField() }),
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

  // Gives each unmigrated client a default business and stamps its items with
  // it. Idempotent: the business goes out in the first chunk, so a rerun after
  // a partial failure finds it and stamps only what is still missing.
  const migrateBusinesses = useCallback(async () => {
    let stamped = 0;
    for (const step of pendingBusinessMigration) {
      const client = clients.find((c) => c.id === step.clientId);
      if (!client) continue;

      const writes: ((batch: WriteBatch) => void)[] = [];
      let businessId = client.businesses[0]?.id;
      if (step.createDefault || !businessId) {
        const ref = doc(businessesCol(client.id), DEFAULT_BUSINESS_ID);
        businessId = ref.id;
        writes.push((b) => b.set(ref, defaultBusinessFor(client, Date.now())));
      }
      // A const, so the closures below see a string rather than string | undefined.
      const target = businessId;
      for (const contentId of step.contentIds) {
        writes.push((b) => b.update(contentDoc(client.id, contentId), { businessId: target }));
      }

      await commitInChunks(writes);
      stamped += step.contentIds.length;
    }
    return stamped;
  }, [pendingBusinessMigration, clients]);

  return {
    clients,
    loading,
    addClient,
    updateClient,
    addBusiness,
    updateBusiness,
    deleteBusiness,
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
    pendingBusinessMigration,
    migrateBusinesses,
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
