export type ContentStatus = 'editing' | 'review' | 'to-post' | 'posted';

export interface ContentItem {
  id: string;
  title: string;
  driveLink: string;
  driveFileId: string;
  notes?: string;
  status: ContentStatus;
  createdAt: number;
}

export interface Client {
  id: string;
  name: string;
  imageUrl?: string;
  about: string;
  content: ContentItem[];
  createdAt: number;
}
