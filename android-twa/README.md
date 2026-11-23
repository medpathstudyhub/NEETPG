# MEDPATH Android app (Trusted Web Activity)

This folder is the Android packaging hand-off for the MEDPATH PWA. The APK should load the live site, not bundle a frozen copy of the question bank. Website content and feature updates will then appear when users next open/refresh the app, without reinstalling the APK.

## Production details to confirm before signing

- Website: `https://medpathstudyhub.github.io/NEETPG/`
- Start URL: `https://medpathstudyhub.github.io/NEETPG/index.html`
- Android application ID: `in.medpathstudyhub.app` (proposed; confirm it has never been used for another published app before final release)
- App name: `MEDPATH STUDY HUB`
- Display mode: standalone / Trusted Web Activity

## Why this is a project scaffold, not a signed APK

A release APK must be signed with a private Android signing key. The signing key must be created and retained securely by the app owner; it must never be embedded in a public source ZIP or sent in chat. A final TWA also needs a Digital Asset Links statement served from the website origin and containing the SHA-256 fingerprint of the release signing certificate. Until the real release key exists, that statement cannot be completed truthfully.

## Build outline

1. Ensure the PWA is deployed over HTTPS and installable.
2. Create a TWA project with Bubblewrap / Android Studio using the production origin and start URL above.
3. Generate and securely back up the release signing key.
4. Add `/.well-known/assetlinks.json` to the website origin with the exact package ID and SHA-256 certificate fingerprint.
5. Verify the Digital Asset Links association, build a signed release APK, and test install/update on real Android devices.

Do not commit the signing keystore or passwords to GitHub.
