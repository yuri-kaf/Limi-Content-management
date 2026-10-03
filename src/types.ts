export type ContentStatus = 'editing' | 'review' | 'to-post' | 'posted';
export type UserRole = 'admin' | 'social-media-manager' | 'client';
export type ClientReview = 'pending' | 'approved' | 'declined';
export type MediaType = 'video' | 'graphic';
export type Platform = 'instagram' | 'facebook' | 'tiktok';

// The macOS-style folder colours a client, business or campaign can carry.
// The hex values live in src/folderColors.ts.
export type FolderColor =
  | 'blue' | 'sky' | 'teal' | 'green' | 'yellow'
  | 'orange' | 'red' | 'pink' | 'purple' | 'graphite';

export type CampaignStatus = 'planning' | 'live' | 'completed';

// Profile only. Credentials live in Firebase Auth, and `id` is the Auth UID —
// a profile document existing is what grants a signed-in account any access.
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedClientIds: string[];
  createdAt: number;
}

export interface ContentItem {
  id: string;
  title: string;
  driveLink: string;
  driveFileId: string;
  // Optional because content created before graphics support has no value
  // stored. Read it through mediaTypeOf(), which treats absent as 'video'.
  mediaType?: MediaType;
  // Published copy, shown to the client. Read via captionOf(): before the
  // caption migration runs, legacy items still carry this text in `notes`.
  caption?: string;
  hashtags?: string;
  platforms?: Platform[];
  /** Superseded media links, newest last. */
  versions?: Version[];
  // Internal remarks for the team. Historically this held caption copy.
  notes?: string;
  status: ContentStatus;
  createdAt: number;
  scheduledAt?: number;
  uploadedByEmail: string;
  clientReview: ClientReview;
  reviewNote?: string;
  // Absent only on items created before businesses existed. Read it through
  // businessIdOf(), which treats absent as the client's first business.
  businessId?: string;
  /** At most one. Read through campaignIdOf(), which ignores a deleted campaign. */
  campaignId?: string;
  /** The campaign deliverable this item fills, if any. */
  deliverableId?: string;
}

// One thread per content item. System entries are the activity trail —
// status moves and review decisions — so there's a single chronology to read
// rather than two parallel logs.
export interface Comment {
  id: string;
  kind: 'user' | 'system';
  body: string;
  authorEmail: string;
  authorName: string;
  createdAt: number;
  /** Seconds into the video, when the comment refers to a moment. */
  atSeconds?: number;
}

// A public review link. The document ID is the token, and holding it is the
// only credential — so this carries a SNAPSHOT of what a reviewer needs rather
// than granting access to the real content document.
export interface Share {
  id: string;
  clientId: string;
  contentId: string;
  clientName: string;
  title: string;
  mediaLink: string;
  mediaType?: MediaType;
  caption: string;
  hashtags: string;
  createdAt: number;
  createdByEmail: string;
  revoked: boolean;
  decision?: ClientReview;
  decisionNote?: string;
  decidedAt?: number;
  /** When the decision was last written back onto the content item. */
  syncedAt?: number;
}

export type IdeaStatus = 'new' | 'accepted' | 'declined';

export interface Idea {
  id: string;
  title: string;
  description: string;
  /** Anything the submitter wants to point at — refs, Drive files, articles. */
  links: string[];
  status: IdeaStatus;
  createdByEmail: string;
  createdByName: string;
  createdAt: number;
  decisionNote?: string;
  /** Set once an accepted idea has been turned into a content item. */
  convertedContentId?: string;
  /** Absent on ideas submitted before businesses existed — the first business. */
  businessId?: string;
}

export interface Version {
  link: string;
  mediaType?: MediaType;
  replacedAt: number;
  replacedByEmail: string;
}

// One marketing business a client runs. Every client has at least one; a
// client with a single business never sees this layer in the UI.
export interface Business {
  id: string;
  name: string;
  color: FolderColor;
  logoUrl?: string;
  about: string;
  createdAt: number;
}

/** What the business form produces. */
export type BusinessDraft = Pick<Business, 'name' | 'color' | 'about'> & { logoUrl?: string };

// A planned piece of a campaign — "3 Reels". Progress is never stored: it is
// counted from the content whose deliverableId points here.
export interface Deliverable {
  id: string;
  label: string;
  /** Pre-fills the add-content form. Absent means either kind. */
  mediaType?: MediaType;
  /** How many are planned. At least 1. */
  target: number;
}

export interface Campaign {
  id: string;
  businessId: string;
  name: string;
  brief: string;
  status: CampaignStatus;
  /** Local midnight of the first day. */
  startDate?: number;
  /** Local midnight of the last day. */
  endDate?: number;
  color: FolderColor;
  deliverables: Deliverable[];
  createdAt: number;
}

/** What the campaign form produces. */
export type CampaignDraft = Omit<Campaign, 'id' | 'createdAt'>;

export interface Client {
  id: string;
  name: string;
  imageUrl?: string;
  about: string;
  /** Folder colour. Absent on clients created before colours existed. */
  color?: FolderColor;
  content: ContentItem[];
  /** Oldest first. The first also holds anything that has no businessId yet. */
  businesses: Business[];
  createdAt: number;
}
