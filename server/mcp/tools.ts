import './env.js';
import { z } from 'zod';
import type { CallToolResult } from '@modelcontextprotocol/server';
import type { ContentItem } from '../../src/types.js';
import {
  businessIdOf, campaignIdOf, campaignProgress, campaignStatusMeta, deliverableProgress, formatDateRange, NO_CAMPAIGN,
  scopeContent, sortCampaigns,
} from '../../src/campaigns.js';
import { buildToday, isDueWithin, isLate, slotLabel, type TodayEntry } from '../../src/today.js';
import { captionOf, getMediaInfo, mediaTypeOf, STAGES, teamNotesOf } from '../../src/utils.js';
import { FirestoreError } from './firestore.js';
import {
  addComment, addIdea, createContent, findContent, kathmanduIso, kathmanduText, LimiError, listClients,
  loadComments, loadIdeas, loadWorkspace, mediaTypeFor, moveContent, parseWhen, pick, plainMessage,
  reviewContent, stageLabel, updateContent, type ClientData, type Session,
} from './limi.js';

// ─── Shapes ──────────────────────────────────────────────────────────────────

export interface LimiTool {
  name: string;
  title: string;
  description: string;
  input: z.ZodObject;
  readOnly: boolean;
  /** Overwrites what is already there (a stage, a field, a review), so clients may confirm first. */
  destructive?: boolean;
  run(session: Session, args: never): Promise<unknown>;
}

function defineTool<S extends z.ZodObject>(
  tool: Omit<LimiTool, 'input' | 'run'> & { input: S; run(session: Session, args: z.output<S>): Promise<unknown> }
): LimiTool {
  return tool;
}

/** Runs a tool and turns any failure into one plain sentence. */
export async function runTool(tool: LimiTool, session: Session, args: unknown): Promise<CallToolResult> {
  try {
    const out = await (tool.run as (s: Session, a: unknown) => Promise<unknown>)(session, args);
    return { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] };
  } catch (err) {
    // Refusals and missing posts are answers, not faults.
    const expected =
      err instanceof LimiError || (err instanceof FirestoreError && (err.status === 403 || err.status === 404));
    if (!expected) console.error(`[limi-mcp] ${tool.name} failed`, err);
    return { content: [{ type: 'text', text: plainMessage(err) }], isError: true };
  }
}

const WRITES = 'This changes data in Limi: confirm with the person before calling it.';
const DATES = 'Dates are Kathmandu time, written 2026-10-20 or 2026-10-20 15:30.';

const stage = z.enum(['editing', 'review', 'to-post', 'posted']);
const platform = z.enum(['instagram', 'facebook', 'tiktok']);
const postId = z.string().min(1).describe('The post id, from list_content or get_today.');

// ─── Presenting ──────────────────────────────────────────────────────────────

function when(ms: number | undefined, now: number) {
  if (!ms || ms <= 0) return null;
  return { iso: kathmanduIso(ms), kathmandu: kathmanduText(ms), relative: slotLabel(ms, now)?.text ?? '' };
}

function summary(client: ClientData, item: ContentItem, now: number) {
  const businessId = businessIdOf(item, client.businesses);
  const campaignId = campaignIdOf(item, client.campaigns);
  return {
    id: item.id,
    title: item.title,
    client: client.name,
    ...(client.businesses.length > 1
      ? { business: client.businesses.find((b) => b.id === businessId)?.name }
      : {}),
    ...(campaignId ? { campaign: client.campaigns.find((c) => c.id === campaignId)?.name } : {}),
    stage: stageLabel(item.status),
    review: item.clientReview,
    scheduled: when(item.scheduledAt, now),
    late: isLate(item, now),
  };
}

const entrySummary = (clients: ClientData[], now: number) => (e: TodayEntry) =>
  summary(clients.find((c) => c.id === e.clientId)!, e.item, now);

// Scheduled first, soonest first; then the unscheduled, newest first.
function bySlot(a: ContentItem, b: ContentItem): number {
  const sa = a.scheduledAt ?? 0;
  const sb = b.scheduledAt ?? 0;
  if (sa > 0 && sb > 0) return sa - sb;
  if (sa > 0) return -1;
  if (sb > 0) return 1;
  return b.createdAt - a.createdAt;
}

