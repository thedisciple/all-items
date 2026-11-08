import {expect,it} from "vitest";
import {createClient} from "@libsql/client";
import {copyFile,mkdtemp,readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {applyMigrations} from "@/db/migrate";
import {provisionAccount} from "./core";

it("adds Telegram tables without rewriting prior owner, inventory or auth rows",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"all-items-p2-migration-")),migrationCopy=path.join(directory,"migrations");
  const {mkdir}=await import("node:fs/promises");await mkdir(migrationCopy);
  const source=path.join(process.cwd(),"src/db/migrations"),files=(await readdir(source)).filter(file=>/^\d{4}_[a-z0-9_]+\.sql$/.test(file));
  for(const file of files.filter(file=>!file.startsWith("0015_")))await copyFile(path.join(source,file),path.join(migrationCopy,file));
  const client=createClient({url:pathToFileURL(path.join(directory,"all-items.db")).href});
  try{
    await applyMigrations(client,migrationCopy);
    await provisionAccount(client,"synthetic-owner","Synthetic owner preservation password",true);
    const names=(await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows.map(row=>String(row.name));
    const snapshot=async()=>Object.fromEntries(await Promise.all(names.map(async name=>[name,(await client.execute(`SELECT * FROM "${name}" ORDER BY rowid`)).rows])));
    const before=await snapshot();
    await copyFile(path.join(source,"0015_telegram_identity.sql"),path.join(migrationCopy,"0015_telegram_identity.sql"));
    await applyMigrations(client,migrationCopy);
    const after=await snapshot();
    expect(after.auth_users).toEqual(before.auth_users);
    expect(after.inventory_owners).toEqual(before.inventory_owners);
    for(const name of names.filter(name=>name!=="_all_items_migrations"))expect(after[name]).toEqual(before[name]);
    expect((await client.execute("PRAGMA integrity_check")).rows[0]?.integrity_check).toBe("ok");
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
    const log=(await client.execute("SELECT name FROM _all_items_migrations WHERE name='0015_telegram_identity'")).rows;
    expect(log).toHaveLength(1);
    await applyMigrations(client,migrationCopy);
    expect((await client.execute("SELECT name FROM _all_items_migrations WHERE name='0015_telegram_identity'")).rows).toHaveLength(1);
  }finally{client.close();}
});
