import { neon } from "@neondatabase/serverless";
import { FOUNDATION_LOCATIONS, FOUNDATION_ORGANISATION, OPERATIONAL_DEFAULTS } from "../src/server/db/seed.ts";

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

const seededShortNames = new Set(FOUNDATION_LOCATIONS.map(location => location.shortName));
const locations = (await sql`select id, organisation_id, short_name from locations where active = true`).filter(location => seededShortNames.has(location.short_name));
for (const location of locations) {
  for (const [order, name] of OPERATIONAL_DEFAULTS.wastage.entries()) {
    const existing = await sql`select id from wastage_items where location_id = ${location.id} and name = ${name} limit 1`;
    if (!existing.length) await sql`insert into wastage_items (location_id, name, active, sort_order) values (${location.id}, ${name}, true, ${order})`;
  }
  for (let order = 1; order <= 4; order += 1) {
    const name = `Fridge ${order}`;
    const existing = await sql`select id from equipment where location_id = ${location.id} and name = ${name} limit 1`;
    if (!existing.length) await sql`insert into equipment (location_id, name, type, preferred_temperature, maximum_temperature, sort_order, active) values (${location.id}, ${name}, 'Food fridge', 5, 8, ${order - 1}, true)`;
  }
  for (const session of ["AM", "PM"]) {
    for (const [order, question] of OPERATIONAL_DEFAULTS.security.entries()) {
      const existing = await sql`select id from security_questions where location_id = ${location.id} and session = ${session} and question = ${question} limit 1`;
      if (!existing.length) await sql`insert into security_questions (location_id, session, question, sort_order, active) values (${location.id}, ${session}, ${question}, ${order}, true)`;
    }
  }
  for (const [checklist, questions] of [["opening", OPERATIONAL_DEFAULTS.opening], ["closing", OPERATIONAL_DEFAULTS.closing]]) {
    for (const [order, question] of questions.entries()) {
      const existing = await sql`select id from checklist_questions where location_id = ${location.id} and checklist = ${checklist} and question = ${question} limit 1`;
      if (!existing.length) await sql`insert into checklist_questions (location_id, checklist, question, sort_order, active) values (${location.id}, ${checklist}, ${question}, ${order}, true)`;
    }
  }
  for (const [order, name] of OPERATIONAL_DEFAULTS.cleaning.entries()) {
    const existing = await sql`select id from cleaning_tasks where location_id = ${location.id} and name = ${name} limit 1`;
    if (!existing.length) await sql`insert into cleaning_tasks (location_id, name, frequency, weekdays, active, sort_order) values (${location.id}, ${name}, 'daily', '[]'::jsonb, true, ${order})`;
  }
  for (const [order, title] of OPERATIONAL_DEFAULTS.training.entries()) {
    const existing = await sql`select id from training_requirements where location_id = ${location.id} and title = ${title} limit 1`;
    if (!existing.length) await sql`insert into training_requirements (location_id, title, active, sort_order) values (${location.id}, ${title}, true, ${order})`;
  }
}
console.log(`Seeded ${FOUNDATION_LOCATIONS.length} Le Feast locations`);
