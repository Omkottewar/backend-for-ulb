import {
  pgTable,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";
import { teams } from "./teams.js";

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    removedAt: timestamp("removed_at", { withTimezone: true }),

    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    teamUserUnique: uniqueIndex("team_user_unique").on(
      table.teamId,
      table.userId
    ),
  })
);