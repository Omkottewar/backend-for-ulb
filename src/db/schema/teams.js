import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 200 }).notNull().unique(),

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