# MEDPATH PWA + Android App rollout

## What has been added

- `manifest.webmanifest`: install identity, standalone display and MEDPATH icons.
- `icons/medpath-192.png` and `icons/medpath-512.png`: launcher icons.
- `sw.js`: network-first caching for the student experience and previously visited resources; admin and login HTML are deliberately excluded from cache.
- `pwa.js`: service-worker registration and Android/desktop install prompt.
- All existing HTML pages reference the manifest, Apple touch icon, theme colour and PWA registration script.
- `android-twa/`: proposed Trusted Web Activity packaging settings and secure signing / domain-verification instructions.

## Deploy the PWA

1. Keep a backup of the currently deployed repository.
2. Copy the contents of this project folder into the same GitHub Pages repository and preserve all existing files.
3. Commit and push the changes to the existing publishing branch.
4. Open `https://medpathstudyhub.github.io/NEETPG/` in Chrome on Android. Use the browser's Install app option if it is not prompted automatically.
5. Test the home page, MBBS subject navigation, topic directory, NEET PG, INI-CET and question images.

The service worker uses network-first fetching for same-origin content, so published question-bank and page changes are preferred over cached copies. Previously visited resources may be available offline. Admin and login pages are not cached. A first visit still needs internet access.

## Android APK

The Android wrapper is intentionally prepared as a TWA hand-off, not represented as a finished APK. A release APK requires a privately-held signing key and a matching Digital Asset Links statement. Generate the release key in a secure local environment, back it up safely, and never commit it to the public repository. Then complete the steps in `android-twa/README.md`.

The proposed package ID is `in.medpathstudyhub.app`; verify it is unused before creating the final Android project. The live site remains the content source, so website-only feature and question updates do not require a new APK. Wrapper changes or native Android features generally do.

## Rollback

If any unexpected issue appears, revert the PWA-related commit in GitHub. The original site source was not deleted by this preparation. Do not remove old project files as part of the PWA deployment.
