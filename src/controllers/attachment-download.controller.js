import { getAttachmentDownloadUrl } from "../services/attachment-download.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/query-attachments/:attachmentId/download
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a time-limited download URL for a query attachment.
 *
 * Called on demand when the user clicks "Download" — no pre-loading.
 * Returns a fresh signed URL every time, so stale links are never
 * an issue even if the user was away for a while.
 *
 * Route params:
 *   - attachmentId (UUID) — validated before any DB call
 *
 * Success → 200 with download URL and file metadata
 * Errors  → 400 (bad UUID) | 404 (not found) | 502 (storage error) | 500
 */
export const downloadAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;

    // ── UUID format gate ───────────────────────────────────────────────────
    if (!UUID_REGEX.test(attachmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attachmentId format",
      });
    }

    const data = await getAttachmentDownloadUrl(attachmentId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status === 500 ? "Internal server error" : err.message;

    if (status === 500) {
      console.error("[downloadAttachment] Unexpected error:", err);
    }

    return res.status(status).json({ success: false, message });
  }
};