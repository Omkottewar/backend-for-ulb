import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  foreignKey,
} from "drizzle-orm/pg-core";

import { queries } from "./queries.js";
import { users } from "./users.js";

export const queryReplies = pgTable(
  "query_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    queryId: uuid("query_id")
      .notNull()
      .references(() => queries.id, { onDelete: "cascade" }),

    parentReplyId: uuid("parent_reply_id"),

    replyText: text("reply_text").notNull(),

    repliedBy: uuid("replied_by")
      .notNull()
      .references(() => users.id),

    repliedAt: timestamp("replied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    isDeleted: boolean("is_deleted").notNull().default(false),
  },
  (table) => [
    foreignKey({
      columns: [table.parentReplyId],
      foreignColumns: [table.id],
      name: "query_replies_parent_reply_id_fk",
    }),
  ]
);