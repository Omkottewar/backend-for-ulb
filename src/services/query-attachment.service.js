import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { queries } from "../db/schema/queries.js";
import { queryAttachments } from "../db/schema/query_attachments.js";
import { eq } from "drizzle-orm";
import { getSupabase, STORAGE_BUCKET } from "../config/supabase.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitises a filename for safe use in a storage path.
 * Replaces any character that is not alphanumeric, dot, dash, or underscore.
 * Collapses consecutive underscores and caps length at 200 characters.
 *
 * @param {string} name - Original filename from the upload
 * @returns {string} Sanitised filename
 */
const sanitizeFileName = (name) => {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 200);
};

/**
 * Builds a unique storage path within the bucket.
 *
 * Format: queries/{queryNumber}/{8-char-uuid}-{sanitised-name}
 *
 * The UUID prefix guarantees uniqueness even if the same filename is
 * uploaded twice to the same query.
 *
 * @param {string} queryNumber - e.g. "QRY-000001"
 * @param {string} originalName - Original filename from the upload
 * @returns {string} Path relative to the bucket root
 */
const buildStoragePath = (queryNumber, originalName) => {
  const prefix = uuidv4().slice(0, 8);
  const sanitized = sanitizeFileName(originalName);
  return `queries/${queryNumber}/${prefix}-${sanitized}`;
};

/**
 * Best-effort cleanup of uploaded files from Supabase Storage.
 * Called when a downstream step (DB insert) fails after files were
 * already uploaded. Logs but never throws — the original error
 * should propagate, not the cleanup error.
 *
 * @param {string[]} paths - Storage paths to remove
 */
const cleanupUploadedFiles = async (paths) => {
  if (paths.length === 0) return;

  try {
    const supabase = getSupabase();
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  } catch (cleanupErr) {
    console.error(
      "[cleanupUploadedFiles] Best-effort cleanup failed for paths:",
      paths,
      cleanupErr
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST — upload attachments for a query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads one or more files to Supabase Storage and records them in
 * the `query_attachments` table.
 *
 * Flow:
 *   1. Validate query exists → retrieve queryNumber for the storage path
 *   2. Upload each file to Supabase Storage (sequential)
 *      - If any upload fails → clean up already-uploaded files → throw
 *   3. Insert all query_attachment rows in a single DB transaction
 *      - If DB insert fails → clean up all uploaded files → throw
 *   4. Return the inserted records
 *
 * @param {string} queryId - UUID of the query (from route param)
 * @param {string} userId  - UUID of the uploading user
 * @param {Array<Express.Multer.File>} files - Multer file objects (buffer, originalname, mimetype, size)
 *
 * @returns {Promise<Array<Object>>} Array of inserted query_attachment records
 *
 * @throws {Error} .statusCode = 400 — no files provided
 * @throws {Error} .statusCode = 404 — query not found
 * @throws {Error} .statusCode = 502 — Supabase Storage upload failure
 */
export const uploadQueryAttachments = async (queryId, userId, files) => {

  // ── Step 1: Guard — files must be present ────────────────────────────────
  if (!files || files.length === 0) {
    const err = new Error("At least one file is required");
    err.statusCode = 400;
    throw err;
  }

  // ── Step 2: Validate query exists ────────────────────────────────────────
  const queryResult = await db
    .select({
      id: queries.id,
      queryNumber: queries.queryNumber,
    })
    .from(queries)
    .where(eq(queries.id, queryId))
    .limit(1);

  if (queryResult.length === 0) {
    const err = new Error("Query not found");
    err.statusCode = 404;
    throw err;
  }

  const { queryNumber } = queryResult[0];

  // ── Step 3: Validate file names ──────────────────────────────────────────
  for (const file of files) {
    if (file.originalname.length > 500) {
      const err = new Error(
        `File name too long: "${file.originalname.substring(0, 50)}..." exceeds 500 characters`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // ── Step 4: Upload files to Supabase Storage ─────────────────────────────
  //
  // Sequential uploads with rollback tracking. If any single upload fails,
  // all previously uploaded files are removed before the error is thrown.
  // This prevents orphaned files in storage.

  const supabase = getSupabase();
  const uploaded = []; // { storagePath, file } — tracks successful uploads

  try {
    for (const file of files) {
      const storagePath = buildStoragePath(queryNumber, file.originalname);

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        const err = new Error(`Storage upload failed for "${file.originalname}": ${uploadError.message}`);
        err.statusCode = 502;
        throw err;
      }

      uploaded.push({ storagePath, file });
    }
  } catch (uploadErr) {
    // Clean up any files that were already uploaded before the failure
    await cleanupUploadedFiles(uploaded.map((u) => u.storagePath));

    // Re-throw if it's already our error; otherwise wrap it
    if (uploadErr.statusCode) throw uploadErr;

    const err = new Error("Storage upload failed");
    err.statusCode = 502;
    throw err;
  }

  // ── Step 5: Insert DB records in a single transaction ────────────────────
  //
  // If the DB insert fails after all files are uploaded, we clean up the
  // uploaded files to avoid orphans.

  const uploadedPaths = uploaded.map((u) => u.storagePath);

  try {
    const records = uploaded.map((u) => ({
      queryId,
      replyId: null,
      fileName: u.file.originalname,
      fileSize: u.file.size,
      mimeType: u.file.mimetype,
      storagePath: u.storagePath,
      storageBackend: "supabase",
      uploadedBy: userId,
    }));

    const insertedRows = await db.transaction(async (tx) => {
      return await tx
        .insert(queryAttachments)
        .values(records)
        .returning({
          id: queryAttachments.id,
          queryId: queryAttachments.queryId,
          fileName: queryAttachments.fileName,
          fileSize: queryAttachments.fileSize,
          mimeType: queryAttachments.mimeType,
          storagePath: queryAttachments.storagePath,
          storageBackend: queryAttachments.storageBackend,
          uploadedBy: queryAttachments.uploadedBy,
          uploadedAt: queryAttachments.uploadedAt,
        });
    });

    return insertedRows;

  } catch (dbErr) {
    // DB failed — clean up all uploaded files
    await cleanupUploadedFiles(uploadedPaths);
    throw dbErr;
  }
};