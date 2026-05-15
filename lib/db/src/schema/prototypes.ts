import { pgTable, text, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const prototypesTable = pgTable("prototypes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").references(() => projectsTable.id, {
    onDelete: "cascade",
  }),
  htmlContent: text("html_content").notNull(),
  fileName: text("file_name").notNull(),
  projectName: text("project_name").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPrototypeSchema = createInsertSchema(prototypesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPrototype = z.infer<typeof insertPrototypeSchema>;
export type Prototype = typeof prototypesTable.$inferSelect;

export const commentsTable = pgTable("comments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  prototypeId: text("prototype_id")
    .notNull()
    .references(() => prototypesTable.id, { onDelete: "cascade" }),
  x: real("x").notNull(),
  y: real("y").notNull(),
  text: text("text").notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(commentsTable).omit({
  id: true,
  createdAt: true,
  resolved: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
