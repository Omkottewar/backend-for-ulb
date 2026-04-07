import {
  pgTable,
  uuid,
  varchar,
  smallint,
  date,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { files } from "./files.js";
import { checklistTemplates } from "./checklist_templates.js";
import { users } from "./users.js";

export const checklistStatusEnum = pgEnum("checklist_status_enum", [
  "Draft",
  "In Progress",
  "Completed",
]);

export const checklists = pgTable(
  "checklists",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),

    templateId: uuid("template_id")
      .notNull()
      .references(() => checklistTemplates.id),

    phaseNumber: smallint("phase_number").notNull(),

    checkerName: varchar("checker_name", { length: 200 }),

    checkDate: date("check_date"),

    status: checklistStatusEnum("status").notNull().default("Draft"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    updatedBy: uuid("updated_by").references(() => users.id),
  },
  (table) => ({
    filePhaseUnique: uniqueIndex("checklists_file_phase_unique").on(
      table.fileId,
      table.phaseNumber
    ),
  })
);