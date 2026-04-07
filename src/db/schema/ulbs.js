import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const ulbs = pgTable("ulbs", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 300 }).notNull().unique(),

  code: varchar("code", { length: 20 }).notNull().unique(),

  hodDesignation: varchar("hod_designation", { length: 200 }),

  hodName: varchar("hod_name", { length: 200 }),

  district: varchar("district", { length: 100 }),

  isActive: boolean("is_active").notNull().default(true),

  isDeleted: boolean("is_deleted").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  createdBy: uuid("created_by").references(() => users.id),

  updatedBy: uuid("updated_by").references(() => users.id),
});