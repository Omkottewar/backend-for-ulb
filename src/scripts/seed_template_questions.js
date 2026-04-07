import { db } from "../db/index.js";
import { checklistTemplateQuestions } from "../db/schema/checklist_template_questions.js";
 
/**
 * Maps JSON field type + options → response_type_enum value.
 *
 * Enum: yes_no | yes_no_na | doc_pending_na | text | number
 */
function mapResponseType(type, options) {
  if (type === "number") return "number";
  if (type === "checkbox") return "yes_no";
 
  if (type === "radio" || type === "dropdown") {
    if (!options?.length) return "text";
    const vals = options.map((o) => o.value.toLowerCase());
    const hasNA  = vals.some((v) => v === "na" || v === "n/a");
    const hasYes = vals.includes("yes");
    const hasNo  = vals.includes("no");
    if (hasYes && hasNo && hasNA) return "yes_no_na";
    if (hasYes && hasNo)          return "yes_no";
    return "text"; // e.g. bill_type: ra_bill / final_bill
  }
 
  return "text"; // text | textarea | date | readonly
}
 
/**
 * Build a flat array of question rows from one template JSON.
 */
function buildQuestions(templateId, templateJson) {
  const questions = [];
  let sort = 1;
 
  const push = (q) =>
    questions.push({
      // safe defaults for nullable columns
      isConditional:      false,
      parentQuestionKey:  null,
      parentTriggerValue: null,
      optionsJson:        null,
      placeholder:        null,
      isRequired:         false,
      defaultValue:       null,
      uiMetadata:         null,
      ...q,
    });
 
  templateJson.sections.forEach((section) => {
    const base = {
      templateId,
      sectionNumber: section.order,
      sectionTitle:  section.title,
    };
 
    // ── 1. Normal top-level fields ──────────────────────────────────────────
    section.fields?.forEach((field) => {
      push({
        ...base,
        questionKey:    field.fieldId,
        questionNumber: String(sort),
        questionText:   field.label,
        responseType:   mapResponseType(field.type, field.options),
        inputType:      field.type,
        optionsJson:    field.options    ?? null,
        placeholder:    field.placeholder ?? null,
        isRequired:     field.required   ?? false,
        sortOrder:      sort++,
      });
    });
 
    // ── 2. Conditional groups ───────────────────────────────────────────────
    section.conditionalGroups?.forEach((group) => {
      const parentKey     = group.showWhen?.fieldId ?? null;
      const parentTrigger = group.showWhen?.equals  ?? null;
 
      group.fields?.forEach((field) => {
        push({
          ...base,
          questionKey:        field.fieldId,
          questionNumber:     String(sort),
          questionText:       field.label,
          responseType:       mapResponseType(field.type, field.options),
          inputType:          field.type,
          optionsJson:        field.options    ?? null,
          placeholder:        field.placeholder ?? null,
          isRequired:         field.required   ?? false,
          isConditional:      true,
          parentQuestionKey:  parentKey,
          parentTriggerValue: parentTrigger,
          defaultValue:       field.defaultValue ?? null,
          uiMetadata:         field.flagType ? { flagType: field.flagType } : null,
          sortOrder:          sort++,
        });
      });
    });
 
    // ── 3. Verification / checklist_table ───────────────────────────────────
    if (section.type === "checklist_table") {
      section.items?.forEach((item) => {
        const isConditional  = !!item.showWhen;
        const parentKey      = item.showWhen?.fieldId ?? null;
        const parentTrigger  = item.showWhen?.equals  ?? null;
 
        if (item.responseField) {
          push({
            ...base,
            questionKey:        item.responseField.fieldId,
            questionNumber:     item.srNo,
            questionText:       item.particular,
            responseType:       mapResponseType(item.responseField.type, item.responseField.options),
            inputType:          item.responseField.type,
            optionsJson:        item.responseField.options ?? null,
            isConditional,
            parentQuestionKey:  parentKey,
            parentTriggerValue: parentTrigger,
            sortOrder:          sort++,
          });
        }
 
        if (item.remarkField) {
          push({
            ...base,
            questionKey:        item.remarkField.fieldId,
            questionNumber:     `${item.srNo}_remark`,
            questionText:       `Remark – ${item.particular}`,
            responseType:       "text",
            inputType:          "text",
            placeholder:        item.remarkField.placeholder ?? null,
            isConditional,
            parentQuestionKey:  parentKey,
            parentTriggerValue: parentTrigger,
            sortOrder:          sort++,
          });
        }
      });
    }
 
    // ── 4. Document checklist ───────────────────────────────────────────────
    if (section.type === "document_checklist") {
      section.items?.forEach((item) => {
        if (!item.checkField) return;
        push({
          ...base,
          questionKey:    item.checkField.fieldId,
          questionNumber: item.srNo,
          questionText:   item.document,
          responseType:   "yes_no",
          inputType:      "checkbox",
          uiMetadata:     item.conditional
            ? { conditionNote: item.conditionNote ?? "if applicable" }
            : null,
          sortOrder:      sort++,
        });
      });
    }
 
    // ── 5. Line-items table (fixed rows) ────────────────────────────────────
    if (section.type === "line_items_table") {
      section.rows?.forEach((row) => {
        push({
          ...base,
          questionKey:    `${row.rowId}_amount`,
          questionNumber: `${row.srNo}_amount`,
          questionText:   `${row.head} – Amount`,
          responseType:   "number",
          inputType:      "number",
          sortOrder:      sort++,
        });
        push({
          ...base,
          questionKey:    `${row.rowId}_remark`,
          questionNumber: `${row.srNo}_remark`,
          questionText:   `${row.head} – Remark`,
          responseType:   "text",
          inputType:      "text",
          sortOrder:      sort++,
        });
      });
    }
 
    // ── 6. Dynamic table (column definitions) ───────────────────────────────
    if (section.type === "table") {
      section.columns?.forEach((col) => {
        if (col.computed) return;
        push({
          ...base,
          questionKey:    col.columnId,
          questionNumber: col.columnId,
          questionText:   col.header,
          responseType:   mapResponseType(col.type, null),
          inputType:      col.type,
          uiMetadata: {
            isTableColumn: true,
            tableType:     "dynamic",
            width:         col.width  ?? null,
            format:        col.format ?? null,
          },
          sortOrder:      sort++,
        });
      });
    }
  });
 
  // Deduplicate by questionKey within this template
  const seen   = new Set();
  const unique = questions.filter((q) => {
    if (seen.has(q.questionKey)) {
      console.warn(`  ⚠  Duplicate questionKey skipped: ${q.questionKey}`);
      return false;
    }
    seen.add(q.questionKey);
    return true;
  });
 
  return unique;
}
 
/**
 * Seed one template. Safe to re-run (onConflictDoNothing).
 */
export async function seedTemplateQuestions(templateId, templateJson) {
  if (!templateJson?.sections) {
    throw new Error(`templateJson is missing or has no sections (templateId: ${templateId})`);
  }
 
  console.log(`\nSeeding: ${templateJson.formTitle} → ${templateId}`);
  const questions = buildQuestions(templateId, templateJson);
 
  await db
    .insert(checklistTemplateQuestions)
    .values(questions)
    .onConflictDoNothing();
 
  console.log(`  ✓  ${questions.length} questions seeded`);
  return questions.length;
}