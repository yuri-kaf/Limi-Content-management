import { useState } from 'react';
import { X, Film, Image as ImageIcon } from 'lucide-react';
import { Business, Campaign, ContentItem, ContentStatus, MediaType, Platform } from '../types';
import { businessIdOf } from '../campaigns';
import CampaignOptions from './CampaignOptions';
import {
  extractDriveFileId, getMediaInfo, mediaTypeOf, captionOf, teamNotesOf, PLATFORM_LABELS,
  toDateInput,
} from '../utils';
import {
  overlay, modalPanel, modalTitle, btnIcon, label, labelAside, hint,
  input, textarea, chip, btnPrimary, btnGhost, faintText,
} from '../ui';

export interface ContentFormData {
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
  /** Absent only while the client has no business at all. */
  businessId?: string;
  /**
   * null takes the item out of its campaign (or its deliverable). Absent when
   * an edit never touched the pickers: the filing is left as stored.
   */
  campaignId?: string | null;
  deliverableId?: string | null;
}

interface Props {
  defaultStatus: ContentStatus;
  defaultScheduledAt?: number;
  defaultTitle?: string;
  defaultCaption?: string;
  defaultLink?: string;
  existingItem?: ContentItem;
  /** The client's businesses, oldest first. The picker shows only with two or more. */
  businesses?: Business[];
  /** The client's campaigns. The picker shows only when there are some. */
  campaigns?: Campaign[];
  defaultBusinessId?: string;
  defaultCampaignId?: string;
  defaultDeliverableId?: string;
  onClose: () => void;
  onSubmit: (data: ContentFormData) => void;
}

