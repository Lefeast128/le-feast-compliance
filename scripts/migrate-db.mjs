import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is required to apply migrations");

await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
console.log("Database migrations applied");
