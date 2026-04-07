import { db } from "../db/index.js";
import { files } from "../db/schema/files.js";
import { fileVersionHistory } from "../db/schema/file_version_history.js";
import { fileVersionChanges } from "../db/schema/file_version_changes.js";
import { users } from "../db/schema/users.js";
import { eq, and, desc } from "drizzle-orm";

/**
 * Fetches the full version history of a file, with each version's
 * field-level changes nested inside it. Versions are returned newest first.
 * The user who made each change is resolved to their name.
*
 * @param {string} fileId - UUID of the file
 * @returns {Promise<Object>} Version history with nested changes
 * @throws {Error} with .statusCode = 404 if:
 *                 - file does not exist or is soft-deleted
 *                 - file exists but has no version history
 */
export const getFileVersionHistory = async (fileId) => {

  // ── Step 1: Confirm file exists and is not soft-deleted ──────────────────
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

  // ── Step 2: Single JOIN query — history + changes + user in one shot ──────
  // Returns flat rows where version history columns repeat per change row.
  // innerJoin on file_version_changes is correct — a version record only
  // exists because changes were written with it. Orphaned version rows
  // cannot occur in real business flow.
  const rows = await db
    .select({
      // ---- version history fields ----
      versionId:     fileVersionHistory.id,
      versionNumber: fileVersionHistory.versionNumber,
      changedByName: users.name,
      changedByRole: fileVersionHistory.changedByRole,
      reason:        fileVersionHistory.reason,
      changedAt:     fileVersionHistory.changedAt,

      // ---- version change fields ----
      changeId:      fileVersionChanges.id,
      fieldName:     fileVersionChanges.fieldName,
      fieldLabel:    fileVersionChanges.fieldLabel,
      oldValue:      fileVersionChanges.oldValue,
      newValue:      fileVersionChanges.newValue,
    })
    .from(fileVersionHistory)
    .innerJoin(users, eq(fileVersionHistory.changedBy, users.id))
    .innerJoin(fileVersionChanges, eq(fileVersionChanges.versionId, fileVersionHistory.id))
    .where(eq(fileVersionHistory.fileId, fileId))
    .orderBy(desc(fileVersionHistory.versionNumber));

  // ── Step 3: Guard — no version history found for this file ───────────────
  if (rows.length === 0) {
    const err = new Error("No version history found for this file");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 4: Single Map — group flat rows into nested version structure ────
  // versionId is the grouping key. Each version bucket is created once on
  // first encounter, then change rows are pushed into it on subsequent rows.
  const versionMap = new Map();

  for (const row of rows) {
    if (!versionMap.has(row.versionId)) {
      versionMap.set(row.versionId, {
        versionId:     row.versionId,
        versionNumber: row.versionNumber,
        changedByName: row.changedByName,
        changedByRole: row.changedByRole,
        reason:        row.reason,
        changedAt:     row.changedAt,
        changes:       [],
      });
    }

    versionMap.get(row.versionId).changes.push({
      id:         row.changeId,
      fieldName:  row.fieldName,
      fieldLabel: row.fieldLabel,
      oldValue:   row.oldValue,
      newValue:   row.newValue,
    });
  }

  // ── Step 5: Serialize Map to array ───────────────────────────────────────
  // Map insertion order is guaranteed to match DB sort order (newest first)
  // since rows arrive from the DB already ordered by version_number DESC.
  const versions = Array.from(versionMap.values()).map((v) => ({
    ...v,
    totalChanges: v.changes.length,
  }));

  return {
    fileId,
    totalVersions: versions.length,
    versions,
  };
};