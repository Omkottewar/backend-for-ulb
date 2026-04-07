import {
  pgTable,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { ulbs } from "./ulbs.js";
import { teams } from "./teams.js";
import { users } from "./users.js";

export const ulbTeamAssignments = pgTable(
  "ulb_team_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ulbId: uuid("ulb_id")
      .notNull()
      .references(() => ulbs.id),

    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),

    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    removedAt: timestamp("removed_at", { withTimezone: true }),

    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    ulbTeamUnique: uniqueIndex("ulb_team_unique").on(
      table.ulbId,
      table.teamId
    ),
  })
);