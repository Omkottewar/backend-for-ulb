import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

import { files } from "./files.js";
import { checklists } from "./checklist.js";
import { users } from "./users.js";

export const attachmentCategoryEnum = pgEnum("attachment_category_enum", [
  "mandatory",
  "page",
  "document",
]);

export const attachmentStorageBackendEnum = pgEnum(
  "attachment_storage_backend_enum",
  ["local", "s3", "azure_blob"]
);

export const attachmentFileTypeEnum = pgEnum("attachment_file_type_enum", [
  "image",
  "pdf",
  "word",
  "excel",
  "text",
  "other",
]);

export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),

  fileId: uuid("file_id")
    .notNull()
    .references(() => files.id),

  checklistId: uuid("checklist_id")
    .notNull()
    .references(() => checklists.id),

  category: attachmentCategoryEnum("category").notNull(),

  slot: varchar("slot", { length: 20 }),

  fileName: varchar("file_name", { length: 500 }).notNull(),

  fileSize: bigint("file_size", { mode: "number" }),

  mimeType: varchar("mime_type", { length: 100 }),

  fileType: attachmentFileTypeEnum("file_type"),

  storagePath: text("storage_path"),

  storageBackend: attachmentStorageBackendEnum("storage_backend")
    .notNull()
    .default("local"),

  description: text("description"),

  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),

  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  isDeleted: boolean("is_deleted").notNull().default(false),
});