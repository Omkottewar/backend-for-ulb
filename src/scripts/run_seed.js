/**
 * Usage — seed ALL templates:
 *   node src/scripts/run_seed.js
 *
 * Usage — seed ONE template by formId:
 *   node src/scripts/run_seed.js manpower_checklist_v1
 *
 * Template UUIDs live in the TEMPLATE_MAP below.
 * Update the UUIDs to match your checklist_templates table.
 */

import { readFileSync } from "fs";
import { seedTemplateQuestions } from "./seed_template_questions.js";

// ── Configure your template IDs and JSON paths here ────────────────────────
const TEMPLATE_MAP = [
  {
    formId:     "manpower_checklist_v1",
    templateId: "aff9289f-1fec-4a0d-903f-3ce0040485db", 
    jsonPath:   "src/data/manpower_checklist.json",
  },
  {
    formId:     "store_procurement_checklist_v1",
    templateId: "1de0e9d3-eb6b-4802-99f3-6dfff3dcfeb9",
    jsonPath:   "src/data/store_procurement_checklist.json",
  },
  {
    formId:     "advance_to_employees_checklist_v1",
    templateId: "c09ac018-1f80-428d-8386-f5f3900f194e",
    jsonPath:   "src/data/advance_to_employees_checklist.json",
  },
  {
    formId:     "consultancy_checklist_v1",
    templateId: "99999999-9999-9999-9999-000000000002",
    jsonPath:   "src/data/consultancy_checklist.json",
  },
];
// ────────────────────────────────────────────────────────────────────────────

const [,, targetFormId] = process.argv;

const targets = targetFormId
  ? TEMPLATE_MAP.filter((t) => t.formId === targetFormId)
  : TEMPLATE_MAP;

if (targets.length === 0) {
  console.error(`No template found with formId: ${targetFormId}`);
  console.error(`Available: ${TEMPLATE_MAP.map((t) => t.formId).join(", ")}`);
  process.exit(1);
}

let totalSeeded = 0;
let errors      = 0;

for (const { formId, templateId, jsonPath } of targets) {
  if (templateId.startsWith("REPLACE-WITH")) {
    console.warn(`\nSkipping ${formId} — templateId not set yet`);
    continue;
  }

  let templateJson;
  try {
    templateJson = JSON.parse(readFileSync(jsonPath, "utf-8"));
  } catch (err) {
    console.error(`\nFailed to read ${jsonPath}: ${err.message}`);
    errors++;
    continue;
  }

  try {
    const count  = await seedTemplateQuestions(templateId, templateJson);
    totalSeeded += count;
  } catch (err) {
    console.error(`\nSeed failed for ${formId}:`, err.message);
    errors++;
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`Total seeded: ${totalSeeded} questions`);
if (errors) console.error(`Errors:       ${errors} template(s) failed`);
process.exit(errors ? 1 : 0);