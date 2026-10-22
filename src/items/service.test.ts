import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { createItemInput, createItemRecord } from "./service";

describe("item input", () => {
  it("accepts a name and optional model, trimming whitespace", () => {
    expect(createItemInput.parse({ name: "  Arduino Uno ", model: " R3 " })).toMatchObject({ name: "Arduino Uno", model: "R3" });
  });
  it("rejects an empty name", () => {
    expect(() => createItemInput.parse({ name: "  " })).toThrow();
  });
});

describe("item persistence", () => {
  const makeDb = (databaseClient: ReturnType<typeof createClient>) => drizzle(databaseClient, { schema });
  const client = createClient({ url: "file::memory:" });
  const db = makeDb(client);
  beforeAll(async () => {
    await client.executeMultiple(`
      CREATE TABLE workspaces (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE items (id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, model TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    `);
  });
  it("stores and retrieves an item for a workspace", async () => {
    const workspaceId = crypto.randomUUID();
    await db.insert(schema.workspaces).values({ id: workspaceId, name: "Test", createdAt: new Date().toISOString() });
    await createItemRecord(db, workspaceId, { name: "Sensor", model: "BME280" });
    const rows = await db.select().from(schema.items).where(eq(schema.items.workspaceId, workspaceId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Sensor", model: "BME280" });
  });
});
