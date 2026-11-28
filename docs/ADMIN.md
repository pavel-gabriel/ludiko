# Admin setup

The `/admin` dashboard (platform stats, content-report queue) is protected by Firebase Auth
(email/password) plus an allow-list in Firestore. There is no backend and no client-side secret.

## How it works
- An admin is a non-anonymous Firebase user whose uid has a document `admins/{uid}` in Firestore.
- `firestore.rules` defines `isAdmin()`; `contentReports` read/update and `teachers` list require it.
- Clients cannot write `admins/*`. A signed-in user may read only their own `admins/{uid}` doc
  (the UI uses this to show the dashboard or a "not an admin" screen).
- The UI check is convenience only; Firestore rules are the real enforcement.

## One-time setup (owner)
1. Firebase console > Authentication > Sign-in method: enable **Email/Password**.
2. Authentication > Users > **Add user** (email + strong password). Copy the user's **UID**.
3. Firestore > Data > create collection `admins`, document ID = that UID, any field (e.g. `createdAt`).
4. Deploy the rules: `firebase deploy --only firestore:rules` (project `ludiko-2e197`).
5. Open `/ludiko/admin` and sign in.

Rules changes merged to `main` are deployed by the `firebase-rules` job of the Deploy workflow (needs the
`FIREBASE_DEPLOY_SERVICE_ACCOUNT` secret; see OWNER_TODO.md). To revoke an admin, delete their `admins/{uid}` doc.
Rules are tested against the emulators with `npm run rules:test` (docs/SECURITY.md).

The old `VITE_ADMIN_PIN` is no longer used and can be removed from env/secrets.
