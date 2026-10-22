import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as schema from "@/db/schema";

const workspaceId = "00000000-0000-4000-8000-000000000001";
let databasePromise: Promise<ReturnType<typeof drizzle<typeof schema>>> | undefined;

export function dataDirectory() {
  return process.env.ALL_ITEMS_DATA_DIR || path.join(process.env.LOCALAPPDATA || process.cwd(), "AllItems");
}

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const directory = dataDirectory();
      await mkdir(directory, { recursive: true });
      const client = createClient({ url: pathToFileURL(path.join(directory, "all-items.db")).href });
      return drizzle(client, { schema });
    })();
  }
  return databasePromise;
}

export async function initializeWorkspace() {
  const db = await getDatabase();
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: "Моя коллекция",
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing();
  return { db, workspaceId };
}
