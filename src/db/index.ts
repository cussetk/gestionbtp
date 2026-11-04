/**
 * Accès à la base.
 *
 *  - Production / préprod : Neon (Postgres hébergé dans l'UE), via DATABASE_URL.
 *  - Développement et tests : PGlite (vrai Postgres embarqué, aucun serveur, gratuit).
 *
 * Toute lecture/écriture de données métier DOIT passer par `withTenant(orgId, ...)` :
 * la transaction bascule sur le rôle `app_tenant` et pose l'entreprise courante,
 * et Postgres filtre alors lui-même chaque ligne (RLS). Un oubli de filtre dans le code
 * ne peut donc pas exposer les clients d'un autre climaticien.
 */
import path from "node:path";
import { sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "./schema";

type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

const MIGRATIONS_DIR = path.join(process.cwd(), "src/db/migrations");

const globalForDb = globalThis as unknown as { __dbPromise?: Promise<Db> };

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;

  if (url && url.startsWith("postgres")) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const pool = new Pool({ connectionString: url });
    return drizzle({ client: pool, schema }) as unknown as Db;
  }

  // Dev / tests : Postgres embarqué. "memory://" = base jetable (tests).
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".pglite");
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__dbPromise) {
    globalForDb.__dbPromise = createDb().catch((err) => {
      globalForDb.__dbPromise = undefined;
      throw err;
    });
  }
  return globalForDb.__dbPromise;
}

/** Exécute `fn` dans une transaction isolée sur l'entreprise `orgId`. */
export async function withTenant<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    await tx.execute(sql`set local role app_tenant`);
    return fn(tx as Tx);
  });
}

export { schema };
