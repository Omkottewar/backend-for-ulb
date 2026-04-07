import { getQueryReplies } from "../services/query-reply.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/queries/:queryId/replies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns cursor-paginated replies for a query.
 *
 * Route params:
 *   - queryId (UUID)
 *
 * Query params:
 *   - limit  (optional, integer, default 5, max 50)
 *   - before (optional, ISO 8601 timestamp — cursor for "load previous")
 *
 * Success → 200 with replies + pagination
 * Errors  → 400 (bad UUID / bad params) | 404 (query not found) | 500
 */
export const getReplies = async (req, res) => {
  try {
    const { queryId } = req.params;

    // ── UUID format gate ───────────────────────────────────────────────────
    if (!UUID_REGEX.test(queryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid queryId format",
      });
    }

    // ── Parse and validate query params ────────────────────────────────────
    const { limit: rawLimit, before } = req.query;

    let limit;
    if (rawLimit !== undefined) {
      limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        return res.status(400).json({
          success: false,
          message: "limit must be a positive integer",
        });
      }
    }

    if (before !== undefined) {
      const parsed = new Date(before);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          message: "before must be a valid ISO 8601 timestamp",
        });
      }
    }

    const data = await getQueryReplies(queryId, { limit, before });

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