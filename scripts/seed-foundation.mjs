import { neon } from "@neondatabase/serverless";
import { FOUNDATION_LOCATIONS, FOUNDATION_ORGANISATION } from "../src/server/db/seed.ts";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is required to seed the foundation");
if (process.env.SEED_CONFIRM !== "LE_FEAST_FOUNDATION") {
  throw new Error("Set SEED_CONFIRM=LE_FEAST_FOUNDATION to run the controlled foundation seed");
}

const sql = neon(url);
await sql`insert into organisations (name, timezone)
  values (${FOUNDATION_ORGANISATION.name}, ${FOUNDATION_ORGANISATION.timezone})
  on conflict (name) do update set timezone = excluded.timezone`;

for (const { name, shortName } of FOUNDATION_LOCATIONS) {
  await sql`insert into locations (organisation_id, name, short_name, timezone, active)
    select id, ${name}, ${shortName}, 'Europe/London', true
    from organisations where name = ${FOUNDATION_ORGANISATION.name}
    on conflict (organisation_id, short_name) do update
    set name = excluded.name, timezone = excluded.timezone, active = true`;
}
console.log(`Seeded ${FOUNDATION_LOCATIONS.length} Le Feast locations`);
