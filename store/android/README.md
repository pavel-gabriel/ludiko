# Android (Google Play) via Trusted Web Activity

Ludiko is a PWA. For Google Play it is wrapped with **Bubblewrap** (Google's TWA generator). The wrapper has no
code of its own: it opens `https://www.ludiko.ro/` full-screen in Chrome, verified through Digital Asset Links.
Nothing is added to `package.json`; the CLI runs through `npx` pinned to an exact version (`BUBBLEWRAP_CLI` in
`.github/workflows/deploy.yml`, currently `@bubblewrap/cli@1.28.0`).

Files here:

| File | What it is |
|---|---|
| `twa-manifest.json` | Bubblewrap project config. **Placeholders the owner confirms:** `packageId` (`ro.ludiko.app`, permanent once published), `host`, `signingKey.alias`. |
| `../../public/.well-known/assetlinks.json` | Digital Asset Links, served at `https://www.ludiko.ro/.well-known/assetlinks.json`. Contains a **placeholder** SHA-256. |

## 1. Why the domain matters (Digital Asset Links)

Android only trusts the TWA if `https://<host>/.well-known/assetlinks.json` exists **at the root of the host**.
A project site served from `https://pavel-gabriel.github.io/ludiko/` can therefore **never** be verified (the file
would have to be at `https://pavel-gabriel.github.io/.well-known/...`, which belongs to the user-site, not to
this repo).

The app is already built for the root of a custom domain: `public/CNAME` = `www.ludiko.ro` and `vite.config.ts`
uses `base = '/'`. Options, in order of preference:

1. **Keep the custom domain `www.ludiko.ro`** (needs the domain registered and DNS pointing to GitHub Pages;
   HTTPS enforced in repo Settings > Pages). Nothing else to change; `host` in `twa-manifest.json` is already
   `www.ludiko.ro`. If you want the bare `ludiko.ro` to work too, add the apex `A/AAAA` records and let GitHub
   redirect to `www`.
2. **A user-site repo** `pavel-gabriel/pavel-gabriel.github.io` serving at `https://pavel-gabriel.github.io/`
   (root), with Ludiko deployed there. Free, no domain purchase, but then `base` is `/`, `host` is
   `pavel-gabriel.github.io` and the URL is tied to the GitHub account name.
3. **Another static host** with its own hostname (Cloudflare Pages, Netlify): free, root of the host; set `host`
   accordingly.

Do not use a `.../ludiko/` sub-path with a TWA.

### Hidden-folder caveat in the Pages deploy (must be fixed before the first release)

`actions/upload-pages-artifact@v3` (used by the `build` job) **excludes dotfiles and dot-folders**, so
`dist/.well-known/` would not be published. Before releasing to Play, replace its step with a manual tarball
that keeps hidden files (this is the same thing the action does, minus the exclusion):

```yaml
      - name: Package the Pages artifact (keeps .well-known)
        run: tar --dereference --hard-dereference --directory dist -cvf "$RUNNER_TEMP/artifact.tar" --exclude=.git --exclude=.github .
      - uses: actions/upload-artifact@v4
        with:
          name: github-pages
          path: ${{ runner.temp }}/artifact.tar
          retention-days: 1
          if-no-files-found: error
```

Verify after deploy: `curl -s https://www.ludiko.ro/.well-known/assetlinks.json` returns the JSON with
`content-type: application/json` (no redirect). It was not changed in this repo because a broken Pages deploy is
worse than a missing link file while no signing key exists yet.

## 2. One-time owner steps

1. Create a **Google Play Console** account (US$25 one-time; identity verification; personal accounts created
   after Nov 2023 must run a closed test with 12+ testers for 14 days before production).
2. Generate the upload key on your computer (keep a backup, never commit it):
   ```bash
   keytool -genkeypair -v -keystore android.keystore -alias ludiko -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 android.keystore    # macOS: base64 -i android.keystore
   ```
3. Add GitHub secrets (repo Settings > Secrets and variables > Actions):
   `ANDROID_KEYSTORE_BASE64` (output above), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
4. Run GitHub > Actions > **Deploy to GitHub Pages** > Run workflow > task **`build-android`**. Without the four
   secrets it only prints a warning. With them it uploads the artifact `ludiko-android-aab` (an `.aab`) and prints
   the SHA-256 of the upload key in the log.
5. In Play Console create the app, upload the `.aab` to a closed test track. Use **Play App Signing** (default):
   Google re-signs the app with its own key. Copy the SHA-256 shown under *Setup > App signing* (the
   *App signing key certificate*, not the upload certificate) into `public/.well-known/assetlinks.json`
   (replace the zeros; you may list both the upload and the app-signing fingerprint). Commit, deploy, verify
   with `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.ludiko.ro&relation=delegate_permission/common.handle_all_urls`.
6. Fill the store listing from `store/listing/ro.md` and `en.md` (descriptions, IARC answers, Data safety,
   Families policy). Privacy policy URL: `https://www.ludiko.ro/privacy`.

## 3. Local build (alternative to CI)

```bash
cd store/android
npx --yes @bubblewrap/cli@1.28.0 doctor          # checks JDK 17 + Android SDK, offers to install them
npx --yes @bubblewrap/cli@1.28.0 update --manifest=twa-manifest.json
npx --yes @bubblewrap/cli@1.28.0 build --manifest=twa-manifest.json
```

Increase `appVersion` (integer) in `twa-manifest.json` for every upload to Play; `appVersionName` is the label.
The generated Gradle project, `*.aab`, `*.apk` and the keystore are git-ignored (see the root `.gitignore`).

## 4. Notes and status

- The CI job was written from Bubblewrap's documented non-interactive flow (`BUBBLEWRAP_KEYSTORE_PASSWORD` /
  `BUBBLEWRAP_KEY_PASSWORD`, `~/.bubblewrap/config.json`) but could **not** be run here (no secrets, no Android
  SDK). Expect to iterate once on the first real run.
- `fallbackType: customtabs`: if verification fails the app opens in a Chrome Custom Tab with a URL bar. If you
  see the URL bar in the installed app, the asset links are wrong.
- `targetSdkVersion` must follow Play's yearly requirement; raise it in `twa-manifest.json` when Play asks.
- TWA notifications: Web Push (the existing reminders) works through Chrome; `enableNotifications` is on.
- The app has no purchases and no ads. External links and e-mail go through the in-app parental gate
  (`src/components/ui/GatedLink.tsx`), as the Families policy expects.
