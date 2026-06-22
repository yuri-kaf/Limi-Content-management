export type ContentStatus = 'editing' | 'review' | 'to-post' | 'posted';
export type UserRole = 'admin' | 'social-media-manager' | 'client';
export type ClientReview = 'pending' | 'approved' | 'declined';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
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
