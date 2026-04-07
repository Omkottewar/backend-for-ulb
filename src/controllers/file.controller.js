import { getFileById, updateFileDetails } from "../services/file.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/files/:fileId
 * Returns full file + supplier details for a given fileId.
 */
export const getFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    // Basic UUID format guard — prevents a malformed param from
    // reaching the DB and generating a confusing Postgres error.

    if (!UUID_REGEX.test(fileId)) {
      return res.status(400).json({ message: "Invalid fileId format" });
    }

    const data = await getFileById(fileId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    // Handles both 404 thrown by the service and unexpected DB errors
    const status = error.statusCode || 500;
    const message =
      status === 500 ? "Internal server error" : error.message;

    if (status === 500) {
      console.error("[getFile] Unexpected error:", error);
    }

    return res.status(status).json({ success: false, message });
  }
};

/**
 * PATCH /api/files/:fileId
 *
 * Updates editable fields on a file.
 * Accepts a partial body — only the fields being changed need to be sent.
 *
 * ── Production switch ──────────────────────────────────────────────────────
 * Currently reads userId from request body (for testing).
 * When moving to production:
 *   1. Uncomment the JWT block below.
 *   2. Comment out the body-param block.
 *   3. Enable `protect` middleware in the route file.
 *
 * Request body (all optional except userId):
 * {
 *   "userId":      "uuid",          // required (testing) — omit when using JWT
 *   "fileNumber":  "string",
 *   "title":       "string",
 *   "description": "string|null",
 *   "amount":      "number|string|null",
 *   "riskFlag":    "Low|Medium|High",
 *   "status":      "Created|Under Review|Finalized|Pre-Audit",
 *   "reason":      "string|null"    // optional edit reason for audit trail
 * }
 */

export const updateFile = async (req, res) => {
  try {
    const { fileId } = req.params;
 
    // ── Validate fileId format ─────────────────────────────────────────────
    if (!UUID_REGEX.test(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fileId format",
      });
    }
 
    // ── userId from request body (testing) ─────────────────────────────────
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
 
    // ── Delegate to service ────────────────────────────────────────────────
    const result = await updateFileDetails(fileId, userId, req.body);
 
    // Handle the "no changes" edge case — still a 200, not an error
    if (result.changesCount === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes detected",
        data: {
          fileId: result.fileId,
          versionNumber: null,
          changesCount: 0,
        },
      });
    }
 
    return res.status(200).json({
      success: true,
      message: "File updated successfully",
      data: {
        fileId: result.fileId,
        versionNumber: result.versionNumber,
        changesCount: result.changesCount,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Internal server error" : error.message;
 
    if (status === 500) {
      console.error("[updateFile] Unexpected error:", error);
    }
 
    return res.status(status).json({ success: false, message });
  }
};