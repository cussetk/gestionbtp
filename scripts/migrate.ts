/**
 * Applique les migrations sur la base Neon (DATABASE_URL).
 * Usage : npm run db:migrate
 * (En développement avec PGlite, les migrations s'appliquent toutes seules au démarrage.)
 */
import "dotenv/config";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgres")) {
    console.error("DATABASE_URL manquante (chaîne de connexion Neon).");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: path.join(process.cwd(), "src/db/migrations"),
  });
  await pool.end();
  console.log("Migrations appliquées.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
