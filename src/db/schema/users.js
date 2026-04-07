import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

import { roles } from "./roles.js"

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: varchar("email", { length: 255 }).notNull().unique(),

  passwordHash: varchar("password_hash", { length: 255 }).notNull(),

  name: varchar("name", { length: 200 }).notNull(),

  phone: varchar("phone", { length: 20 }),

  approve: boolean("approve").default(false),

  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),

  isActive: boolean("is_active").notNull().default(true),

  isDeleted: boolean("is_deleted").notNull().default(false),

  emailVerifiedAt: timestamp("email_verified_at", {
    withTimezone: true,
  }),

  lastLoginAt: timestamp("last_login_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  createdBy: uuid("created_by").references(() => users.id),

  updatedBy: uuid("updated_by").references(() => users.id),
});