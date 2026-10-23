import { createClient, type Client } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// VACUUM INTO captures committed SQLite data, including WAL, without copying a live DB file.
export async function createMigrationBackup(client: Client, directory: string) {
  const target = path.join(directory, "backups", `before-migration-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`);
  await mkdir(target, { recursive: true });
  const databasePath = path.join(target, "all-items.db");
  await client.execute({ sql: "VACUUM INTO ?", args: [databasePath] });
  const snapshot = createClient({ url: pathToFileURL(databasePath).href });
  const hashes: Record<string, string> = {};
  const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  try {
    const integrity = await snapshot.execute("PRAGMA integrity_check");
    if (integrity.rows.length !== 1 || integrity.rows[0]!.integrity_check !== "ok") throw new Error("Migration backup failed SQLite integrity verification.");
    if ((await snapshot.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("Migration backup contains invalid relationships.");
    async function copyMedia(relative: string) {
      const source = path.join(directory, relative);
      let stat;
      try { stat = await lstat(source); } catch (error) { if (relative === "media" && error instanceof Error && "code" in error && error.code === "ENOENT") return; throw error; }
      if (stat.isSymbolicLink()) throw new Error("Migration backup refuses symbolic media paths.");
      if (stat.isDirectory()) {
        await mkdir(path.join(target, relative), { recursive: true });
        for (const entry of await readdir(source)) await copyMedia(path.join(relative, entry));
      } else if (stat.isFile()) {
        const bytes = await readFile(source);
        await writeFile(path.join(target, relative), bytes, { flag: "wx" });
        const checksum = hash(bytes);
        if (hash(await readFile(path.join(target, relative))) !== checksum) throw new Error("Migration backup media verification failed.");
        hashes[relative.replaceAll(path.sep, "/")] = checksum;
      } else throw new Error("Migration backup found unsupported media.");
    }
    await copyMedia("media");
    // Verify every referenced file from the database snapshot is present in the backup.
    for (const [table, prefix, columns] of [["media_assets", "media/items/", ["storage_path", "thumbnail_path", "source_storage_path"]], ["collection_cover_assets", "media/", ["storage_path", "thumbnail_path"]]] as const) {
      if (!(await snapshot.execute({ sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?", args: [table] })).rows.length) continue;
      const existing = new Set((await snapshot.execute(`PRAGMA table_info(${table})`)).rows.map(row => String(row.name)));
      const selected = columns.filter(column => existing.has(column));
      for (const row of (await snapshot.execute(`SELECT ${selected.join(",")} FROM ${table}`)).rows) for (const column of selected) {
        if (row[column] !== null && !hashes[prefix + String(row[column])]) throw new Error("Migration backup is missing referenced media. Migration was not started.");
      }
    }
  } finally { snapshot.close(); }
  hashes["all-items.db"] = hash(await readFile(databasePath));
  await writeFile(path.join(target, "verified-sha256.json"), JSON.stringify(hashes, null, 2), { flag: "wx" });
  return target;
}
