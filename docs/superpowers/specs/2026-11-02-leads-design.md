# Leads (sales pipeline): design

**Date:** 2026-11-02 · **For:** Ichchha (sales), and whoever sells next · **Status:** built on `claude/gifted-goldberg-3yf5wj`, uncommitted; rules not deployed

## Problem
Ichchha prospects tens of businesses a day, mostly by Instagram and TikTok DM. She needs to log each one in seconds, see which are worth chasing, follow up on time, and keep every "no" on record so nobody approaches the same business twice. A lead that signs becomes a client on the board.

## References
Researched Pipedrive (leads vs deals, lost reasons), HubSpot lead status, Close (statuses, smart views), Attio (star ratings, inline table edits), Streak (next-task date, days in stage), Inro (Instagram DM CRM fields), folk (dedupe by social profile). Common pattern: **status + rating + next follow-up**, saved-view tabs, bulk status changes, dedupe on social identity. Notes in `.superpowers/leads-research/research.md` (gitignored).

## Model
Top-level `leads/{id}` (a lead is not a client yet) with `activity/{id}` (same shape as content comments: system moves + user notes).

| Field | Notes |
|---|---|
| name, contactName | business, person spoken to |
| source | instagram, tiktok, facebook, whatsapp, call, email, walk-in, referral, event, website, other |
| status | see below |
| potential | 1-3 stars, absent = not rated |
| instagram, tiktok, facebook, website | handle or link; stored as the handle when a link is pasted |
| phone + whatsapp flag, email | wa.me link adds 977 to a bare Nepali mobile |
| industry, location, note | note = "what kind of lead this is" |
| followUpOn | 'YYYY-MM-DD' calendar day |
| lostReason | only when denied |
| ownerEmail/Name, createdAt, updatedAt, statusAt, clientId | statusAt drives "in this status for 5d"; clientId once onboarded |

### Statuses (Ashim's six plus three)
- **In progress:** To contact · Approached · Positive · Proposal · Roadblock
- **Parked:** Not now (good fit, not ready; gets a 1-month follow-up if none is set) · No reply
- **Closed:** Onboarded (creates the client) · Denied (with reason: not interested, no budget, too expensive, has an agency, in-house, not a fit, wrong contact, other)

## UI
- `/leads`, sidebar row with a badge for follow-ups due, bottom-bar tab on phones, ⌘K entry. Team only (admin + social media manager).
- Tabs: **Active · Follow up · Not now · Onboarded · Denied · All**, with counts. Denied and onboarded are never deleted, only out of the working list.
- Default sort **Best first**: stars, then due/late follow-ups, then recently touched. Filters: search (name, @handle, phone digits, note), source, potential, owner (when there is more than one), status chips within a tab.
- Row: status pill-select, stars, follow-up chip (red late, amber today) with presets, last touched, open-profile and WhatsApp links. Checkbox selection with bulk move (Approached, No reply, Not now, Denied).
- New lead: paste an Instagram/TikTok/Facebook link into the name and the handle, platform and name fill in; live duplicate warning (handle, phone, email or name) with Open; **Add another** keeps source and status for rapid entry. Keys: `n` new, `/` search.
- Lead sheet: contact buttons, note, facts, history with notes, Onboard as client, Edit, Delete (admin only).
- Onboarding: one batch creates the client + its first business + marks the lead onboarded with `clientId`; links to an existing client of the same name instead if there is one.

## Rules
`leads` and `leads/*/activity`: read/create/update for admin + manager, delete admin only, activity append-only. **Must be deployed before the page works in production** (`firebase deploy --only firestore:rules`).

## Not done / next
- A dedicated **Sales** role that sees only Leads (today Ichchha needs a Social Media Manager or admin account).
- Leads tools in the Limi MCP server; Today page section for follow-ups; paginate closed leads past a few thousand.
