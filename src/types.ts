export type ContentStatus = 'editing' | 'review' | 'to-post' | 'posted';
export type UserRole = 'admin' | 'social-media-manager' | 'client';
export type ClientReview = 'pending' | 'approved' | 'declined';
export type MediaType = 'video' | 'graphic';
export type Platform = 'instagram' | 'facebook' | 'tiktok';

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
}

export interface Version {
  link: string;
  mediaType?: MediaType;
  replacedAt: number;
  replacedByEmail: string;
}

export interface Client {
  id: string;
  name: string;
  imageUrl?: string;
  about: string;
  content: ContentItem[];
  createdAt: number;
}
