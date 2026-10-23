import { expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { mkdtemp, mkdir, copyFile, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createMigrationBackup } from "./backup";
import { applyMigrations } from "./migrate";

it("backs up SQLite and media, then migrates category associations without changing existing rows", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "all-items-category-migration-"));
  const client = createClient({ url: pathToFileURL(path.join(directory,"all-items.db")).href });
  try {
    const legacy = path.join(directory,"legacy"); await mkdir(legacy);
    const migrations = path.join(process.cwd(),"src/db/migrations");
    for (const name of (await readdir(migrations)).filter(name => name < "0007")) await copyFile(path.join(migrations,name),path.join(legacy,name));
    await applyMigrations(client,legacy);
    const workspace = randomUUID();
    await client.execute({sql:"INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)",args:[workspace,"Synthetic","2026-01-01"]});
    const ids = [randomUUID(),randomUUID(),randomUUID()];
    const values = ["Electronics","Электроника","  Custom original  "];
    for (let i=0;i<ids.length;i++) await client.execute({sql:"INSERT INTO items (id,workspace_id,name,inventory_number,category,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",args:[ids[i]!,workspace,"Synthetic item",`INV-00000${i+1}`,values[i]!,"2026-01-01","2026-01-02"]});
    await mkdir(path.join(directory,"media"));
    await writeFile(path.join(directory,"media","synthetic.bin"),"synthetic media bytes");
    const before = await client.execute("SELECT * FROM items ORDER BY id");
    const backup = await createMigrationBackup(client,directory);
    const hashes = JSON.parse(await readFile(path.join(backup,"verified-sha256.json"),"utf8"));
    expect(hashes["media/synthetic.bin"]).toBe(createHash("sha256").update(await readFile(path.join(backup,"media","synthetic.bin"))).digest("hex"));
    const restored = createClient({url:pathToFileURL(path.join(backup,"all-items.db")).href});
    try { expect((await restored.execute("SELECT * FROM items ORDER BY id")).rows).toEqual(before.rows); } finally { restored.close(); }
    await applyMigrations(client,migrations);
    await applyMigrations(client,migrations);
    expect((await client.execute("SELECT * FROM items ORDER BY id")).rows).toEqual(before.rows);
    expect((await client.execute("SELECT category FROM item_categories ORDER BY item_id")).rows.map(row=>row.category).sort()).toEqual(["  Custom original  ","electronics","electronics"]);
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
  } finally {
    client.close();
    try { await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100}); }
    catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EBUSY")) throw error; }
  }
},30_000);
