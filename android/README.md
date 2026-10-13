# Internal Android test build

This directory contains the Android test configuration and runbook. It does not contain a signing key, credentials, or a generated Android project.

## Current environment status

- The TWA uses the established live hostname: `eho.lefeast.co.uk`.
- The package ID is deliberately non-production: `uk.co.lefeast.eho.test`.
- Offline flags remain disabled in Production pending physical-device acceptance.
- The Android signing key is non-production and must remain outside Git.
- Bubblewrap project generation was completed locally; APK compilation still requires a valid Android SDK installation discoverable by the build tool.

## Safety boundary

The internal test package points at `eho.lefeast.co.uk`, so it must not be used for write-based acceptance testing until a safe, approved test-data procedure exists. Keep offline flags disabled in Production and never place Production credentials or signing material in the repository.

Before physical testing, obtain approval for a safe test-data environment or an explicitly scoped test window. A non-production Android signing key must remain outside Git; never reuse a Production or commercial key.

## Bubblewrap build procedure

On a dedicated Android build machine with Java 17+, Android SDK/build-tools, `adb` and Bubblewrap installed:

```sh
npx @bubblewrap/cli init --manifest https://eho.lefeast.co.uk/manifest.webmanifest
# Review the generated values against android/twa-manifest.test.json.
npx @bubblewrap/cli build
npx @bubblewrap/cli install
```

Use a newly generated test keystore stored outside the repository. Do not reuse the Production or future commercial signing key. After signing, publish the generated certificate SHA-256 fingerprint at:

`https://eho.lefeast.co.uk/.well-known/assetlinks.json`

using `android/assetlinks.json.example` as the template. Verify the file over HTTPS before installing the APK. Do not add a DNS record or deploy this configuration as part of local development.

## Required tablet acceptance

1. Install the test APK and confirm the package ID and test hostname.
2. Authenticate with a fictional test account while online.
3. Load each enabled workflow and confirm the displayed store is fictional test data.
4. Enable airplane mode, record an enabled offline response, close/reopen the app, and verify the pending state survives.
5. Reconnect and confirm server acknowledgement and exactly-once persistence.
6. Test lease expiry, logout, account switching, store switching and conflict/error states.
7. Create, acknowledge and resolve a fictional handover note; verify no note is delivered before server confirmation.
8. Confirm that no request is made to an unintended hostname or database.

## Minimum hosting requirements

The tablet requires an HTTPS-reachable origin. A local-only Vite/API server is insufficient for TWA testing. Because this package uses the live hostname, write-based acceptance must remain blocked until a safe, approved test-data procedure is available.
