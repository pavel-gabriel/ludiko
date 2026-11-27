# iOS (App Store) via Capacitor

Capacitor wraps the **built** web app (`dist/`) in a native WKWebView shell and ships it inside the app bundle, so
Ludiko works fully offline from the first launch. **Capacitor is deliberately not in the repo's root
`package.json`** (the web bundle must not grow): the native project lives in `store/ios/` and is created on the
owner's Mac with the pinned versions below. Nothing here has been run (no Mac available to the agent); expect small
adjustments on the first real build.

Pinned versions (verified on npm 2026-11-27): `@capacitor/core|cli|ios` **8.6.3**, `@capacitor/local-notifications`
**8.3.1**. Capacitor 8 needs a Mac with a current Xcode (use the Xcode version App Store Connect requires for new
uploads).

## What you need first (owner)

- An Apple Developer Program membership (US$99 / year) and App Store Connect access.
- A Mac with Xcode + Command Line Tools, Node 22, CocoaPods or Swift Package Manager as Capacitor 8 asks.
- Decide the bundle id. `ro.ludiko.app` in `capacitor.config.json` is a **placeholder**; it is permanent once the
  app exists in App Store Connect. Keep it identical to the Android package id for tidiness.

## Steps (on the Mac)

```bash
git clone https://github.com/pavel-gabriel/ludiko.git && cd ludiko
npm ci
npm run build                                  # produces dist/ (served at "/", fine for the capacitor:// scheme)

cd store/ios                                   # capacitor.config.json is already here
npm init -y
npm install --save-exact @capacitor/core@8.6.3 @capacitor/cli@8.6.3 @capacitor/ios@8.6.3 @capacitor/local-notifications@8.3.1

rm -rf www && cp -R ../../dist www             # webDir in capacitor.config.json
npx cap add ios                                # creates store/ios/ios/ (git-ignored)
npx cap sync ios                               # copies www/ + plugins into the Xcode project
npx cap open ios                               # opens Xcode
```

In Xcode: select the *App* target, set **Team**, confirm the bundle id, set version/build, set *Deployment Info*
to iPhone + iPad (portrait and landscape), add the icon (use `public/icons/icon-512.png`; Xcode wants a single
1024x1024 PNG without transparency: render `public/icons/icon.svg` at 1024 with `node scripts/generate-icons.mjs`
adapted, or export from any editor), then *Product > Archive > Distribute App > App Store Connect*.
Every web update: `npm run build`, recopy to `store/ios/www`, `npx cap sync ios`, bump the build number, archive.

Do not add a `server.url` to `capacitor.config.json` (loading the live website is exactly what guideline 4.2
rejects). The bundled copy is the point.

### Things to check on the first run

- Routing: the app uses `BrowserRouter`; Capacitor serves `index.html` for unknown paths, so deep links work.
- The service worker does not register under `capacitor://` (expected; assets are local anyway). `PwaToast`
  must not show an "update available" prompt there. If it does, hide it when `window.Capacitor` exists.
- Firebase is optional and only reached over HTTPS; the offline-first learning path needs none of it.
- `limitsNavigationsToAppBoundDomains` is `true`: add `WKAppBoundDomains` to `Info.plist` listing your Firebase
  hosts only if you use them from the app (`<key>WKAppBoundDomains</key><array><string>ludiko-2e197.firebaseapp.com</string>...`).

## App Store review risks and how Ludiko answers them

### 4.2 Minimum functionality (the classic "it is just a website" rejection)

A wrapper that only shows a website is rejected. Ludiko has to be able to show native-feeling value:

| Argument | Where in the app / what to add |
|---|---|
| Works **fully offline** from the bundle (no network needed to learn) | Already true; mention it in the review notes. |
| **Local notifications** for the daily "bit" reminder, no server, no push token | Add `@capacitor/local-notifications` (pinned above) and schedule the existing daily reminder locally when running under Capacitor (`window.Capacitor?.isNativePlatform()`), instead of Web Push, which WKWebView does not support. This is the single most useful native feature. |
| Child profiles, progress, stickers, mascot stored on device | Already true. |
| Haptics on correct answers (optional) | `@capacitor/haptics`, small. |
| Not a repackaged site: content and engine ship in the binary | Say so in the review notes. |

Review notes template: "Ludiko is an offline learning app. All lessons and exercises are bundled in the app and
work without internet. Parents can enable a daily local reminder. No account is needed. There are no
purchases or ads. External links and the e-mail address are behind a parental gate."
No demo account is needed (no login required to use the app). The teacher/parent e-mail accounts are optional and
account deletion is in-app (Settings / family account), which guideline 5.1.1(v) requires.

### Kids Category (guideline 1.3) and children's privacy (5.1.4)

If you choose the **Kids Category** (recommended: it matches the product), these rules are mandatory:

- **No third-party analytics or advertising** at all. Ludiko has none (`docs/PRIVACY_DATA_MAP.md` §0, §3).
  Firebase Auth/Firestore/RTDB are functional services, not analytics; do not enable Google Analytics for
  Firebase and never add the Firebase Analytics SDK to the native project.
- **Parental gate before external links, e-mail, purchases and settings that lead out of the app.** Implemented:
  `src/components/ui/ParentalGate.tsx` ("ask an adult: what is 7 x 8?", four choices, new question each time) and
  `src/components/ui/GatedLink.tsx`. Audit result: the only places that leave the app are the licence/source links and
  `mailto:` on `/credits` and the `mailto:` in the privacy/terms pages; all now go through `GatedLink`.
  Rule for the future: any new `https:`/`mailto:` link or purchase must use `GatedLink` (or `ParentalGate`).
  `tests/store.test.tsx` fails if an `<a href="http...">` or `mailto:` appears in `src/` outside it.
- No behavioural advertising, no links to the web "for more content", no social features for children.
  Ludiko's multiplayer rooms use random animal names and no chat. Keep it that way.
- Provide the privacy policy URL (`https://www.ludiko.ro/privacy`) in App Store Connect and in-app (`/privacy` is
  reachable from `/credits`).
- Age band: choose **6-8 or 9-11** (Ludiko targets Romanian grades 0-VIII, so 6-11 is the honest core; Apple lets you
  pick one band: take **9-11**, or **6-8** if the lower grades are the main audience).
- App Privacy ("nutrition label"): **Data Not Collected** is only true if Firebase is not enabled in the shipped
  build. With parent accounts, classes or multiplayer enabled declare: Email address (parent/teacher accounts),
  User ID (anonymous uid), Other user content (child nickname, avatar) as "linked to the user", not used for tracking.
  See `store/listing/en.md` (Data safety section) for the field-by-field answers.

### Other points

- 2.1 App completeness: the "beta / content in review" notice is fine, but no placeholder screens or dev routes
  (`/dev/*`, `/admin`) should be reachable from the UI. Consider hiding `/dev/*` in production builds.
- 5.1.1(v): in-app account deletion exists (family and teacher accounts).
- 4.8 Sign in with Apple: only needed if a third-party social login is offered. Ludiko offers none.
- Screenshots: required sizes include 6.9" iPhone (1320x2868) and 13" iPad (2064x2752); regenerate with
  `scripts/generate-screenshots.mjs` adapting the viewport (`public/screenshots/` holds PWA-sized ones only).
- Export compliance: the app uses only HTTPS (standard encryption), answer "exempt" (`ITSAppUsesNonExemptEncryption = NO`).
