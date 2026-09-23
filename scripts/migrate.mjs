/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 *
 * Run with:  npm run db:migrate
 * (which passes --env-file=.env so the URL never has to be typed on a shell
 * line where it would land in shell history.)
 *
 * The schema is idempotent, so re-running it is safe.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set.\n" +
      "Put your Neon pooled connection string in .env first — see .env.example.",
  );
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = await readFile(join(root, "db", "schema.sql"), "utf8");

// The HTTP driver runs one statement per call, so split the file up. Line
// comments are stripped first so a ';' inside one cannot split a statement.
const statements = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const sql = neon(url);

for (const statement of statements) {
  const label = statement.replace(/\s+/g, " ").slice(0, 70);
  process.stdout.write(`  ${label}… `);
  await sql.query(statement);
  console.log("ok");
}

const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM scores`;
console.log(`\nSchema applied. scores table currently holds ${count} row(s).`);
