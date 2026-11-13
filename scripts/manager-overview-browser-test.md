# Manager Overview local browser check

These commands use only the disposable PostgreSQL cluster and fictional fixtures created by `offline-browser-server.mjs`. Do not set `EHO_OFFLINE_TEST_DATABASE_URL` to a hosted URL.

Terminal 1:

```sh
EHO_MANAGER_OVERVIEW_FIXTURE=1 EHO_OFFLINE_TEST_DATABASE_URL= EHO_OFFLINE_TEST_API_PORT=43870 npm run offline:test-api
```

Terminal 2:

```sh
EHO_OFFLINE_TEST_API_ORIGIN=http://127.0.0.1:43870 npm run dev -- --host 127.0.0.1 --strictPort
```

Open `http://127.0.0.1:5173`.

- Organisation admin: `offline.admin@example.test`
- Store manager: `offline.manager@example.test`
- Staff: `offline.staff@example.test`
- Fictional password for each: `offline-test-password`

Sign in as `offline.admin@example.test`, open Manager Overview, select All stores, open the second store, then use the header's All stores control to return. In normal mode, `Task Four Partial Failure Store` has an invalid timezone: it must show unavailable while other stores retain real summaries. Repeat at 390px (phone) and 768px (tablet); neither viewport should have horizontal page overflow.

To inspect loading, run `curl 'http://127.0.0.1:43870/__test__/manager-overview-mode?mode=slow'` before entering All stores; expect “Loading store summaries…”, then per-store loading, and reset with `mode=normal`. For the request-error state, set `mode=error`, reload the app and open All stores; expect unavailable/error messaging with no zero counts. The API command separately exercises real authenticated handlers and PostgreSQL scoping. If either API port 43870 or PostgreSQL port 43871 is occupied, choose another free consecutive pair and update both commands and the browser origin.
