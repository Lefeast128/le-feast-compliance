import { neon } from "@neondatabase/serverless";

const supplied = process.argv.find(argument => argument.startsWith("--email="))?.slice("--email=".length);
const email = (supplied ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is required to bootstrap the admin");
if (!email || !email.includes("@")) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL or pass --email=<address>");

const sql = neon(url);
await sql`insert into users (organisation_id, email, normalized_email, role, email_verified_at, is_anonymous)
  select id, ${email}, ${email}, 'admin', now(), false
  from organisations order by created_at asc limit 1
  on conflict (normalized_email) do update
  set organisation_id = excluded.organisation_id,
      email = excluded.email,
      role = 'admin',
      email_verified_at = excluded.email_verified_at,
      is_anonymous = false`;
console.log("Admin bootstrap completed");