export default function AddContentModal({
  defaultStatus, defaultScheduledAt, defaultTitle, defaultCaption, defaultLink,
  existingItem, businesses = [], campaigns = [],
  defaultBusinessId, defaultCampaignId, defaultDeliverableId,
  onClose, onSubmit,
}: Props) {
  const isEdit = !!existingItem;

  const [title, setTitle] = useState(existingItem?.title ?? defaultTitle ?? '');
  const [driveLink, setDriveLink] = useState(existingItem?.driveLink ?? defaultLink ?? '');
  const [caption, setCaption] = useState(
    existingItem ? captionOf(existingItem) : defaultCaption ?? ''
  );
  const [hashtags, setHashtags] = useState(existingItem?.hashtags ?? '');
  const [platforms, setPlatforms] = useState<Platform[]>(existingItem?.platforms ?? []);
  const [notes, setNotes] = useState(existingItem ? teamNotesOf(existingItem) : '');
  // The pickers start from what the item has stored, not from what can be
  // found in `campaigns`: on a slow connection that list may still be on its
  // way, and reading "not found" as "no campaign" would unlink the item the
  // moment a title edit was saved.
  const [campaignId, setCampaignId] = useState(
    existingItem?.campaignId ?? defaultCampaignId ?? ''
  );
  const [deliverableId, setDeliverableId] = useState(
    existingItem?.deliverableId ?? defaultDeliverableId ?? ''
  );
  // A campaign's business wins: content in a campaign carries its business.
  const [businessId, setBusinessId] = useState(
    () =>
      campaigns.find((c) => c.id === campaignId)?.businessId ??
      (existingItem ? businessIdOf(existingItem, businesses) : defaultBusinessId) ??
      businesses[0]?.id ??
      ''
  );
  // Set once any of the three pickers is changed. Until then an edit leaves
  // the item's filing exactly as stored.
  const [filingTouched, setFilingTouched] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>(() => {
    if (existingItem) return mediaTypeOf(existingItem);
    const deliverable = campaigns
      .find((c) => c.id === campaignId)
      ?.deliverables.find((d) => d.id === deliverableId);
    return deliverable?.mediaType ?? 'video';
  });
  const [imgError, setImgError] = useState(false);
  const isGraphic = mediaType === 'graphic';

  const [schedDate, setSchedDate] = useState(() => {
    const ts = existingItem?.scheduledAt ?? defaultScheduledAt;
    if (ts && ts > 0) return toDateInput(ts);
    return '';
  });
  const [schedTime, setSchedTime] = useState(() => {
    const ts = existingItem?.scheduledAt ?? defaultScheduledAt;
    if (ts && ts > 0) {
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return '';
  });

  const media = getMediaInfo(driveLink);
  // Still stored for Drive links so existing content keeps working unchanged.
  const fileId = media.provider === 'drive' ? extractDriveFileId(driveLink.trim()) : '';
  const thumbnailUrl = media.previewUrl;

  function handleDriveLinkChange(val: string) {
    setDriveLink(val);
    setImgError(false);
  }

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  // A field alone in the row takes all of it rather than half.
  const fieldSpan = businesses.length >= 2 && campaigns.length > 0 ? '' : 'sm:col-span-2';

  function chooseBusiness(id: string) {
    setFilingTouched(true);
    setBusinessId(id);
    // A campaign belongs to one business; keeping it would file the item
    // under two.
    if (selectedCampaign && selectedCampaign.businessId !== id) {
      setCampaignId('');
      setDeliverableId('');
    }
  }

  function chooseCampaign(id: string) {
    setFilingTouched(true);
    setCampaignId(id);
    setDeliverableId('');
    const campaign = campaigns.find((c) => c.id === id);
    if (campaign) setBusinessId(campaign.businessId);
  }

  function chooseDeliverable(id: string) {
    setFilingTouched(true);
    setDeliverableId(id);
    // A deliverable's media type pre-fills new content only. An existing item
    // is what it is: filing a video under a graphics slot must not relabel it.
    const deliverable = selectedCampaign?.deliverables.find((d) => d.id === id);
    if (!isEdit && deliverable?.mediaType) {
      setMediaType(deliverable.mediaType);
      setImgError(false);
    }
  }

  function getScheduledAt(): number | undefined {
    if (!schedDate) return undefined;
    const timeStr = schedTime || '00:00';
    const ts = new Date(`${schedDate}T${timeStr}`).getTime();
    return isNaN(ts) ? undefined : ts;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !driveLink.trim()) return;
    // An edit that never touched the pickers sends no filing at all, which
    // updateContent reads as "leave as stored". Anything chosen is checked
    // against what exists now, so a campaign or deliverable deleted while the
    // form was open is saved as none rather than as a dangling id.
    const keepFiling = isEdit && !filingTouched;
    const deliverable = selectedCampaign?.deliverables.find((d) => d.id === deliverableId);
    onSubmit({
      title: title.trim(),
      driveLink: driveLink.trim(),
      driveFileId: fileId || '',
      mediaType,
      caption: caption.trim(),
      hashtags: hashtags.trim(),
      platforms,
      notes: notes.trim() || undefined,
      status: existingItem?.status ?? defaultStatus,
      scheduledAt: getScheduledAt(),
      // An untouched edit stamps a business only on an item that has none.
      ...(businessId && !(keepFiling && existingItem?.businessId) ? { businessId } : {}),
      ...(keepFiling
        ? {}
        : { campaignId: selectedCampaign?.id ?? null, deliverableId: deliverable?.id ?? null }),
    });
    onClose();
  }

  return (
    <div
      className={overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={modalPanel}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={modalTitle}>{isEdit ? 'Edit Content' : 'Add Content'}</h2>
          <button onClick={onClose} className={btnIcon} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={label}>Type</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'video' as const, label: 'Video', Icon: Film },
                { value: 'graphic' as const, label: 'Graphic', Icon: ImageIcon },
              ]).map(({ value, label: optionLabel, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setMediaType(value); setImgError(false); }}
                  className={`${chip(mediaType === value)} min-h-11`}
                >
                  <Icon size={14} />
                  {optionLabel}
                </button>
              ))}
            </div>
          </div>

          {(businesses.length >= 2 || campaigns.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {businesses.length >= 2 && (
                <div className={fieldSpan}>
                  <label className={label} htmlFor="content-business">Business</label>
                  <select
                    id="content-business"
                    value={businessId}
                    onChange={(e) => chooseBusiness(e.target.value)}
                    className={input}
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {campaigns.length > 0 && (
                <div className={fieldSpan}>
                  <label className={label} htmlFor="content-campaign">
                    Campaign <span className={labelAside}>(optional)</span>
                  </label>
                  <select
                    id="content-campaign"
                    value={campaignId}
                    onChange={(e) => chooseCampaign(e.target.value)}
                    className={input}
                  >
                    <option value="">No campaign</option>
                    {/* Every campaign is offered: choosing one files the item
                        under that campaign's business, so the business picker
                        never has to come first. */}
                    <CampaignOptions campaigns={campaigns} businesses={businesses} />
                  </select>
                </div>
              )}
              {selectedCampaign && selectedCampaign.deliverables.length > 0 && (
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="content-deliverable">
                    Fills <span className={labelAside}>(optional)</span>
                  </label>
                  <select
                    id="content-deliverable"
                    value={deliverableId}
                    onChange={(e) => chooseDeliverable(e.target.value)}
                    className={input}
                  >
                    <option value="">Not a planned deliverable</option>
                    {selectedCampaign.deliverables.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className={label} htmlFor="content-title">Content Title</label>
            <input
              id="content-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isGraphic ? 'Graphic title...' : 'Video title...'}
              required
              className={input}
            />
          </div>

          <div>
            <label className={label} htmlFor="content-link">Drive Link</label>
            <input
              id="content-link"
              type="text"
              value={driveLink}
              onChange={(e) => handleDriveLinkChange(e.target.value)}
              placeholder="https://drive.google.com/..."
              required
              className={input}
            />
            <p className={hint}>
              {driveLink.trim() === ''
                ? 'Google Drive, OneDrive, Dropbox, YouTube or a direct image URL.'
                : media.previewNote
                  ? `${media.label} — ${media.previewNote}`
                  : `${media.label}${isGraphic ? ' — share as "anyone with the link" so the preview and download work.' : ''}`}
            </p>
          </div>

          {thumbnailUrl && (
            <div
              className="rounded-tile overflow-hidden border border-hairline dark:border-hairline-dark"
              style={{ aspectRatio: '16/9' }}
            >
              {!imgError ? (
                <img
                  src={thumbnailUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full bg-raised dark:bg-raised-dark flex flex-col items-center justify-center gap-1.5">
                  {isGraphic ? (
                    <ImageIcon size={22} className={faintText} />
                  ) : (
                    <Film size={22} className={faintText} />
                  )}
                  <span className={`text-[10px] px-4 text-center ${faintText}`}>
                    No preview — check the file is shared as "anyone with the link"
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className={label}>
              Caption <span className={labelAside}>(the client sees this)</span>
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="The copy that goes out with this post..."
              rows={3}
              className={textarea}
            />
          </div>

          <div>
            <label className={label}>
              Hashtags <span className={labelAside}>(optional)</span>
            </label>
            <textarea
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#example #tags"
              rows={2}
              className={textarea}
            />
            <p className={hint}>Kept separate so they can be copied on their own.</p>
          </div>

          <div>
            <label className={label}>
              Platforms <span className={labelAside}>(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setPlatforms((prev) =>
                      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                    )
                  }
                  className={chip(platforms.includes(p))}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>
              Team Notes <span className={labelAside}>(internal only)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reshoot the intro, waiting on logo files..."
              rows={2}
              className={textarea}
            />
            <p className={hint}>Not shown to the client.</p>
          </div>

          <div>
            <label className={label}>
              Posting Schedule <span className={labelAside}>(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className={`${input} flex-1`}
              />
              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                disabled={!schedDate}
                className={`${input} w-32 disabled:opacity-40`}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !driveLink.trim()}
              className={`${btnPrimary} flex-1`}
            >
              {isEdit ? 'Save Changes' : 'Add Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
