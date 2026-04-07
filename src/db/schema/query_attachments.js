import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";

import { queries } from "./queries.js";
import { queryReplies } from "./query_replies.js";
import { users } from "./users.js";

export const queryAttachments = pgTable("query_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),

  queryId: uuid("query_id")
    .notNull()
    .references(() => queries.id, { onDelete: "cascade" }),

  replyId: uuid("reply_id").references(() => queryReplies.id),

  fileName: varchar("file_name", { length: 500 }).notNull(),

  fileSize: bigint("file_size", { mode: "number" }),

  mimeType: varchar("mime_type", { length: 100 }),

  storagePath: text("storage_path"),

  storageBackend: varchar("storage_backend", { length: 20 })
    .notNull()
    .default("local"),

  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),

  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});