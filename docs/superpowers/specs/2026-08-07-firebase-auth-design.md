# Firebase Auth migration

**Date:** 2026-08-07
**Status:** approved, implemented

## Why

Sign-in was checked in the browser against a `users` collection that stored plaintext
passwords ([AuthContext.tsx](../../../src/contexts/AuthContext.tsx)). Nothing ever
authenticated to Firebase, so `request.auth` was always null and the security rules had to
be fully open for the app to work. Anyone holding the web API key — which ships in the JS
bundle by design — could read every password and delete every record.

A separate incident exposed the fragility: the project's test-mode rules expired, Firestore
began returning `PERMISSION_DENIED` for all reads and writes, and the app kept *looking*
healthy because it rendered from a `localStorage` cache. This migration closes the
underlying hole rather than reopening the rules.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Admin operations | Client SDK only, no Cloud Functions | Stays on the free Spark plan; no billing account required |
| Existing accounts | Recreated by hand through the Team page | Small team; avoids throwaway migration tooling and a window of open rules |
| Rule strictness | Full role enforcement | Enforcing roles only by hiding UI buttons is not enforcement |
| Rules testing | Manual checklist + live probes | Project has no test framework; the emulator needs a Java install |

## Data model

Firebase Auth owns credentials. Firestore `users/{uid}` holds the profile only:
`name`, `email`, `role`, `assignedClientIds`, `createdAt`. The document ID is the Auth UID
rather than an auto-generated one, and the `password` field is gone permanently.

**No profile document means no access.** That is what makes deletion effective: the Auth
record survives, but rules grant it nothing, so a removed person is locked out immediately.

`clients` is unchanged.

## Sign-in

`AuthContext` is built on `onAuthStateChanged`. On sign-in it subscribes to `users/{uid}`
with `onSnapshot`, so role changes and deletions take effect live rather than at next
refresh. It exposes four states:

- `loading` — Auth has not resolved yet. Routes must wait here; the previous implementation
  read the session synchronously from `localStorage` and would otherwise flash the login page.
- `signed-in` — profile loaded.
- `signed-out` — no Auth user.
- `unprovisioned` — authenticated but the profile document is missing or unreadable. Signs
  out and surfaces a notice on the login screen.

The hardcoded `ADMIN_EMAIL` / `ADMIN_PASSWORD` constants and the `seedAdminIfNeeded` block
are deleted. Those credentials remain in git history and should be treated as compromised.

## Provisioning without self-eviction

`createUserWithEmailAndPassword` signs in whoever it creates, which would evict the admin.
Provisioning therefore runs against a second named Firebase app instance
(`initializeApp(config, 'provisioning')`) with its own auth object: create there, write the
profile keyed by the returned UID, then sign the secondary out. The primary session is
untouched.

The password is used once at creation and never stored or displayed.

## Team page changes

Two capabilities are removed because the client SDK cannot perform them:

- **Password reveal.** Auth stores only salted hashes; passwords cannot be read back by
  anyone, including admins. Replaced by a per-user **Send reset email** action.
- **Email editing.** Changing another account's email is an admin-only operation.

Name, role, and assigned clients still edit normally. Delete removes the profile document,
revoking access immediately, and leaves a dormant Auth record to be cleared from the console
periodically.

## Rules

Helpers resolve the caller's profile, then:

- `users/{uid}` — read your own profile; admins read and write all. **Only admins may write
  any profile**, which is what prevents self-promotion to admin.
- `clients/{id}` — admins and social media managers read and write all; client-role users
  read and update only the clients in their own `assignedClientIds`.

### Known limitation

Content lives as an array on the client document, so rules cannot restrict *which fields
inside that array* a client-role user modifies. An assigned client is confined to their own
client document, but review fields cannot be isolated from the rest of it. Fixing this
properly means moving content into a subcollection — deliberately out of scope here.

## Rollout order

The Firestore console bypasses security rules, so bootstrapping works even while the
database is locked.

1. Console → Authentication → enable Email/Password sign-in
2. Console → Authentication → add the admin login; copy its UID
3. Console → Firestore → create `users/{that-uid}` with `role: "admin"`
4. Publish the new rules; deploy the new build
5. Re-add the team through the Team page

The temporary open rules drafted during the outage are never published.

## Verification

No emulator. Confidence comes from:

- `npm run build` (tsc + vite) passing
- Live `curl` probes against the Firestore REST API confirming unauthenticated access is
  refused after the rules are published
- A manual per-role checklist covering sign-in, provisioning, deletion-revokes-access, and
  client-role isolation
