import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

import { queries } from "./queries.js";
import { users } from "./users.js";

export const queryActionTypeEnum = pgEnum("query_action_type_enum", [
  "created",
  "assigned",
  "replied",
  "participant",
  "status",
  "resolved",
]);

export const queryActivityLog = pgTable("query_activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),

  queryId: uuid("query_id")
    .notNull()
    .references(() => queries.id, { onDelete: "cascade" }),

  actionType: queryActionTypeEnum("action_type").notNull(),

  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),

  detail: text("detail"),

  performedAt: timestamp("performed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});