import { createClient, type Client } from "@libsql/client";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dataDirectory } from "./client";
import { createMigrationBackup } from "./backup";

export async function applyMigrations(client: Client, migrationsDirectory: string) {
  await client.execute(`CREATE TABLE IF NOT EXISTS _all_items_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)`);
  const filenames = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name)).sort();
  for (const filename of filenames) {
    const name = filename.slice(0, -4);
    const existing = await client.execute({ sql: "SELECT name FROM _all_items_migrations WHERE name = ?", args: [name] });
    if (existing.rows.length) continue;
    const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
    const transaction = await client.transaction("write");
    try {
      await transaction.executeMultiple(sql);
      await transaction.execute({ sql: "INSERT INTO _all_items_migrations (name, applied_at) VALUES (?, ?)", args: [name, new Date().toISOString()] });
      await transaction.commit();
      console.log(`Applied migration ${name}`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

async function migrate() {
  const directory = dataDirectory();
  await mkdir(directory, { recursive: true });
  const client = createClient({ url: pathToFileURL(path.join(directory, "all-items.db")).href });
  try {
    const existing = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='_all_items_migrations'");
    if (existing.rows.length) {
      const applied = new Set((await client.execute("SELECT name FROM _all_items_migrations")).rows.map(row => String(row.name)));
      const pending = (await readdir(path.join(process.cwd(), "src/db/migrations"))).some(name => /^\d{4}_[a-z0-9_]+\.sql$/.test(name) && !applied.has(name.slice(0, -4)));
      if (pending) console.log(`Verified pre-migration backup: ${await createMigrationBackup(client, directory)}`);
    }
    await applyMigrations(client, path.join(process.cwd(), "src/db/migrations"));
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  migrate().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
