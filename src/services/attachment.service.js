import { db } from "../db/index.js";
import { files } from "../db/schema/files.js";
import { checklists } from "../db/schema/checklist.js";
import { attachments } from "../db/schema/attachments.js";
import { eq, and } from "drizzle-orm";

/**
 * Fetches all attachments for a given fileId, grouped phase-wise.
 * Phase is derived from the checklists table.
 * Soft-deleted attachments are excluded.
 * Phases with zero attachments are still included with an empty array.
 *
 * @param {string} fileId - UUID of the file
 * @returns {Promise<Object>} Phase-wise grouped attachment response
 * @throws {Error} with .statusCode = 404 if file not found, soft-deleted,
 *                 or has no attachments at all
 */
export const getAttachmentsByFileId = async (fileId) => {

  // ── Step 1: Confirm the file exists and is not soft-deleted ──────────────
  const fileResult = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.isDeleted, false)))
    .limit(1);

  if (fileResult.length === 0) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 2: Fetch all checklists for this file, ordered by phase ─────────
  const checklistRows = await db
    .select({
      checklistId: checklists.id,
      phaseNumber: checklists.phaseNumber,
    })
    .from(checklists)
    .where(eq(checklists.fileId, fileId))
    .orderBy(checklists.phaseNumber);

  // ── Step 3: Guard — no checklists means no phase structure at all ─────────
  if (checklistRows.length === 0) {
    const err = new Error("No attachments found for this file");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 4: Fetch all non-deleted attachments for this file ──────────────
  // We use file_id directly (indexed FK) for the primary filter, then
  // resolve phase via checklist_id in JS — avoids a heavier JOIN with
  // a GROUP BY and keeps the query flat and predictable.
  const attachmentRows = await db
    .select({
      id: attachments.id,
      checklistId: attachments.checklistId,
      category: attachments.category,
      slot: attachments.slot,
      fileName: attachments.fileName,
      fileSize: attachments.fileSize,
      mimeType: attachments.mimeType,
      fileType: attachments.fileType,
      storagePath: attachments.storagePath,
      storageBackend: attachments.storageBackend,
      description: attachments.description,
      uploadedBy: attachments.uploadedBy,
      uploadedAt: attachments.uploadedAt,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.fileId, fileId),
        eq(attachments.isDeleted, false)
      )
    );

  // ── Step 5: Guard — checklists exist but zero attachments across all ──────
  if (attachmentRows.length === 0) {
    const err = new Error("No attachments found for this file");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 6: Build a checklistId → phaseNumber lookup map ─────────────────
  // O(1) lookup per attachment — no nested loops.
  const checklistPhaseMap = new Map(
    checklistRows.map((c) => [c.checklistId, c.phaseNumber])
  );

  // ── Step 7: Build phase-wise buckets, seeded from checklists ─────────────
  // Seed all phases first (guarantees empty phases still appear).
  const phaseMap = new Map();
  for (const { phaseNumber } of checklistRows) {
    phaseMap.set(phaseNumber, []);
  }

  // Distribute attachments into their phase bucket
  for (const attachment of attachmentRows) {
    const phase = checklistPhaseMap.get(attachment.checklistId);
    if (phase !== undefined) {
      phaseMap.get(phase).push({
        id: attachment.id,
        checklistId: attachment.checklistId,
        category: attachment.category,
        slot: attachment.slot,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        fileType: attachment.fileType,
        storagePath: attachment.storagePath,
        storageBackend: attachment.storageBackend,
        description: attachment.description,
        uploadedBy: attachment.uploadedBy,
        uploadedAt: attachment.uploadedAt,
      });
    }
  }

  // ── Step 8: Serialize to sorted array ────────────────────────────────────
  const phases = Array.from(phaseMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([phaseNumber, attachments]) => ({
      phaseNumber,
      totalAttachments: attachments.length,
      attachments,
    }));

  return {
    fileId,
    totalPhases: phases.length,
    phases,
  };
};

