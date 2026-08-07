export type ContentStatus = 'editing' | 'review' | 'to-post' | 'posted';
export type UserRole = 'admin' | 'social-media-manager' | 'client';
export type ClientReview = 'pending' | 'approved' | 'declined';

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
  notes?: string;
  status: ContentStatus;
  createdAt: number;
  scheduledAt?: number;
  uploadedByEmail: string;
  clientReview: ClientReview;
  reviewNote?: string;
}

export interface Client {
  id: string;
  name: string;
  imageUrl?: string;
  about: string;
  content: ContentItem[];
  createdAt: number;
}
