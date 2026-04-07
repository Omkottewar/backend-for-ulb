import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import { queries } from "../db/schema/queries.js";
import { queryReplies } from "../db/schema/query_replies.js";
import { queryAttachments } from "../db/schema/query_attachments.js";
import { queryActivityLog } from "../db/schema/query_activity_log.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { eq, and } from "drizzle-orm";
import { getSupabase, STORAGE_BUCKET } from "../config/supabase.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitises a filename for safe use in a storage path.
 * Replaces any character that is not alphanumeric, dot, dash, or underscore.
 * Collapses consecutive underscores and caps length at 200 characters.
 */
const sanitizeFileName = (name) => {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 200);
};

/**
 * Builds a unique storage path for a reply attachment.
 *
 * Format: queries/{queryNumber}/replies/{8-char-uuid}-{sanitised-name}
 *
 * Separating reply attachments under a /replies/ subfolder keeps
 * them distinct from query-level attachments in storage.
 */
const buildReplyStoragePath = (queryNumber, originalName) => {
  const prefix = uuidv4().slice(0, 8);
  const sanitized = sanitizeFileName(originalName);
  return `queries/${queryNumber}/replies/${prefix}-${sanitized}`;
};

/**
 * Best-effort cleanup of uploaded files from Supabase Storage.
 * Called when a downstream step (DB insert) fails after files were
 * already uploaded. Logs but never throws.
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
// POST — add a reply to a query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a reply to a query with optional file attachments.
 *
 * If the query's current status is "Open", it is automatically
 * transitioned to "In Progress" and an additional activity log
 * entry is recorded.
 *
 * Flow:
 *   1. Validate query exists → retrieve queryNumber and current status
 *   2. Validate replier exists and is active → get name and role for
 *      activity log and response
 *   3. Upload files to Supabase Storage (if provided, sequential)
 *      - If any upload fails → clean up already-uploaded files → throw
 *   4. DB Transaction:
 *      a. INSERT into query_replies → get replyId
 *      b. INSERT into query_attachments (if files uploaded) with replyId
 *      c. INSERT into query_activity_log — "replied" entry
 *      d. IF status = "Open" → UPDATE queries.status to "In Progress"
 *         + INSERT into query_activity_log — "status" entry
 *   5. If transaction fails → clean up uploaded files → throw
 *
 * File uploads happen BEFORE the DB transaction because Supabase is
 * an external service that cannot participate in the DB transaction.
 * If the DB transaction fails, uploaded files are cleaned up (best-effort).
 * This matches the existing pattern in query-attachment.service.js.
 *
 * @param {string} queryId    - UUID of the query (from route param)
 * @param {string} userId     - UUID of the replying user
 * @param {string} replyText  - Reply content (required, non-empty)
 * @param {Array<Express.Multer.File>} [uploadedFiles=[]] - Multer file objects
 *
 * @returns {Promise<Object>} Created reply with attachments and status transition info
 *
 * @throws {Error} .statusCode = 400 — validation failures
 * @throws {Error} .statusCode = 404 — query or user not found
 * @throws {Error} .statusCode = 502 — Supabase Storage upload failure
 */
