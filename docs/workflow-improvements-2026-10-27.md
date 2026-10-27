# Workflow improvements — 27 October 2026

## Implemented scope

1. Failed task responses close the response as **Issue reported** while preserving the linked unresolved issue.
2. Contextual corrective-action dropdowns, Other descriptions and explicit action confirmation; structured task options are configurable.
3. All unresolved issues appear below the daily journey, with source, recorded staff, status and review controls.
4. The shared, store-validated active staff control precedes relevant entry workflows.
5. Temperature inputs reuse the scrollable gauge with manual entry and measurement limits.
6. Shared Next/Back/Confirm navigation guides checklists and wastage.
7. Wastage categories refresh on mutations, cross-tab invalidation, focus and polling while open.
8. No aggregate All category; uncategorised products remain under Other.
9. Products sort alphabetically within categories.
10. Wastage follows staff/category/product/details/confirmation; No Waste and one-off items remain available.
11. Permanent manual products are shared through references, with independent Markdown favourites and transaction history.
12. Markdown reminders open outstanding individual actions; only explicit recorded review clears them.
13. Cleaning uses configured weekdays against the location-local date, including DST and UTC+14 regression cases.

## Verification

- Full npm test passed, including the real Shift Handover API/PostgreSQL test. The fixture now uses the actual foreign-store staff ID, and child-process cleanup handles an already-exited process. No test was disabled.
- TypeScript/production build and changed-file ESLint passed.
- test-workflow-improvements.mjs exercises real authenticated API handlers and disposable PostgreSQL: category changes, shared manual products, issue outcomes, idempotent replay, concurrent increments, reminder review, archive behaviour and permissions.
- Real offline operational and temperature/record integration suites passed: Cleaning, Security, Additional Checks, fridge/probe readings, issues, rechecks and wastage, concurrent replay and cross-tenant rejection.
- Local browser inspection used fictional accounts: guided wastage at 375px, cleaning failure/action confirmation and dashboard issue display; Markdown shared-product selection at 768px. No physical Android or network-disconnection browser test is claimed for this release.

## Data and rollback

Migration 0027 adds two nullable product references and their indexes. It does not rewrite products, quantities, responses, categories or historical evidence. Existing clients remain compatible. Roll back application code if necessary; retain the additive columns and records. Never drop data to roll back the UI.

Production migration 0027 was applied transactionally through the authorised Neon Console on project odd-dew-18814819, main br-steep-forest-b8sqn9jg, neondb. The exact SQL file hash and journal timestamp were recorded in the same transaction after checking migration 0026. Both indexes and the marker were verified. Before/after counts remained four active stores, six accounts, six wastage records and ten Markdown items. No operational record was changed. Six-hour point-in-time recovery was available before migration. Previous application rollback: dpl_J1G757pwuxqyMydFcrfyQC66cWJD.