function scopeClients(clients: ClientData[], query: string | undefined): ClientData[] {
  return query ? [pick(clients, query, 'client')] : clients;
}

/** A business or campaign by name across clients; a shared name asks which client. */
function pickAcross<T extends { id: string; name: string }>(
  clients: ClientData[],
  query: string,
  what: string,
  of: (c: ClientData) => T[]
): { client: ClientData; found: T } {
  const all = clients.flatMap((client) =>
    of(client).map((found) => ({ id: found.id, name: found.name, client, found }))
  );
  const hit = pick(all, query, what, (x) => (clients.length > 1 ? `${x.name} (${x.client.name})` : x.name));
  return { client: hit.client, found: hit.found };
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const whoami = defineTool({
  name: 'whoami',
  title: 'Who am I in Limi',
  description: 'The signed-in Limi person: name, email, role, and the clients this login can see.',
  readOnly: true,
  input: z.object({}),
  async run(session) {
    const clients = await listClients(session);
    const { name, email, role } = session.profile;
    return { name, email, role, clients: clients.map((c) => ({ id: c.id, name: c.name })) };
  },
});

const listClientsTool = defineTool({
  name: 'list_clients',
  title: 'List clients',
  description: 'Every client this login can see, with its businesses and how many posts sit in each stage.',
  readOnly: true,
  input: z.object({}),
  async run(session) {
    const now = session.now();
    const clients = await loadWorkspace(session);
    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      businesses: c.businesses.map((b) => ({ id: b.id, name: b.name })),
      stages: Object.fromEntries(STAGES.map((s) => [s.label, c.content.filter((i) => i.status === s.id).length])),
      awaitingReview: c.content.filter((i) => i.status === 'review' && i.clientReview === 'pending').length,
      overdue: c.content.filter((i) => isLate(i, now)).length,
    }));
  },
});