//Version 2(Simplified):  Phases with zero attachments are NOT included in the response. //

// import { db } from "../db/index.js";
// import { files } from "../db/schema/files.js";
// import { checklists } from "../db/schema/checklist.js";
// import { attachments } from "../db/schema/attachments.js";
// import { eq, and } from "drizzle-orm";

// /**
//  * Fetches all attachments for a given fileId, grouped phase-wise.
//  * Phases with zero attachments are NOT included in the response.
//  *
//  * @param {string} fileId - UUID of the file
//  * @returns {Promise<Object>} Phase-wise grouped attachment response
//  * @throws {Error} with .statusCode = 404 if file not found, soft-deleted,
//  *                 or has no attachments at all
//  */
// export const getAttachmentsByFileId = async (fileId) => {

//   // ── Step 1: Confirm the file exists and is not soft-deleted ──────────────
//   const fileResult = await db
//     .select({ id: files.id })
//     .from(files)
//     .where(and(eq(files.id, fileId), eq(files.isDeleted, false)))
//     .limit(1);

//   if (fileResult.length === 0) {
//     const err = new Error("File not found");
//     err.statusCode = 404;
//     throw err;
//   }

//   // ── Step 2: Single JOIN query — attachments joined with checklists ────────
//   // innerJoin is correct here because every attachment has a non-null
//   // checklist_id FK — an attachment without a checklist cannot exist.
//   const rows = await db
//     .select({
//       // phase derived from checklists
//       phaseNumber:    checklists.phaseNumber,

//       // attachment fields
//       id:             attachments.id,
//       checklistId:    attachments.checklistId,
//       category:       attachments.category,
//       slot:           attachments.slot,
//       fileName:       attachments.fileName,
//       fileSize:       attachments.fileSize,
//       mimeType:       attachments.mimeType,
//       fileType:       attachments.fileType,
//       storagePath:    attachments.storagePath,
//       storageBackend: attachments.storageBackend,
//       description:    attachments.description,
//       uploadedBy:     attachments.uploadedBy,
//       uploadedAt:     attachments.uploadedAt,
//     })
//     .from(attachments)
//     .innerJoin(checklists, eq(attachments.checklistId, checklists.id))
//     .where(
//       and(
//         eq(attachments.fileId, fileId),
//         eq(attachments.isDeleted, false)
//       )
//     );

//   // ── Step 3: Guard — no attachments found at all ───────────────────────────
//   if (rows.length === 0) {
//     const err = new Error("No attachments found for this file");
//     err.statusCode = 404;
//     throw err;
//   }

//   // ── Step 4: Single Map — group attachment rows by phaseNumber ─────────────
//   // No seeding needed. Phases only appear if they have at least one row.
//   const phaseMap = new Map();

//   for (const row of rows) {
//     if (!phaseMap.has(row.phaseNumber)) {
//       phaseMap.set(row.phaseNumber, []);
//     }
//     phaseMap.get(row.phaseNumber).push({
//       id:             row.id,
//       checklistId:    row.checklistId,
//       category:       row.category,
//       slot:           row.slot,
//       fileName:       row.fileName,
//       fileSize:       row.fileSize,
//       mimeType:       row.mimeType,
//       fileType:       row.fileType,
//       storagePath:    row.storagePath,
//       storageBackend: row.storageBackend,
//       description:    row.description,
//       uploadedBy:     row.uploadedBy,
//       uploadedAt:     row.uploadedAt,
//     });
//   }

//   // ── Step 5: Serialize to sorted array ────────────────────────────────────
//   const phases = Array.from(phaseMap.entries())
//     .sort(([a], [b]) => a - b)
//     .map(([phaseNumber, attachments]) => ({
//       phaseNumber,
//       totalAttachments: attachments.length,
//       attachments,
//     }));

//   return {
//     fileId,
//     totalPhases: phases.length,
//     phases,
//   };
// };

