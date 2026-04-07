import { getQueryDetail } from "../services/query-detail.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/queries/:queryId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns full details of a single query.
 *
 * Route params:
 *   - queryId (UUID) — validated before any DB call
 *
 * Success → 200 with query details + query-level attachments
 * Errors  → 400 (bad UUID) | 404 (not found) | 500
 */
export const getQueryDetails = async (req, res) => {
  try {
    const { queryId } = req.params;

    // ── UUID format gate ───────────────────────────────────────────────────
    if (!UUID_REGEX.test(queryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid queryId format",
      });
    }

    const data = await getQueryDetail(queryId);

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