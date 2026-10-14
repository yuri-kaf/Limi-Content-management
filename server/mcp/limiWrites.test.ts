// @vitest-environment node
import {
  addComment, addIdea, createContent, findContent, loadWorkspace, mediaTypeFor, moveContent, reviewContent,
  stageLabel, updateContent,
} from './limi.js';
import { at, DRIVE_LINK, limiGoogle, NOW, sessionAs } from './testData.js';

async function admin() {
  const google = limiGoogle();
  const session = await sessionAs(google, 'admin1');
  google.calls.length = 0;
  return { google, session };
}

const commentsOf = (google: ReturnType<typeof limiGoogle>, contentPath: string) =>
  google
    .paths(`${contentPath}/comments/`)
    .map((p) => google.doc(p)!)
    .filter((c) => c.createdAt === NOW);

describe('createContent', () => {
  it('writes the document addContent would', async () => {
    const { google, session } = await admin();
    const item = await createContent(session, 'shopit', {
      title: 'Tihar teaser', driveLink: DRIVE_LINK, mediaType: 'video', status: 'editing',
      scheduledAt: at(10, 20, 18), businessId: 'main', campaignId: 'tihar', platforms: ['instagram'],
    });
    expect(google.doc(`clients/shopit/content/${item.id}`)).toEqual({
      id: item.id, title: 'Tihar teaser', driveLink: DRIVE_LINK, driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      mediaType: 'video', caption: '', hashtags: '', platforms: ['instagram'], notes: '', status: 'editing',
      createdAt: NOW, scheduledAt: at(10, 20, 18), uploadedByEmail: 'asha@limi.test', clientReview: 'pending',
      reviewNote: '', businessId: 'main', campaignId: 'tihar',
    });
  });

  it('stores no Drive file id for other links', async () => {
    const { google, session } = await admin();
    const item = await createContent(session, 'shopit', {
      title: 'Poster', driveLink: 'https://example.com/poster.png', mediaType: 'graphic', status: 'editing',
      businessId: 'main',
    });
    expect(google.doc(`clients/shopit/content/${item.id}`)).toMatchObject({ driveFileId: '', scheduledAt: 0 });
  });
});

describe('mediaTypeFor', () => {
  it('reads an image link as a graphic and anything else as a video', () => {
    expect(mediaTypeFor('https://example.com/a.jpg')).toBe('graphic');
    expect(mediaTypeFor(DRIVE_LINK)).toBe('video');
  });
});

describe('updateContent', () => {
  it('writes only the fields given', async () => {
    const { google, session } = await admin();
    const { item } = findContent(await loadWorkspace(session), 'momo');
    const result = await updateContent(session, 'shopit', item, { caption: 'New caption', scheduledAt: 0 });
    expect(result).toEqual({ changed: ['scheduledAt', 'caption'] });
    expect(google.calls.at(-1)).toEqual({
      op: 'update', path: 'clients/shopit/content/momo', mask: ['scheduledAt', 'caption'],
    });
    expect(google.doc('clients/shopit/content/momo')).toMatchObject({
      caption: 'New caption', scheduledAt: 0, title: 'Momo reel',
    });
  });

  it('appends a version and says "uploaded v2" when the link changes', async () => {
    const { google, session } = await admin();
    const { item } = findContent(await loadWorkspace(session), 'momo');
    const result = await updateContent(session, 'shopit', item, {
      driveLink: 'https://drive.google.com/file/d/9ZyXwVuTsRqPoNmLkJiHgFeDcBa987654/view',
    });
    expect(result.version).toBe(2);
    const doc = google.doc('clients/shopit/content/momo')!;
    expect(doc.driveFileId).toBe('9ZyXwVuTsRqPoNmLkJiHgFeDcBa987654');
    expect(doc.versions).toEqual([
      { link: DRIVE_LINK, mediaType: 'video', replacedAt: NOW, replacedByEmail: 'asha@limi.test' },
    ]);
    expect(commentsOf(google, 'clients/shopit/content/momo')).toEqual([
      expect.objectContaining({ kind: 'system', body: 'uploaded v2', authorName: 'Asha Admin' }),
    ]);
  });

  it('refuses a change that changes nothing', async () => {
    const { session } = await admin();
    const { item } = findContent(await loadWorkspace(session), 'momo');
    await expect(updateContent(session, 'shopit', item, { driveLink: DRIVE_LINK })).rejects.toThrow(
      'Nothing to change'
    );
  });
});

describe('moveContent', () => {
  it('writes the status and then the system comment', async () => {
    const { google, session } = await admin();
    await moveContent(session, 'shopit', 'momo', 'to-post');
    expect(google.calls.map((c) => c.op)).toEqual(['update', 'create']);
    expect(google.calls[0]).toMatchObject({ path: 'clients/shopit/content/momo', mask: ['status'] });
    expect(google.doc('clients/shopit/content/momo')!.status).toBe('to-post');
    expect(commentsOf(google, 'clients/shopit/content/momo')).toEqual([
      expect.objectContaining({ kind: 'system', body: 'moved this to To Post' }),
    ]);
  });

  it('writes no comment when the move is refused', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    await expect(moveContent(session, 'shopit', 'momo', 'posted')).rejects.toMatchObject({ status: 403 });
    expect(commentsOf(google, 'clients/shopit/content/momo')).toEqual([]);
  });
});

describe('stageLabel', () => {
  it('uses the app labels', () => {
    expect(stageLabel('to-post')).toBe('To Post');
  });
});

describe('reviewContent', () => {
  it('lets a client record a decision with a note', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    await reviewContent(session, 'shopit', 'momo', 'declined', 'Lower the music');
    expect(google.doc('clients/shopit/content/momo')).toMatchObject({
      clientReview: 'declined', reviewNote: 'Lower the music',
    });
    expect(commentsOf(google, 'clients/shopit/content/momo')).toEqual([
      expect.objectContaining({ body: 'declined this — "Lower the music"', authorName: 'Sam Shopit' }),
    ]);
  });

  it('clears the note when none is given', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    await reviewContent(session, 'shopit', 'offer', 'approved');
    expect(google.doc('clients/shopit/content/offer')).toMatchObject({ clientReview: 'approved', reviewNote: '' });
    expect(commentsOf(google, 'clients/shopit/content/offer')[0].body).toBe('approved this');
  });
});

describe('addComment', () => {
  it('adds a user comment at a moment in the video', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    const comment = await addComment(session, 'shopit', 'momo', 'Cut here', 42);
    expect(google.doc(`clients/shopit/content/momo/comments/${comment.id}`)).toEqual({
      id: comment.id, kind: 'user', body: 'Cut here', authorEmail: 'sam@shopit.test', authorName: 'Sam Shopit',
      createdAt: NOW, atSeconds: 42,
    });
  });
});

describe('addIdea', () => {
  it('adds a new idea as the signed-in person', async () => {
    const google = limiGoogle();
    const session = await sessionAs(google, 'cli1');
    const idea = await addIdea(session, 'shopit', {
      title: 'Lantern reel', description: 'Night shots', links: ['https://example.com/ref'], businessId: 'nepal',
    });
    expect(google.doc(`clients/shopit/ideas/${idea.id}`)).toEqual({
      id: idea.id, title: 'Lantern reel', description: 'Night shots', links: ['https://example.com/ref'],
      businessId: 'nepal', status: 'new', createdByEmail: 'sam@shopit.test', createdByName: 'Sam Shopit',
      createdAt: NOW,
    });
  });
});
