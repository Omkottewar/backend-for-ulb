import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  jsonb
} from "drizzle-orm/pg-core";

import { contractTypes } from "./contract_types.js";
import { users } from "./users.js";

export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    contractTypeId: uuid("contract_type_id")
      .notNull()
      .references(() => contractTypes.id),

    name: varchar("name", { length: 300 }).notNull(),

    version: integer("version").notNull().default(1),

    isActive: boolean("is_active").notNull().default(true),

    templateJson: jsonb("template_json"),   // ← ADD THIS

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    contractVersionUnique: uniqueIndex(
      "checklist_templates_contract_version_unique"
    ).on(table.contractTypeId, table.version),
  })
);