const listContent = defineTool({
  name: 'list_content',
  title: 'List posts',
  description:
    'Posts, filtered. "when" is overdue, today, next7, next31 or unscheduled; needs_review means in Review ' +
    'with no decision yet; search matches the title and caption. At most 50 are returned, with the total.',
  readOnly: true,
  input: z.object({
    client: z.string().optional().describe('Client name or id.'),
    business: z.string().optional().describe('Business name or id.'),
    campaign: z.string().optional().describe('Campaign name or id, or "none" for posts outside every campaign.'),
    stage: stage.optional(),
    when: z.enum(['overdue', 'today', 'next7', 'next31', 'unscheduled']).optional(),
    needs_review: z.boolean().optional(),
    search: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async run(session, args) {
    const now = session.now();
    let clients = scopeClients(await loadWorkspace(session), args.client);
    let businessId: string | undefined;
    let campaignId: string | undefined;
    if (args.business) {
      const hit = pickAcross(clients, args.business, 'business', (c) => c.businesses);
      clients = [hit.client];
      businessId = hit.found.id;
    }
    if (args.campaign && args.campaign.trim().toLowerCase() === 'none') {
      campaignId = NO_CAMPAIGN;
    } else if (args.campaign) {
      const hit = pickAcross(clients, args.campaign, 'campaign', (c) => c.campaigns);
      clients = [hit.client];
      campaignId = hit.found.id;
    }
    const q = args.search?.trim().toLowerCase();
    const matches = clients.flatMap((client) =>
      scopeContent(client.content, { businessId, campaignId }, client.businesses, client.campaigns)
        .filter((i) => !args.stage || i.status === args.stage)
        .filter((i) => !args.needs_review || (i.status === 'review' && i.clientReview === 'pending'))
        .filter((i) => {
          switch (args.when) {
            case 'overdue': return isLate(i, now);
            case 'today': return isDueWithin(i, now, 1);
            case 'next7': return isDueWithin(i, now, 7);
            case 'next31': return isDueWithin(i, now, 31);
            case 'unscheduled': return !(i.scheduledAt && i.scheduledAt > 0) && i.status !== 'posted';
            default: return true;
          }
        })
        .filter((i) => !q || i.title.toLowerCase().includes(q) || captionOf(i).toLowerCase().includes(q))
        .map((item) => ({ client, item }))
    );
    matches.sort((a, b) => bySlot(a.item, b.item));
    const shown = matches.slice(0, args.limit ?? 50);
    return {
      total: matches.length,
      shown: shown.length,
      posts: shown.map(({ client, item }) => summary(client, item, now)),
    };
  },
});

const getContent = defineTool({
  name: 'get_content',
  title: 'Get one post',
  description: 'One post with every field, its earlier versions and its comment thread.',
  readOnly: true,
  input: z.object({ id: postId }),
  async run(session, args) {
    const now = session.now();
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    const comments = await loadComments(session, client.id, item.id);
    const campaign = client.campaigns.find((c) => c.id === campaignIdOf(item, client.campaigns));
    const isClient = session.profile.role === 'client';
    return {
      ...summary(client, item, now),
      business: client.businesses.find((b) => b.id === businessIdOf(item, client.businesses))?.name,
      ...(campaign
        ? { deliverable: campaign.deliverables.find((d) => d.id === item.deliverableId)?.label }
        : {}),
      reviewNote: item.reviewNote || '',
      caption: captionOf(item),
      hashtags: item.hashtags ?? '',
      platforms: item.platforms ?? [],
      // Internal remarks: the app never shows them to a client.
      ...(isClient ? {} : { notes: teamNotesOf(item) }),
      link: item.driveLink,
      media: { type: mediaTypeOf(item), host: getMediaInfo(item.driveLink).label },
      created: when(item.createdAt, now),
      uploadedBy: item.uploadedByEmail,
      versions: (item.versions ?? []).map((v, n) => ({
        version: n + 1,
        link: v.link,
        replaced: when(v.replacedAt, now),
        replacedBy: v.replacedByEmail,
      })),
      comments: comments.map((c) => ({
        kind: c.kind,
        author: c.authorName,
        body: c.body,
        at: when(c.createdAt, now),
        ...(c.atSeconds !== undefined ? { atSeconds: c.atSeconds } : {}),
      })),
    };
  },
});

const getToday = defineTool({
  name: 'get_today',
  title: 'Today',
  description:
    'The Today queue: posts waiting for a review decision, declined posts that need rework, posts going ' +
    'out within a week, and overdue posts.',
  readOnly: true,
  input: z.object({}),
  async run(session) {
    const now = session.now();
    const clients = await loadWorkspace(session);
    const groups = buildToday(clients, now);
    const present = entrySummary(clients, now);
    return {
      today: kathmanduText(now),
      needsReview: groups.waitingOnClient.map(present),
      needsRework: groups.needsRework.map(present),
      goingOutSoon: groups.goingOutSoon.map(present),
      overdue: clients.flatMap((c) => c.content.filter((i) => isLate(i, now)).map((i) => summary(c, i, now))),
    };
  },
});

const listCampaigns = defineTool({
  name: 'list_campaigns',
  title: 'List campaigns',
  description: 'Campaigns per client: status, dates and progress (posted of planned).',
  readOnly: true,
  input: z.object({
    client: z.string().optional().describe('Client name or id.'),
    status: z.enum(['planning', 'live', 'completed']).optional(),
  }),
  async run(session, args) {
    const clients = scopeClients(await loadWorkspace(session), args.client);
    const isClient = session.profile.role === 'client';
    return clients.map((client) => ({
      client: client.name,
      campaigns: sortCampaigns(client.campaigns)
        .filter((c) => !args.status || c.status === args.status)
        .map((c) => {
          const progress = campaignProgress(c, client.content);
          return {
            id: c.id,
            name: c.name,
            business: client.businesses.find((b) => b.id === c.businessId)?.name,
            status: campaignStatusMeta(c.status).label,
            dates: formatDateRange(c.startDate, c.endDate),
            progress: `${progress.posted} of ${progress.planned} posted`,
            deliverables: deliverableProgress(c, client.content).map((d) => ({
              label: d.deliverable.label,
              made: d.items.length,
              posted: d.posted,
              planned: d.planned,
            })),
            // Briefs stay internal, as in the client portal.
            ...(isClient ? {} : { brief: c.brief }),
          };
        }),
    }));
  },
});

const listIdeas = defineTool({
  name: 'list_ideas',
  title: 'List ideas',
  description: 'Ideas per client, newest first, optionally only one status.',
  readOnly: true,
  input: z.object({
    client: z.string().optional().describe('Client name or id.'),
    status: z.enum(['new', 'accepted', 'declined']).optional(),
  }),
  async run(session, args) {
    const now = session.now();
    const clients = scopeClients(await loadWorkspace(session), args.client);
    return Promise.all(
      clients.map(async (client) => ({
        client: client.name,
        ideas: (await loadIdeas(session, client.id))
          .filter((i) => !args.status || i.status === args.status)
          .map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            links: i.links ?? [],
            status: i.status,
            ...(client.businesses.length > 1
              ? { business: client.businesses.find((b) => b.id === businessIdOf(i, client.businesses))?.name }
              : {}),
            by: i.createdByName,
            created: when(i.createdAt, now),
            ...(i.decisionNote ? { decisionNote: i.decisionNote } : {}),
          })),
      }))
    );
  },
});

