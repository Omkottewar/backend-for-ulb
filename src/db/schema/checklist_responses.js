import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { checklists } from "./checklist.js";
import { checklistTemplateQuestions } from "./checklist_template_questions.js";
import { users } from "./users.js";

export const checklistResponses = pgTable(
  "checklist_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => checklists.id),

    questionId: uuid("question_id")
      .notNull()
      .references(() => checklistTemplateQuestions.id),

    responseValue: varchar("response_value", { length: 50 }),

    remark: text("remark"),

    respondedAt: timestamp("responded_at", { withTimezone: true }),

    respondedBy: uuid("responded_by").references(() => users.id),
  },
  (table) => ({
    checklistQuestionUnique: uniqueIndex(
      "checklist_responses_checklist_question_unique"
    ).on(table.checklistId, table.questionId),
  })
);