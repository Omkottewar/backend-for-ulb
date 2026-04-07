import { addParticipantToQuery } from "../services/add-query-participant.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/queries/:queryId/participants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a user as a participant to a query.
 *
 * Route params:
 *   - queryId (UUID)
 *
 * Body (JSON):
 *   - participantUserId (UUID, required) — the user being added
 *   - userId (UUID, required for testing — switches to req.user.id with JWT)
 *
 * ── Production switch ──────────────────────────────────────────────────────
 * Currently reads userId from req.body (for testing with Postman).
 * When moving to production:
 *   1. Uncomment the JWT block below.
 *   2. Comment out the body block.
 *   3. Enable `protect` middleware in the route file.
 *
 * Success → 201 with added participant details
 * Errors  → 400 (bad UUID / missing fields) | 404 | 409 (duplicate) | 500
 */
export const addParticipant = async (req, res) => {
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

    // ── Validate participantUserId ─────────────────────────────────────────
    const { participantUserId } = req.body;

    if (!participantUserId) {
      return res.status(400).json({
        success: false,
        message: "participantUserId is required",
      });
    }

    if (!UUID_REGEX.test(participantUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid participantUserId format",
      });
    }

    const data = await addParticipantToQuery(queryId, userId, participantUserId);

    return res.status(201).json({
      success: true,
      message: "Participant added successfully",
      data,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status === 500 ? "Internal server error" : err.message;

    if (status === 500) {
      console.error("[addParticipant] Unexpected error:", err);
    }

    return res.status(status).json({ success: false, message });
  }
};