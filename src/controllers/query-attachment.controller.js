import { uploadQueryAttachments } from "../services/query-attachment.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/queries/:queryId/attachments
 *
 * Uploads one or more documents to a query.
 * Expects multipart/form-data with files under the "documents" field.
 *
 * ── Production switch ──────────────────────────────────────────────────────
 * Currently reads userId from a form field (for testing with Postman).
 * When moving to production:
 *   1. Uncomment the JWT block below.
 *   2. Comment out the form-field block.
 *   3. Enable `protect` middleware in the route file.
 *
 * Note: Since the request is multipart/form-data (not JSON), userId
 * is sent as a text field alongside the file fields:
 *   formData.append("userId", "uuid-here");
 *   formData.append("documents", file1);
 *   formData.append("documents", file2);
 */
export const addQueryAttachments = async (req, res) => {
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

    // ── Validate files are present ─────────────────────────────────────────
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one file is required. Use form field: \"documents\"",
      });
    }

    // ── Delegate to service ────────────────────────────────────────────────
    const data = await uploadQueryAttachments(queryId, userId, req.files);

    return res.status(201).json({
      success: true,
      message: `${data.length} attachment(s) uploaded successfully`,
      data,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Internal server error" : error.message;

    if (status === 500) {
      console.error("[addQueryAttachments] Unexpected error:", error);
    }

    return res.status(status).json({ success: false, message });
  }
};