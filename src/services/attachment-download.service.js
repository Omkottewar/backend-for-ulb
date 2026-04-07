import { db } from "../db/index.js";
import { queryAttachments } from "../db/schema/query_attachments.js";
import { eq } from "drizzle-orm";
import { getSupabase, STORAGE_BUCKET } from "../config/supabase.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signed URL validity duration in seconds.
 *
 * 60 minutes — generous enough for normal use. Every download click
 * generates a fresh URL, so even if the user was away for a while,
 * they get a new 60-minute window on each click.
 */
const SIGNED_URL_EXPIRES_IN = 60 * 60; // 3600 seconds

// ─────────────────────────────────────────────────────────────────────────────
// GET — generate download URL for a query attachment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a time-limited download URL for a query attachment.
 *
 * The URL is created on demand — not pre-computed or cached. This
 * ensures that every download click produces a fresh, valid link
 * regardless of how long the user has been viewing the page.
 *
 * Storage backend handling:
 *   • "supabase" — generates a signed URL via Supabase Storage API.
 *     The signed URL bypasses RLS and expires after SIGNED_URL_EXPIRES_IN
 *     seconds. The `download` option is set so the browser triggers a
 *     file download rather than inline rendering.
 *   • "local"    — returns the storage_path as-is. This covers seed data
 *     and local dev environments where files are stored on disk.
 *     In production, all uploads go through Supabase.
 *
 * @param {string} attachmentId - UUID of the query_attachments record
 * @returns {Promise<Object>} Download URL and file metadata
 *
 * @throws {Error} .statusCode = 404 — attachment not found
 * @throws {Error} .statusCode = 404 — storage_path missing in record
 * @throws {Error} .statusCode = 502 — Supabase signed URL generation failed
 */
export const getAttachmentDownloadUrl = async (attachmentId) => {

  // ── Step 1: Look up attachment ───────────────────────────────────────────
  const [attachment] = await db
    .select({
      id: queryAttachments.id,
      fileName: queryAttachments.fileName,
      fileSize: queryAttachments.fileSize,
      mimeType: queryAttachments.mimeType,
      storagePath: queryAttachments.storagePath,
      storageBackend: queryAttachments.storageBackend,
    })
    .from(queryAttachments)
    .where(eq(queryAttachments.id, attachmentId))
    .limit(1);

  if (!attachment) {
    const err = new Error("Attachment not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 2: Guard — storage_path must exist ─────────────────────────────
  if (!attachment.storagePath) {
    const err = new Error("Attachment has no associated storage path");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 3: Generate download URL based on storage backend ──────────────
  let downloadUrl;
  let expiresIn;

  if (attachment.storageBackend === "supabase") {
    const supabase = getSupabase();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(attachment.storagePath, SIGNED_URL_EXPIRES_IN, {
        download: attachment.fileName,
      });

    if (error) {
      const err = new Error(
        `Failed to generate download URL: ${error.message}`
      );
      err.statusCode = 502;
      throw err;
    }

    downloadUrl = data.signedUrl;
    expiresIn = SIGNED_URL_EXPIRES_IN;
  } else {
    // Local or other backend — return the raw storage path.
    // The frontend / reverse proxy handles serving the file.
    downloadUrl = attachment.storagePath;
    expiresIn = null;
  }

  // ── Shape response ──────────────────────────────────────────────────────
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    downloadUrl,
    expiresIn,
  };
};