# Third-party software notices

This notice accompanies the Le Feast Compliance application. It is generated from the repository lockfiles and the local CycloneDX SBOM during the commercial-security hardening review. The SBOM contains the complete package/version inventory; this file records the attribution and review policy that must ship with commercial distributions.

## Inventory

- Package inventory: `package-lock.json` and `bun.lock`
- SBOM format: CycloneDX 1.5
- Components in the generated SBOM: 507
- Dominant license families: MIT, Apache-2.0, ISC, BSD-2-Clause and BSD-3-Clause

The application uses third-party packages in three scopes:

1. **Browser-distributed:** React, React DOM, React Router, Radix UI, Tailwind, Lucide, Recharts, Framer Motion and their transitive dependencies.
2. **Server-only:** Neon, Vercel Blob/OIDC, Resend integration dependencies, Google APIs and ExcelJS.
3. **Build/test-only:** Vite, TypeScript, ESLint, PostCSS, Tailwind build tooling and their transitive dependencies.

The package scope is an engineering classification, not a legal conclusion. The production browser bundle and Android wrapper must be rechecked whenever dependencies change.

## Attribution obligations

Permissive licences remain subject to their notice and attribution conditions. The release process must preserve the licence text and copyright notices supplied by each package, including MIT, Apache-2.0, ISC and BSD packages. Apache-2.0 packages also require preservation of applicable NOTICE information and do not grant trademark rights.

The following packages/data require explicit release review:

- `jszip`: package metadata reports `MIT OR GPL-3.0-or-later`. The selected distribution licence must be documented; GPL must not be selected for a browser or Android distribution without legal approval.
- `caniuse-lite`: CC-BY-4.0 metadata requires attribution for the included data.
- MPL-2.0 packages: retain the licence and review file-level copyleft obligations if modified.
- Packages with Blue Oak, Unlicense, Python-2.0 or unknown metadata: confirm the exact package, version and licence text before release.

## Unresolved provenance

The repository does not establish ownership for every logo, icon, generated asset, copied UI pattern or historical contribution. Le Feast branding, operational content and store-specific configuration are proprietary candidates, but ownership should be confirmed by the rights holder. The presence of a package in this notice is not a warranty that all commercial rights have been cleared.

## Release controls

Before a commercial release:

1. Generate a fresh CycloneDX or SPDX SBOM from the exact lockfile.
2. Attach the complete package licence texts and copyright notices to the release artefact.
3. Reconcile direct and transitive licences with legal counsel.
4. Confirm browser, server and Android-wrapper dependency scopes separately.
5. Record approval for dual-licensed, unknown or non-standard packages.

This notice is an engineering inventory and attribution aid, not legal advice or a declaration of commercial clearance.