const createContentTool = defineTool({
  name: 'create_content',
  title: 'Create a post',
  description: `Adds a post to a client's board, in Editing unless another stage is given. ${DATES} ${WRITES}`,
  readOnly: false,
  input: z.object({
    client: z.string().min(1).describe('Client name or id.'),
    title: z.string().min(1).max(200),
    business: z.string().optional().describe("Business name or id. Defaults to the client's first business."),
    campaign: z.string().optional().describe('Campaign name or id. Files the post under that campaign.'),
    stage: stage.optional(),
    scheduled: z.string().optional().describe('When it goes out.'),
    caption: z.string().optional(),
    hashtags: z.string().optional(),
    platforms: z.array(platform).optional(),
    link: z.string().optional().describe('Drive (or other) link to the media.'),
    media_type: z.enum(['video', 'graphic']).optional().describe('Read from the link when left out.'),
    notes: z.string().optional().describe('Internal remarks for the team.'),
  }),
  async run(session, args) {
    const client = pick(await loadWorkspace(session), args.client, 'client');
    const campaign = args.campaign ? pick(client.campaigns, args.campaign, 'campaign') : undefined;
    const business = args.business ? pick(client.businesses, args.business, 'business') : undefined;
    if (campaign && business && campaign.businessId !== business.id) {
      throw new LimiError(`${campaign.name} belongs to another business than ${business.name}.`);
    }
    // A campaign files the post under the campaign's business, as the form does.
    const businessId = campaign?.businessId ?? business?.id ?? client.businesses[0]?.id;
    if (!businessId) throw new LimiError(`${client.name} has no business yet. Add one in the app first.`);
    const link = args.link?.trim() ?? '';
    const item = await createContent(session, client.id, {
      title: args.title.trim(),
      driveLink: link,
      mediaType: args.media_type ?? mediaTypeFor(link),
      caption: args.caption,
      hashtags: args.hashtags,
      platforms: args.platforms,
      notes: args.notes,
      status: args.stage ?? 'editing',
      scheduledAt: args.scheduled ? parseWhen(args.scheduled) : undefined,
      businessId,
      campaignId: campaign?.id,
    });
    return { created: summary({ ...client, content: [...client.content, item] }, item, session.now()) };
  },
});

