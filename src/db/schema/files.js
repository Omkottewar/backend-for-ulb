import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  check,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { ulbs } from "./ulbs.js";
import { suppliers } from "./suppliers.js";
import { contractTypes } from "./contract_types.js";

export const riskFlagEnum = pgEnum("risk_flag_enum", ["Low", "Medium", "High"]);
export const fileStageEnum = pgEnum("file_stage_enum", ["Pre-Audit", "Post-Audit"]);

export const fileStatusEnum = pgEnum("file_status_enum", [
  "Created",
  "Under Review",
  "Finalized",
  "Pre-Audit",
]);

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    fileNumber: varchar("file_number", { length: 50 }).notNull().unique(),

    fileTitle: varchar("file_title", { length: 500 }).notNull(),

    ulbId: uuid("ulb_id")
      .notNull()
      .references(() => ulbs.id),

    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),

    contractTypeId: uuid("contract_type_id").references(() => contractTypes.id),

    officerName: varchar("officer_name", { length: 200 }),

    workDescription: text("work_description"),

    amount: numeric("amount", { precision: 15, scale: 2 }),

    riskFlag: riskFlagEnum("risk_flag").notNull().default("Low"),

    status: fileStatusEnum("status").notNull().default("Created"),

    stage: fileStageEnum("stage").default(null),
    
    finalized: boolean("finalized").notNull().default(false),

    finalizedAt: timestamp("finalized_at", { withTimezone: true }),

    finalizedBy: uuid("finalized_by").references(() => users.id),

    caObservations: text("ca_observations"),

    isDeleted: boolean("is_deleted").notNull().default(false),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    deletedBy: uuid("deleted_by").references(() => users.id),

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
    amountNonNegative: check("files_amount_non_negative", sql`${table.amount} >= 0`),
  })
);
