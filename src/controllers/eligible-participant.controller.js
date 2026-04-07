import { getEligibleParticipants } from "../services/eligible-participant.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/queries/:queryId/eligible-participants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns users who can be added as participants to a query.
 *
 * The list is scoped to the query's file's ULB and excludes users
 * who are already participants.
 *
 * Route params:
 *   - queryId (UUID) — validated before any DB call
 *
 * Success → 200 with eligible participant list
 * Errors  → 400 (bad UUID) | 404 (query not found) | 500
 */
export const getEligibleParticipantList = async (req, res) => {
  try {
    const { queryId } = req.params;

    // ── UUID format gate ───────────────────────────────────────────────────
    if (!UUID_REGEX.test(queryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid queryId format",
      });
    }

    const data = await getEligibleParticipants(queryId);

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