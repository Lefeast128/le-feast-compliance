import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";

let pool: NeonPool | PgPool | undefined;
let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePg> | undefined;
type TestPoolClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>; release: () => void };
type DatabasePool = { connect: () => Promise<TestPoolClient>; end: () => Promise<void> };

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return url;
}

function isLocalTestDatabase() {
  const driver = process.env.EHO_TEST_DATABASE_DRIVER;
  if (!driver) return false;
  if (driver !== "pg" || process.env.NODE_ENV !== "test") {
    throw new Error("The local PostgreSQL adapter is restricted to NODE_ENV=test");
  }
  const url = new URL(getDatabaseUrl());
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("The local PostgreSQL adapter only accepts a loopback database URL");
  }
  return true;
}

export function getDb() {
  if (db) return db;
  if (isLocalTestDatabase()) {
    const localPool = pool instanceof PgPool ? pool : new PgPool({ connectionString: getDatabaseUrl() });
    pool = localPool;
    db = drizzlePg(localPool);
  } else {
    const neonPool = pool instanceof NeonPool ? pool : new NeonPool({ connectionString: getDatabaseUrl() });
    pool = neonPool;
    db = drizzleNeon(neonPool);
  }
  return db;
}

export function getPool(): DatabasePool {
  if (isLocalTestDatabase()) pool ??= new PgPool({ connectionString: getDatabaseUrl() });
  else pool ??= new NeonPool({ connectionString: getDatabaseUrl() });
  return pool as unknown as DatabasePool;
}
