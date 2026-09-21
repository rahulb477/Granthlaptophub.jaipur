import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * LEGACY Postgres layer — the Admin Panel runs on Firebase/Firestore and
 * does NOT require DATABASE_URL.
 *
 * Two build/runtime safety guarantees:
 *
 *  1. This module must NEVER throw at import time. Next.js imports every
 *     route module during `npm run build` ("collecting page data"), so a
 *     top-level `throw` here crashes production builds on hosts where
 *     DATABASE_URL is intentionally absent.
 *
 *  2. This module must NEVER open a database connection at import time.
 *     Previously `createPool()` ran at module scope, so simply importing any
 *     legacy route (even one that is never called) constructed a pg Pool
 *     during startup/build whenever DATABASE_URL happened to be present.
 *     The pool is now created lazily, on the first actual query only.
 *
 * If DATABASE_URL is set, a real pool/drizzle client is created on demand
 * (legacy routes keep working unchanged). If it is absent, any real usage
 * throws a clear, actionable error — imports and builds stay safe either way.
 *
 * No PostgreSQL dependency is required by the Firebase architecture, and no
 * placeholder DATABASE_URL is ever invented to satisfy a build.
 */

type Db = ReturnType<typeof drizzle>;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: Db;
};

/** Creates (or reuses) the pg Pool. Called only from a real query path. */
function getPool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  if (globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }
  const pool = new Pool({ connectionString: databaseUrl });
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  return pool;
}

/** Lazily resolves the drizzle client on first property access. */
function getDb(): Db {
  if (globalForDb.__arenaNextJsPostgresqlDb) {
    return globalForDb.__arenaNextJsPostgresqlDb;
  }
  const pool = getPool();
  if (!pool) {
    throw new Error(
      "DATABASE_URL is not configured. This project uses Firebase/Firestore; " +
        "the legacy Postgres layer is disabled. This endpoint is not part of the " +
        "Firebase architecture and should not be called."
    );
  }
  const client = drizzle(pool);
  globalForDb.__arenaNextJsPostgresqlDb = client;
  return client;
}

/**
 * Import-safe proxy. Constructing/importing it touches nothing; the real
 * client (and therefore the connection) is created on first property access.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    if (prop === "then") return undefined; // never look thenable to await
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as Db;

/** Legacy export kept for compatibility. Null unless a pool already exists. */
export function getExistingPool(): Pool | null {
  return globalForDb.__arenaNextJsPostgresqlPool ?? null;
}
