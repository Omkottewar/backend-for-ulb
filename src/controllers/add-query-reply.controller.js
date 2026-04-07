import { addReplyToQuery } from "../services/add-query-reply.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/queries/:queryId/replies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a reply to a query with optional file attachments.
 *
 * Expects multipart/form-data (handled by the multer middleware
 * upstream in the route). Text fields come from req.body, files
 * from req.files.
 *
 * Form fields:
 *   - replyText  (required, string)
 *   - userId     (required for testing — switches to req.user.id with JWT)
 *
 * File fields:
 *   - documents  (optional, 0–5 files via multer)
 *
 * ── Production switch ──────────────────────────────────────────────────────
 * Currently reads userId from a form field (for testing with Postman).
 * When moving to production:
 *   1. Uncomment the JWT block below.
 *   2. Comment out the form-field block.
 *   3. Enable `protect` middleware in the route file.
 *
 * Success → 201 with created reply + attachments + status transition info
 * Errors  → 400 | 404 | 502 | 500
 */
export const addReply = async (req, res) => {
  try {
    const { queryId } = req.params;

    // ── Validate queryId format ────────────────────────────────────────────
    if (!UUID_REGEX.test(queryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid queryId format",
      });
    }

    // ── userId from form field (testing) ───────────────────────────────────
    // const userId = req.body.userId;

    // ── userId from JWT (production) ───────────────────────────────────────
    const userId = req.user.id;

    // ── Validate userId ────────────────────────────────────────────────────
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    if (!UUID_REGEX.test(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId format",
      });
    }

    // ── Validate replyText presence ────────────────────────────────────────
    const { replyText } = req.body;

    if (!replyText) {
      return res.status(400).json({
        success: false,
        message: "replyText is required",
      });
    }

    // ── Delegate to service ────────────────────────────────────────────────
    const uploadedFiles = req.files || [];

    const data = await addReplyToQuery(queryId, userId, replyText, uploadedFiles);

    return res.status(201).json({
      success: true,
      message: "Reply added successfully",
      data,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status === 500 ? "Internal server error" : err.message;

    if (status === 500) {
      console.error("[addReply] Unexpected error:", err);
    }

    return res.status(status).json({ success: false, message });
  }
};