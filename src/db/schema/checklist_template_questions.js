import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  smallint,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { checklistTemplates } from "./checklist_templates.js";

export const responseTypeEnum = pgEnum("response_type_enum", [
  "yes_no",
  "yes_no_na",
  "doc_pending_na",
  "text",
  "number",
]);

export const checklistTemplateQuestions = pgTable(
  "checklist_template_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    templateId: uuid("template_id")
      .notNull()
      .references(() => checklistTemplates.id),

    sectionNumber: smallint("section_number").notNull(),

    sectionTitle: varchar("section_title", { length: 300 }).notNull(),

    questionKey: varchar("question_key", { length: 50 }).notNull(),

    questionNumber: varchar("question_number", { length: 10 }).notNull(),

    questionText: text("question_text").notNull(),

    responseType: responseTypeEnum("response_type").notNull(),

    isConditional: boolean("is_conditional").notNull().default(false),

    parentQuestionKey: varchar("parent_question_key", { length: 50 }),

    parentTriggerValue: varchar("parent_trigger_value", { length: 50 }),

    sortOrder: integer("sort_order").notNull().default(0),

    autoQueryTitle: varchar("auto_query_title", { length: 300 }),

    autoQueryDescription: text("auto_query_description"),

    // ── Added columns ───────────────────────────────────────────────────────

    /** Raw input widget type: text | number | radio | dropdown | checkbox | textarea | date | readonly */
    inputType: varchar("input_type", { length: 30 }).notNull().default("text"),

    /** Dropdown / radio options stored as [{ label, value }] */
    optionsJson: jsonb("options_json"),

    placeholder: text("placeholder"),

    isRequired: boolean("is_required").default(false),

    /** Default value for readonly / pre-filled fields */
    defaultValue: text("default_value"),

    /**
     * Arbitrary UI hints: flagType, isTableColumn, tableType, width, format,
     * conditionNote, etc.
     */
    uiMetadata: jsonb("ui_metadata"),
  },
  (table) => ({
    templateQuestionKeyUnique: uniqueIndex("template_question_key_unique").on(
      table.templateId,
      table.questionKey
    ),

    templateSortUnique: uniqueIndex("template_sort_unique").on(
      table.templateId,
      table.sectionNumber,
      table.sortOrder
    ),
  })
);