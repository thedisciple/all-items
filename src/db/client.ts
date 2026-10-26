import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as schema from "@/db/schema";

let databasePromise: Promise<ReturnType<typeof drizzle<typeof schema>>> | undefined;

export function dataDirectory() {
  const directory = path.resolve(process.env.ALL_ITEMS_DATA_DIR || (process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || os.homedir(), "AllItems") : path.join(os.homedir(), ".all-items")));
  const repository = path.resolve(process.cwd());
  const relative = path.relative(repository, directory);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("ALL_ITEMS_DATA_DIR must point outside the repository.");
  }
  return directory;
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