export const addReplyToQuery = async (queryId, userId, replyText, uploadedFiles = []) => {

  // ── Step 1: Validate replyText ───────────────────────────────────────────
  if (typeof replyText !== "string" || replyText.trim().length === 0) {
    const err = new Error("replyText must be a non-empty string");
    err.statusCode = 400;
    throw err;
  }

  // ── Step 2: Validate query exists → get queryNumber + current status ────
  const [queryRow] = await db
    .select({
      id: queries.id,
      queryNumber: queries.queryNumber,
      status: queries.status,
    })
    .from(queries)
    .where(eq(queries.id, queryId))
    .limit(1);

  if (!queryRow) {
    const err = new Error("Query not found");
    err.statusCode = 404;
    throw err;
  }

  const { queryNumber, status: currentStatus } = queryRow;

  // ── Step 3: Validate replier exists, is active, and get name + role ─────
  const [replier] = await db
    .select({
      id: users.id,
      name: users.name,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(users.id, userId),
        eq(users.isActive, true),
        eq(users.isDeleted, false)
      )
    )
    .limit(1);

  if (!replier) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 4: Validate file names (if files provided) ─────────────────────
  for (const file of uploadedFiles) {
    if (file.originalname.length > 500) {
      const err = new Error(
        `File name too long: "${file.originalname.substring(0, 50)}..." exceeds 500 characters`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // ── Step 5: Upload files to Supabase Storage (outside transaction) ──────
  const uploaded = []; // { storagePath, file }

  if (uploadedFiles.length > 0) {
    const supabase = getSupabase();

    try {
      for (const file of uploadedFiles) {
        const storagePath = buildReplyStoragePath(queryNumber, file.originalname);

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          const err = new Error(
            `Storage upload failed for "${file.originalname}": ${uploadError.message}`
          );
          err.statusCode = 502;
          throw err;
        }

        uploaded.push({ storagePath, file });
      }
    } catch (uploadErr) {
      await cleanupUploadedFiles(uploaded.map((u) => u.storagePath));

      if (uploadErr.statusCode) throw uploadErr;

      const err = new Error("Storage upload failed");
      err.statusCode = 502;
      throw err;
    }
  }

  const uploadedPaths = uploaded.map((u) => u.storagePath);

  // ── Step 6: DB Transaction ──────────────────────────────────────────────
  let result;

  try {
    result = await db.transaction(async (tx) => {

      // 6a. Insert reply
      const [insertedReply] = await tx
        .insert(queryReplies)
        .values({
          queryId,
          replyText: replyText.trim(),
          repliedBy: userId,
        })
        .returning({
          id: queryReplies.id,
          replyText: queryReplies.replyText,
          repliedAt: queryReplies.repliedAt,
        });

      // 6b. Insert attachment records (if files were uploaded)
      let insertedAttachments = [];

      if (uploaded.length > 0) {
        const attachmentRecords = uploaded.map((u) => ({
          queryId,
          replyId: insertedReply.id,
          fileName: u.file.originalname,
          fileSize: u.file.size,
          mimeType: u.file.mimetype,
          storagePath: u.storagePath,
          storageBackend: "supabase",
          uploadedBy: userId,
        }));

        insertedAttachments = await tx
          .insert(queryAttachments)
          .values(attachmentRecords)
          .returning({
            id: queryAttachments.id,
            fileName: queryAttachments.fileName,
            fileSize: queryAttachments.fileSize,
            mimeType: queryAttachments.mimeType,
          });
      }

      // 6c. Activity log — "replied"
      await tx.insert(queryActivityLog).values({
        queryId,
        actionType: "replied",
        actorId: userId,
        detail: `${replier.name} replied`,
      });

      // 6d. Auto-transition: Open → In Progress
      let statusTransition = null;

      if (currentStatus === "Open") {
        await tx
          .update(queries)
          .set({
            status: "In Progress",
            updatedAt: new Date(),
          })
          .where(eq(queries.id, queryId));

        await tx.insert(queryActivityLog).values({
          queryId,
          actionType: "status",
          actorId: userId,
          detail: "Status changed from Open to In Progress",
        });

        statusTransition = {
          from: "Open",
          to: "In Progress",
        };
      }

      return {
        reply: insertedReply,
        attachments: insertedAttachments,
        statusTransition,
      };
    });
  } catch (dbErr) {
    // Transaction failed — clean up any uploaded files
    await cleanupUploadedFiles(uploadedPaths);
    throw dbErr;
  }

  // ── Step 7: Shape response ──────────────────────────────────────────────
  return {
    id: result.reply.id,
    replyText: result.reply.replyText,
    repliedAt: result.reply.repliedAt,
    repliedBy: {
      id: replier.id,
      name: replier.name,
      roleName: replier.roleName,
    },
    attachments: result.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
    })),
    statusTransition: result.statusTransition,
  };
};