import { createClient } from "@libsql/client";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dataDirectory } from "./client";

async function migrate() {
  const directory = dataDirectory();
  await mkdir(directory, { recursive: true });
  const client = createClient({ url: pathToFileURL(path.join(directory, "all-items.db")).href });
  const name = "0001_foundation";
  await client.execute(`CREATE TABLE IF NOT EXISTS _all_items_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL)`);
  const applied = await client.execute({ sql: "SELECT name FROM _all_items_migrations WHERE name = ?", args: [name] });
  if (applied.rows.length === 0) {
    const migration = await readFile(path.join(process.cwd(), "src/db/migrations/0001_foundation.sql"), "utf8");
    await client.executeMultiple(migration);
    await client.execute({ sql: "INSERT INTO _all_items_migrations (name, applied_at) VALUES (?, ?)", args: [name, new Date().toISOString()] });
    console.log(`Applied migration ${name}`);
  } else {
    console.log(`Migration ${name} already applied`);
  }
  await client.close();
}

migrate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
