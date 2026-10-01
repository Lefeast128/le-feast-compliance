import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return url;
}

export function getDb() {
  return drizzle(neon(getDatabaseUrl()));
}
