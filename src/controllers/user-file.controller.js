import { getFilesByUserUlbs } from "../services/user-file.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/user-files?userId=...&page=1&limit=10
 *
 * Returns paginated files belonging to ULBs where the user is
 * currently working.
 *
 * ── Production switch ──────────────────────────────────────────────────────
 * Currently reads userId from query params (for testing).
 * When moving to production:
 *   1. Uncomment the JWT block below.
 *   2. Comment out the query-param block.
 *   3. Enable `protect` middleware in the route file.
 */
export const getUserFiles = async (req, res) => {
  try {
    // ── userId from query param (testing) ──────────────────────────────────
    // const userId = req.query.userId;

    // ── userId from JWT (production) ───────────────────────────────────────
    const userId = req.user.id;

    // ── Validate userId ────────────────────────────────────────────────────
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!UUID_REGEX.test(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format",
      });
    }

    // ── Parse and validate pagination params ───────────────────────────────
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    if (isNaN(page) || page < 1) {
      page = DEFAULT_PAGE;
    }

    if (isNaN(limit) || limit < 1) {
      limit = DEFAULT_LIMIT;
    }

    if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }

    // ── Call service ───────────────────────────────────────────────────────
    const result = await getFilesByUserUlbs({ userId, page, limit });

    const message =
      result.data.length > 0
        ? "Files fetched successfully"
        : "No files found";

    return res.status(200).json({
      success: true,
      message,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[getUserFiles] Unexpected error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};