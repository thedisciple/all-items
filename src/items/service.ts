import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { items, workspaces } from "@/db/schema";
import { getDatabase, initializeWorkspace } from "@/db/client";

export const createItemInput = z.object({
  name: z.string().trim().min(1, "Введите название").max(160),
  model: z.string().trim().max(160).optional().transform((value) => value || null),
});

export type CreateItemInput = z.input<typeof createItemInput>;

export async function createItemRecord(db: Awaited<ReturnType<typeof getDatabase>>, workspaceId: string, input: CreateItemInput) {
  const parsed = createItemInput.parse(input);
  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    workspaceId,
    name: parsed.name,
    model: parsed.model,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(items).values(item);
  return item;
}

export async function createItem(input: CreateItemInput) {
  const { db, workspaceId } = await initializeWorkspace();
  return createItemRecord(db, workspaceId, input);
}

export async function listItems() {
  const { db, workspaceId } = await initializeWorkspace();
  return db.select({
    id: items.id,
    name: items.name,
    model: items.model,
    createdAt: items.createdAt,
  }).from(items).innerJoin(workspaces, eq(items.workspaceId, workspaces.id))
    .where(eq(items.workspaceId, workspaceId)).orderBy(desc(items.createdAt));
}
