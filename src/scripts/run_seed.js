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
    templateId: "443de5e8-cfc3-4f11-98df-446f84c1d737", 
    jsonPath:   "src/data/manpower_checklist.json",
  },
  {
    formId:     "store_procurement_checklist_v1",
    templateId: "f6df8dcc-2d1d-432e-9892-0485dd844a89",
    jsonPath:   "src/data/store_procurement_checklist.json",
  },
  {
    formId:     "advance_to_employees_checklist_v1",
    templateId: "d7801530-b05b-44dd-bd06-165d8c6056b3",
    jsonPath:   "src/data/advance_to_employees_checklist.json",
  },
  {
    formId:     "consultancy_checklist_v1",
    templateId: "2b165788-0ae1-4f37-89de-8ac5edf11f12",
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