// Test support only: one small agency, built from Kathmandu local dates.
import './env.js';
import { createFirestore } from './firestore.js';
import { fakeGoogle, limiRules } from './fakeGoogle.js';
import { getProfile, type Session } from './limi.js';

/** Wednesday 14 October 2026, 10:00 in Kathmandu. */
export const NOW = new Date(2026, 9, 14, 10, 0).getTime();

export const at = (month: number, day: number, hour = 0, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).getTime();

export const DRIVE_LINK = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view';

export function seedDocs(): Record<string, Record<string, unknown>> {
  return {
    'users/admin1': {
      name: 'Asha Admin', email: 'asha@limi.test', role: 'admin', assignedClientIds: [], createdAt: 1,
    },
    'users/cli1': {
      name: 'Sam Shopit', email: 'sam@shopit.test', role: 'client', assignedClientIds: ['shopit', 'gone'], createdAt: 2,
    },
    'clients/shopit': {
      name: 'Shopit', about: 'Online store', color: 'red', createdAt: 10,
      // A legacy content array the migration left behind. Never surfaced.
      content: [{ id: 'legacy', title: 'Old' }],
    },
    'clients/everest': { name: 'Everest IT', about: '', color: 'blue', createdAt: 20 },
    'clients/shopit/businesses/main': { name: 'Shopit', color: 'red', about: '', createdAt: 10 },
    'clients/shopit/businesses/nepal': { name: 'Shopit Nepal', color: 'green', about: '', createdAt: 11 },
    'clients/everest/businesses/main': { name: 'Everest IT', color: 'blue', about: '', createdAt: 20 },
    'clients/shopit/campaigns/tihar': {
      businessId: 'main', name: 'Tihar 2026', brief: 'Internal: push the gift boxes', status: 'live',
      startDate: '2026-10-20', endDate: '2026-11-05', color: 'orange',
      deliverables: [{ id: 'd1', label: '3 Reels', mediaType: 'video', target: 3 }], createdAt: 30,
    },
    'clients/shopit/content/momo': {
      id: 'momo', title: 'Momo reel', driveLink: DRIVE_LINK, driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      mediaType: 'video', caption: 'Steaming momo, straight to you', hashtags: '#momo', platforms: ['instagram'],
      notes: 'Use the v2 music', status: 'review', createdAt: 100, scheduledAt: at(10, 16, 15),
      uploadedByEmail: 'asha@limi.test', clientReview: 'pending', reviewNote: '', businessId: 'main',
      campaignId: 'tihar', deliverableId: 'd1',
    },
    'clients/shopit/content/dashain': {
      id: 'dashain', title: 'Dashain recap', driveLink: 'https://youtu.be/abcdefghijk', driveFileId: '',
      mediaType: 'video', caption: '', hashtags: '', platforms: [], notes: '', status: 'to-post', createdAt: 101,
      scheduledAt: at(10, 10, 9), uploadedByEmail: 'asha@limi.test', clientReview: 'approved', reviewNote: '',
      businessId: 'main',
    },
    'clients/shopit/content/draft': {
      id: 'draft', title: 'Draft carousel', driveLink: '', driveFileId: '', mediaType: 'graphic', caption: '',
      hashtags: '', platforms: [], notes: '', status: 'editing', createdAt: 102, scheduledAt: 0,
      uploadedByEmail: 'asha@limi.test', clientReview: 'pending', reviewNote: '', businessId: 'main',
    },
    'clients/shopit/content/offer': {
      id: 'offer', title: 'Offer post', driveLink: 'https://example.com/offer.png', driveFileId: '',
      mediaType: 'graphic', caption: 'Ten percent off', hashtags: '', platforms: ['facebook'], notes: '',
      status: 'review', createdAt: 103, scheduledAt: 0, uploadedByEmail: 'asha@limi.test',
      clientReview: 'declined', reviewNote: 'Lower the music', businessId: 'nepal',
    },
    'clients/everest/content/laptop': {
      id: 'laptop', title: 'Laptop sale', driveLink: '', driveFileId: '', mediaType: 'video', caption: '',
      hashtags: '', platforms: [], notes: '', status: 'posted', createdAt: 104, scheduledAt: at(10, 1, 10),
      uploadedByEmail: 'asha@limi.test', clientReview: 'approved', reviewNote: '', businessId: 'main',
    },
    'clients/shopit/content/momo/comments/c1': {
      id: 'c1', kind: 'user', body: 'Looks good', authorEmail: 'sam@shopit.test', authorName: 'Sam Shopit',
      createdAt: 200, atSeconds: 12,
    },
    'clients/shopit/content/momo/comments/c0': {
      id: 'c0', kind: 'system', body: 'moved this to Review', authorEmail: 'asha@limi.test',
      authorName: 'Asha Admin', createdAt: 150,
    },
    'clients/shopit/ideas/i1': {
      id: 'i1', title: 'Tihar lights', description: 'Diyas at dusk', links: [], status: 'new',
      createdByEmail: 'sam@shopit.test', createdByName: 'Sam Shopit', createdAt: 300,
    },
    'clients/shopit/ideas/i2': {
      id: 'i2', title: 'Staff picks', description: '', links: [], status: 'declined',
      createdByEmail: 'asha@limi.test', createdByName: 'Asha Admin', createdAt: 301, businessId: 'nepal',
    },
  };
}

export const ACCOUNTS = [
  { email: 'asha@limi.test', password: 'admin-pw', uid: 'admin1' },
  { email: 'sam@shopit.test', password: 'client-pw', uid: 'cli1' },
  { email: 'nobody@limi.test', password: 'nobody-pw', uid: 'ghost' },
];

export function limiGoogle() {
  return fakeGoogle({ docs: seedDocs(), accounts: ACCOUNTS, deny: limiRules });
}

/** A session as the MCP endpoint would build it for that uid. */
export async function sessionAs(google: ReturnType<typeof fakeGoogle>, uid: string): Promise<Session> {
  const fs = createFirestore({ projectId: google.projectId, idToken: `id-${uid}`, fetch: google.fetch });
  const profile = await getProfile(fs, uid);
  if (!profile) throw new Error(`no profile for ${uid}`);
  return { fs, profile, now: () => NOW };
}
