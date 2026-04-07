import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { files } from "./files.js";
import { users } from "./users.js";

export const fileVersionHistory = pgTable(
  "file_version_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),

    versionNumber: integer("version_number").notNull(),

    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id),

    changedByRole: varchar("changed_by_role", { length: 100 }),

    reason: text("reason"),

    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    fileVersionUnique: uniqueIndex("file_version_history_file_version_unique").on(
      table.fileId,
      table.versionNumber
    ),
  })
);