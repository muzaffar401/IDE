import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  content: text("content").default(""),
  isDirectory: boolean("is_directory").default(false).notNull(),
  parentPath: text("parent_path"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

export const insertFileSchema = createInsertSchema(files).pick({
  name: true,
  path: true,
  content: true,
  isDirectory: true,
  parentPath: true,
});

export const updateFileSchema = createInsertSchema(files).pick({
  name: true,
  content: true,
}).partial();

export type InsertFile = z.infer<typeof insertFileSchema>;
export type UpdateFile = z.infer<typeof updateFileSchema>;
export type File = typeof files.$inferSelect;
