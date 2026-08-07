# Feature roadmap

**Date:** 2026-08-07
**Status:** sequence approved; phases specced individually

## Context

The app works as a status board: an agency moves client content through
editing → review → to-post → posted, with clients approving or declining. The goal now is
to make it a genuine review and collaboration tool.

## Hard constraint

**There is no backend.** Pure client-side React on Firebase, Spark (free) plan, hosted on
Vercel. This rules out, for now:

- Auto-posting to Instagram / TikTok / LinkedIn (needs OAuth, a server, and platform app review)
- Transactional email (Firebase's email extensions require Blaze)
- Anything with a secret that can't ship in the browser bundle

Every phase below is achievable without a server. Where a feature is degraded by that, it
says so.

## Phases

Each phase gets its own spec, implementation plan, review, and deploy. The user reviews
between phases rather than at the end of a single large branch.

### Phase 0 — Content subcollection migration

Move content out of the array field on each client document into
`clients/{clientId}/content/{contentId}`. No user-visible change.

Prerequisite for every other phase, and fixes an existing data-loss bug. See
`2026-08-07-phase0-content-subcollection-design.md`.

### Phase 1 — Universal media links and caption fields

Accept OneDrive/SharePoint, Dropbox, YouTube, Vimeo and direct URLs alongside Drive.
Detect the provider from the URL and degrade gracefully:

| Provider | Preview | Download |
|---|---|---|
| Google Drive | yes | yes |
| Dropbox | yes (URL transform) | yes |
| YouTube / Vimeo | yes (oEmbed) | n/a |
| Direct image URL | yes | yes |
| **OneDrive / SharePoint** | **no — needs auth** | no |

The team uses Drive plus OneDrive/SharePoint, so OneDrive links render as a labelled
provider card with a working open-link, not a thumbnail. This is a limitation of those
services without authentication, not something more effort would fix.

Also splits the overloaded `notes` field into `caption`, `hashtags`, and target platforms,
with per-field copy buttons. Existing notes migrate into `caption`.

### Phase 2 — Review loop

The phase that differentiates the product.

- **Threaded comments** — built as a generic primitive, not content-specific, so Phase 3
  reuses it. Stored as a subcollection on the parent record.
- **Timestamped video notes** — comment at a specific point in playback rather than
  describing which moment. Drive files embed via iframe.
- **Versions** — v1/v2/v3 on one card, each linked to the feedback that prompted it.
- **Activity trail** — who moved, approved, or edited what, and when.

### Phase 3 — Ideation board

Clients submit ideas: title, description, reference links, file links. The team triages
(new → accepted → declined/parked), and an accepted idea converts into a content item
carrying its links and description across. Discussion comes free from the Phase 2 comment
primitive.

### Phase 4 — Public review links

A shareable URL that lets a client review and approve without an account, removing the
sign-up barrier.

Security note: **the link is the credential.** Anyone holding it can view that content.
Design accordingly — unguessable document IDs, per-item scope, and revocability.
Deliberately last, because it publishes the review experience built in Phase 2.

## Decision log

| Decision | Choice | Reason |
|---|---|---|
| Sequence | Migration first, features after | Nothing gets built twice; fixes data loss immediately |
| Comments | Generic primitive | Phase 3 reuses it instead of reimplementing |
| Providers | Drive + OneDrive/SharePoint priority | What the team actually uses |
| Public links | Last | Otherwise the public view is rebuilt after Phase 2 |
