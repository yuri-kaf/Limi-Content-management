import { ContentItem, ContentStatus, MediaType, Platform } from './types';

export function extractDriveFileId(url: string): string | null {
  if (!url) return null;

  const filePathMatch = url.match(/\/file\/d\/([-\w]{25,})/);
  if (filePathMatch) return filePathMatch[1];

  const idParamMatch = url.match(/[?&]id=([-\w]{25,})/);
  if (idParamMatch) return idParamMatch[1];

  const docsMatch = url.match(/\/d\/([-\w]{25,})/);
  if (docsMatch) return docsMatch[1];

  const genericMatch = url.match(/([-\w]{25,})/);
  if (genericMatch) return genericMatch[1];

  return null;
}

export function getDriveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}

// Downloads the file directly instead of opening Drive's viewer. Requires the
// file to be shared as "anyone with the link" — same requirement the thumbnail
// endpoint above already has.
export function getDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Content created before graphics support has no mediaType stored; everything
// from that era was a video.
export function mediaTypeOf(item: { mediaType?: MediaType }): MediaType {
  return item.mediaType ?? 'video';
}

// ─── Media providers ─────────────────────────────────────────────────────────

export type MediaProvider =
  | 'drive'
  | 'onedrive'
  | 'dropbox'
  | 'youtube'
  | 'vimeo'
  | 'image'
  | 'other';

export interface MediaInfo {
  provider: MediaProvider;
  label: string;
  previewUrl: string | null;
  downloadUrl: string | null;
  /**
   * A URL that can be put in an <iframe> to play or view the item in place.
   * Distinct from previewUrl, which is a still image for the card thumbnail.
   */
  embedUrl?: string | null;
  /** Why there's no preview, when there isn't one. */
  previewNote?: string;
}

// There is no anonymous thumbnail endpoint for OneDrive/SharePoint — the Graph
// `shares` API requires a user context for business tenants — so the card still
// shows a placeholder. An embedded viewer is a different matter: appending
// action=embedview to an "Anyone with the link" share URL is Microsoft's
// documented iframe path, and that is what onedriveEmbedUrl() builds.
const NEEDS_AUTH =
  'OneDrive shows no still thumbnail, but the detail view embeds a player.';

function onedriveEmbedUrl(link: string): string {
  // Personal OneDrive still hands out /redir? links, whose embed form is a
  // straight swap rather than an extra parameter.
  if (/onedrive\.live\.com\/redir\?/i.test(link)) {
    return link.replace(/\/redir\?/i, '/embed?');
  }
  if (/[?&]action=/i.test(link)) return link;
  return `${link}${link.includes('?') ? '&' : '?'}action=embedview`;
}

// Derived from the URL rather than stored on the item, so it is always correct
// and legacy content needs no migration.
export function getMediaInfo(url: string): MediaInfo {
  const link = (url ?? '').trim();
  if (!link) return { provider: 'other', label: 'Link', previewUrl: null, downloadUrl: null };

  if (/drive\.google\.com|docs\.google\.com/i.test(link)) {
    const id = extractDriveFileId(link);
    return {
      provider: 'drive',
      label: 'Google Drive',
      previewUrl: id ? getDriveThumbnailUrl(id) : null,
      downloadUrl: id ? getDriveDownloadUrl(id) : null,
      previewNote: id ? undefined : 'Could not read a file ID from this Drive link.',
    };
  }

  if (/1drv\.ms|onedrive\.live\.com|sharepoint\.com/i.test(link)) {
    return {
      provider: 'onedrive',
      label: 'OneDrive',
      previewUrl: null,
      downloadUrl: null,
      embedUrl: onedriveEmbedUrl(link),
      previewNote: NEEDS_AUTH,
    };
  }

  if (/dropbox\.com/i.test(link)) {
    // raw=1 serves the file itself; dl=1 forces a download.
    const base = link.replace(/([?&])dl=\d/, '$1').replace(/[?&]$/, '');
    const sep = base.includes('?') ? '&' : '?';
    return {
      provider: 'dropbox',
      label: 'Dropbox',
      previewUrl: `${base}${sep}raw=1`,
      downloadUrl: `${base}${sep}dl=1`,
    };
  }

  const yt = link.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i
  );
  if (yt) {
    return {
      provider: 'youtube',
      label: 'YouTube',
      previewUrl: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
      downloadUrl: null,
    };
  }

  if (/vimeo\.com/i.test(link)) {
    return {
      provider: 'vimeo',
      label: 'Vimeo',
      previewUrl: null,
      downloadUrl: null,
      previewNote: 'Vimeo thumbnails need an extra API call, so none is shown.',
    };
  }

  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(link)) {
    return { provider: 'image', label: 'Image', previewUrl: link, downloadUrl: link };
  }

  return { provider: 'other', label: 'Link', previewUrl: null, downloadUrl: null };
}

// ─── Caption ─────────────────────────────────────────────────────────────────

// Before the caption migration runs, legacy items still hold their caption in
// `notes`. These two keep that from showing up twice in the UI.
export function captionOf(item: Pick<ContentItem, 'caption' | 'notes'>): string {
  return item.caption ?? item.notes ?? '';
}

export function teamNotesOf(item: Pick<ContentItem, 'caption' | 'notes'>): string {
  return item.caption === undefined ? '' : item.notes ?? '';
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Share tokens ARE the credential — anyone holding one can read that item —
// so these must not come from Math.random(), which is predictable.
export function generateShareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Firestore writes are fire-and-forget throughout the UI. Without this the
// promise rejects unhandled and the user just sees nothing happen — which is
// exactly how expired security rules presented as "the button is broken".
export async function runWrite(action: () => Promise<unknown>, what: string) {
  try {
    await action();
    return true;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    const message =
      code === 'permission-denied'
        ? `Could not ${what}: the database rejected the write (permission denied). Check the Firestore security rules for this project.`
        : `Could not ${what}: ${(err as Error)?.message ?? 'unknown error'}`;
    console.error(`[limi] ${what} failed`, err);
    alert(message);
    return false;
  }
}

// ─── Public links ────────────────────────────────────────────────────────────

// A review link is opened by someone else, on another machine, so it must not
// be built from window.location.origin when that is a dev server — the result
// is a localhost URL that only resolves for whoever generated it.
export function publicAppOrigin(): string {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL ?? '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return window.location.origin;
}

export function isLocalOrigin(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|[^/]*\.local)(:|\/|$)/i.test(url);
}

// ─── Stages ──────────────────────────────────────────────────────────────────

// Validated stage palette — see the note in tailwind.config.js. Every use is
// paired with its text label, which is what permits the CVD warn band. One
// source of truth so the board, the detail sheet and the activity trail can
// never disagree about a stage's name or colour.
export const STAGES: { id: ContentStatus; label: string; color: string }[] = [
  { id: 'editing', label: 'Editing', color: '#8b5cf6' },
  { id: 'review', label: 'Review', color: '#0284c7' },
  { id: 'to-post', label: 'To Post', color: '#d97706' },
  { id: 'posted', label: 'Posted', color: '#059669' },
];
