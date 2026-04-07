import { getAssignableUsers } from "../services/assignable-user.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/files/:fileId/assignable-users
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all active ULB users who can be assigned to a new query
 * on this file.
 *
 * Route params:
 *   - fileId (UUID) — validated before any DB call
 *
 * Success → 200 with assignable user list
 * Errors  → 400 (bad UUID) | 404 (file not found) | 500
 */
export const getAssignableUserList = async (req, res) => {
  try {
    const { fileId } = req.params;

    // ── UUID format gate ───────────────────────────────────────────────────
    if (!UUID_REGEX.test(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fileId format",
      });
    }

    const data = await getAssignableUsers(fileId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};