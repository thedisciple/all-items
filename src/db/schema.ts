import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  nextInventoryNumber: integer("next_inventory_number").notNull().default(1),
});

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  model: text("model"),
  inventoryNumber: text("inventory_number").notNull(),
  brand: text("brand"),
  category: text("category"),
  originalMarking: text("original_marking"),
  notes: text("notes"),
  description: text("description"),
  identificationStatus: text("identification_status").notNull(),
  trackingMode: text("tracking_mode").notNull(),
  saleIntent: text("sale_intent").notNull(),
  askingPriceMinor: integer("asking_price_minor"),
  askingCurrency: text("asking_currency"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("locations_workspace_name_idx").on(table.workspaceId, table.name)]);

export const stockEntries = sqliteTable("stock_entries", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  locationId: text("location_id").references(() => locations.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull().unique(),
  thumbnailPath: text("thumbnail_path").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: text("created_at").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  uniqueIndex("media_assets_one_primary_per_item_idx").on(table.itemId).where(sql`${table.isPrimary} = 1`),
]);

export const migrationLog = sqliteTable("_all_items_migrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  appliedAt: text("applied_at").notNull(),
});