const updateContentTool = defineTool({
  name: 'update_content',
  title: 'Edit a post',
  description:
    'Changes any of title, schedule, caption, hashtags, platforms, notes and link. A new link keeps the ' +
    `old one as a version and notes "uploaded vN" on the thread. Pass scheduled "" to unschedule. ${DATES} ${WRITES}`,
  readOnly: false,
  destructive: true,
  input: z.object({
    id: postId,
    title: z.string().min(1).max(200).optional(),
    scheduled: z.string().optional(),
    caption: z.string().optional(),
    hashtags: z.string().optional(),
    platforms: z.array(platform).optional(),
    notes: z.string().optional(),
    link: z.string().min(1).optional(),
    media_type: z.enum(['video', 'graphic']).optional(),
  }),
  async run(session, args) {
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    const scheduledAt =
      args.scheduled === undefined ? undefined : args.scheduled.trim() === '' ? 0 : parseWhen(args.scheduled);
    const result = await updateContent(session, client.id, item, {
      title: args.title?.trim(),
      scheduledAt,
      caption: args.caption,
      hashtags: args.hashtags,
      platforms: args.platforms,
      notes: args.notes,
      driveLink: args.link,
      mediaType: args.media_type,
    });
    return {
      updated: item.title,
      changed: result.changed,
      ...(result.version ? { note: `Uploaded as v${result.version}.` } : {}),
    };
  },
});

const moveContentTool = defineTool({
  name: 'move_content',
  title: 'Move a post to another stage',
  description: `Moves a post to Editing, Review, To Post or Posted, and notes the move on its thread. ${WRITES}`,
  readOnly: false,
  destructive: true,
  input: z.object({ id: postId, stage }),
  async run(session, args) {
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    if (item.status === args.stage) return `${item.title} is already in ${stageLabel(args.stage)}.`;
    await moveContent(session, client.id, item.id, args.stage);
    return `Moved ${item.title} to ${stageLabel(args.stage)}.`;
  },
});

const reviewContentTool = defineTool({
  name: 'review_content',
  title: 'Record a review decision',
  description: `Approves or declines a post (or resets it to pending), with an optional note to the team. ${WRITES}`,
  readOnly: false,
  destructive: true,
  input: z.object({
    id: postId,
    decision: z.enum(['approved', 'declined', 'pending']),
    note: z.string().max(1000).optional(),
  }),
  async run(session, args) {
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    // The rule the app enforces: a client acts on a post only while it is in Review.
    if (session.profile.role === 'client' && item.status !== 'review') {
      throw new LimiError(`${item.title} isn't waiting for your review.`);
    }
    const note = args.note?.trim();
    await reviewContent(session, client.id, item.id, args.decision, note);
    return `Marked ${item.title} ${args.decision}${note ? `, with the note "${note}"` : ''}.`;
  },
});

const addCommentTool = defineTool({
  name: 'add_comment',
  title: 'Comment on a post',
  description: `Adds a comment to a post's thread, optionally at a moment in the video. ${WRITES}`,
  readOnly: false,
  input: z.object({
    id: postId,
    body: z.string().min(1).max(4000),
    at_seconds: z.number().min(0).optional().describe('Seconds into the video the comment refers to.'),
  }),
  async run(session, args) {
    const { client, item } = findContent(await loadWorkspace(session), args.id);
    await addComment(session, client.id, item.id, args.body.trim(), args.at_seconds);
    return `Commented on ${item.title}.`;
  },
});

const addIdeaTool = defineTool({
  name: 'add_idea',
  title: 'Add an idea',
  description: `Adds an idea for a client, as new, for the team to triage. ${WRITES}`,
  readOnly: false,
  input: z.object({
    client: z.string().min(1).describe('Client name or id.'),
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    links: z.array(z.string()).max(20).optional(),
    business: z.string().optional().describe('Business name or id.'),
  }),
  async run(session, args) {
    const client = pick(await loadWorkspace(session), args.client, 'client');
    const business = args.business ? pick(client.businesses, args.business, 'business') : undefined;
    const idea = await addIdea(session, client.id, {
      title: args.title.trim(),
      description: args.description?.trim() ?? '',
      links: args.links ?? [],
      businessId: business?.id,
    });
    return `Added the idea "${idea.title}" for ${client.name}.`;
  },
});

export const TOOLS: LimiTool[] = [
  whoami,
  listClientsTool,
  listContent,
  getContent,
  getToday,
  listCampaigns,
  listIdeas,
  createContentTool,
  updateContentTool,
  moveContentTool,
  reviewContentTool,
  addCommentTool,
  addIdeaTool,
];
