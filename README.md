# Le Feast Compliance

Le Feast Compliance is a React/Vite application backed by Vercel Functions,
Neon PostgreSQL, Drizzle ORM, Resend email OTP authentication, private Vercel
Blob storage, Vercel Cron, TouchOffice catalogue sync, and Google Sheets
wastage export.

## Local setup

1. Copy `.env.example` to `.env.local` and fill the server-only values.
2. Install dependencies with `npm install`.
3. Run `npm run db:migrate` and `npm run db:seed` against the intended database.
4. Start the app with `npm run dev`.

Never prefix server-only secrets with `VITE_`; browser code uses same-origin
`/api` requests and secure HttpOnly session cookies.

## Useful commands

- `npm run build` — production TypeScript/Vite build
- `npm test` — complete repository regression suite
- `npm run lint` — ESLint
- `npm run db:generate` — generate a Drizzle migration
- `npm run db:migrate` — apply committed migrations
- `npm run db:seed` — idempotently seed foundation data
- `npm run auth:bootstrap-admin` — explicitly bootstrap the configured Admin

The `api/` directory contains the server-side Vercel endpoints. Domain logic
and database access live under `src/server/`; the browser-facing application
is under `src/`.
