# Isolated Android test build

This directory contains the Android test configuration and runbook. It does not contain a signing key, credentials, or a generated Android project.

## Current isolated-environment status

- Vercel test project: `le-feast-compliance-android-test` (`prj_VpxtFTYoacGz2oK54aMR49bDrWmv`)
- Test hostname mapping: `eho-test.lefeast.co.uk` → `codex/pwa-foundation`
- Test-only preview flags: configured on the test project; higher-risk temperature, probe, issue and wastage offline flags remain disabled.
- Neon test database: not provisioned yet. The available Vercel connector exposes the existing Neon installation but this environment has no Neon resource-creation operation or Neon API credentials.
- Test document storage: not provisioned. The storage request was rejected by Vercel for the current scope and must be completed by an authorised Vercel/Blob account connection.
- Public DNS/TLS: not reachable yet; `eho-test.lefeast.co.uk` currently has no public DNS response. Add the UK2-managed DNS record only after the isolated deployment is configured.
- Android tooling: Java 17, Android SDK platform-tools, Android 35 and build-tools 35 are installed locally. Bubblewrap is installed in `/private/tmp/eho-bubblewrap` for this workstation.

## Safety boundary

The test application must use `eho-test.lefeast.co.uk`, an isolated deployment and a separate fictional-data database. It must never use `eho.lefeast.co.uk`, Neon `main`, live Blob storage, or live authentication secrets. Keep the offline flags in `config/android-test.env.example` disabled until the corresponding isolated services are confirmed.

Before completing the test release, obtain or provision:

1. A separate Neon test database containing no operational data, then set its connection string only on the test Vercel project.
2. A test-only authentication secret and private document-storage token on the test project.
3. The UK2 DNS record for `eho-test.lefeast.co.uk`, after the test deployment is ready.
4. A non-production Android signing key kept outside Git; never reuse a Production or commercial key.

## Bubblewrap build procedure

On a dedicated Android build machine with Java 17+, Android SDK/build-tools, `adb` and Bubblewrap installed:

```sh
npx @bubblewrap/cli init --manifest https://eho-test.lefeast.co.uk/manifest.webmanifest
# Review the generated values against android/twa-manifest.test.json.
npx @bubblewrap/cli build
npx @bubblewrap/cli install
```

Use a newly generated test keystore stored outside the repository. Do not reuse the Production or future commercial signing key. After signing, publish the generated certificate SHA-256 fingerprint at:

`https://eho-test.lefeast.co.uk/.well-known/assetlinks.json`

using `android/assetlinks.json.example` as the template. Verify the file over HTTPS before installing the APK. Do not add a DNS record or deploy this configuration as part of local development.

## Required tablet acceptance

1. Install the test APK and confirm the package ID and test hostname.
2. Authenticate with a fictional test account while online.
3. Load each enabled workflow and confirm the displayed store is fictional test data.
4. Enable airplane mode, record an enabled offline response, close/reopen the app, and verify the pending state survives.
5. Reconnect and confirm server acknowledgement and exactly-once persistence.
6. Test lease expiry, logout, account switching, store switching and conflict/error states.
7. Create, acknowledge and resolve a fictional handover note; verify no note is delivered before server confirmation.
8. Confirm that no request is made to the live EHO hostname or Production APIs.

## Minimum hosting requirements

The tablet requires an HTTPS-reachable isolated origin. A local-only Vite/API server is insufficient for TWA testing and must not be exposed to the internet. If an isolated deployment is not approved, Android packaging must remain blocked.
