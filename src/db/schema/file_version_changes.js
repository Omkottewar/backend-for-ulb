import {
  pgTable,
  uuid,
  varchar,
  text,
} from "drizzle-orm/pg-core";

import { fileVersionHistory } from "./file_version_history.js";

export const fileVersionChanges = pgTable("file_version_changes", {
  id: uuid("id").defaultRandom().primaryKey(),

  versionId: uuid("version_id")
    .notNull()
    .references(() => fileVersionHistory.id),

  fieldName: varchar("field_name", { length: 100 }).notNull(),

  fieldLabel: varchar("field_label", { length: 200 }).notNull(),

  oldValue: text("old_value"),

  newValue: text("new_value"),
});