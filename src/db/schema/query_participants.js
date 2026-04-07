import {
  pgTable,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { queries } from "./queries.js";
import { users } from "./users.js";

export const queryParticipants = pgTable(
  "query_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    queryId: uuid("query_id")
      .notNull()
      .references(() => queries.id, { onDelete: "cascade" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    addedBy: uuid("added_by").references(() => users.id),
  },
  (table) => ({
    queryParticipantUnique: uniqueIndex("query_participants_query_user_unique").on(
      table.queryId,
      table.userId
    ),
  })
);