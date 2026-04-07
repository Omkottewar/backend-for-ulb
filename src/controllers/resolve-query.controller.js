import { resolveQuery } from "../services/resolve-query.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/queries/:queryId/resolve
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks a query as resolved.
 *
 * Route params:
 *   - queryId (UUID)
 *
 * Body (JSON):
 *   - resolutionText (string, required)
 *   - userId (UUID, required for testing — switches to req.user.id with JWT)
 *
 * ── Production switch ──────────────────────────────────────────────────────
 * Currently reads userId from req.body (for testing with Postman).
 * When moving to production:
 *   1. Uncomment the JWT block below.
 *   2. Comment out the body block.
 *   3. Enable `protect` middleware in the route file.
 *
 * Success → 200 with resolution details
 * Errors  → 400 | 404 | 500
 */
export const markQueryResolved = async (req, res) => {
  try {
    const { queryId } = req.params;

    // ── Validate queryId format ────────────────────────────────────────────
    if (!UUID_REGEX.test(queryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid queryId format",
      });
    }

    // ── userId from body (testing) ─────────────────────────────────────────
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

    // ── Validate resolutionText presence ───────────────────────────────────
    const { resolutionText } = req.body;

    if (!resolutionText) {
      return res.status(400).json({
        success: false,
        message: "resolutionText is required",
      });
    }

    const data = await resolveQuery(queryId, userId, resolutionText);

    return res.status(200).json({
      success: true,
      message: "Query resolved successfully",
      data,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status === 500 ? "Internal server error" : err.message;

    if (status === 500) {
      console.error("[markQueryResolved] Unexpected error:", err);
    }

    return res.status(status).json({ success: false, message });
  }
};