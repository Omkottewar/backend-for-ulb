import { createQuery, getQueriesByFileId } from "../services/query.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// ─────────────────────────────────────────────────────────────────────────────
// GET — paginated queries for a file
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/files/:fileId/queries?page=1&limit=10
 *
 * Returns paginated queries belonging to a file, along with a
 * status-wise count summary for the badge bar.
 */
export const getQueriesByFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    // ── Validate fileId format ─────────────────────────────────────────────
    if (!UUID_REGEX.test(fileId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fileId format",
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
    const result = await getQueriesByFileId(fileId, { page, limit });

    const message =
      result.queries.length > 0
        ? "Queries fetched successfully"
        : "No queries found for this file";

    return res.status(200).json({
      success: true,
      message,
      data: {
        summary: result.summary,
        queries: result.queries,
      },
      pagination: result.pagination,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Internal server error" : error.message;

    if (status === 500) {
      console.error("[getQueriesByFile] Unexpected error:", error);
    }

    return res.status(status).json({ success: false, message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST — raise a new query on a file
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/files/:fileId/queries
 *
 * Creates a new manual query on a file.
 *
 * ── Production switch ──────────────────────────────────────────────────────
 * Currently reads userId from request body (for testing).
 * When moving to production:
 *   1. Uncomment the JWT block below.
 *   2. Comment out the body-param block.
 *   3. Enable `protect` middleware in the route file.
 *
 * Request body:
 * {
 *   "title":        "string",                    // required
 *   "description":  "string|null",               // optional
 *   "assignedTo":   "uuid",                      // required
 *   "priority":     "Low|Medium|High",           // optional, defaults to "Medium"
 *   "dueDate":      "YYYY-MM-DD",                // required
 *   "checklistId":  "uuid|null",                 // optional
 *   "userId":       "uuid"                       // required (testing) — omit when using JWT
 * }
 */
export const raiseQuery = async (req, res) => {
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

    // ── Validate required fields ───────────────────────────────────────────
    const { title, assignedTo, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: title",
      });
    }

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: assignedTo",
      });
    }

    if (!UUID_REGEX.test(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignedTo format",
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: dueDate",
      });
    }

    // ── Validate optional checklistId format (if provided) ─────────────────
    const { checklistId } = req.body;

    if (checklistId && !UUID_REGEX.test(checklistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid checklistId format",
      });
    }

    // ── Delegate to service ────────────────────────────────────────────────
    const data = await createQuery(fileId, userId, req.body);

    return res.status(201).json({
      success: true,
      message: "Query created successfully",
      data,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status === 500 ? "Internal server error" : error.message;

    if (status === 500) {
      console.error("[raiseQuery] Unexpected error:", error);
    }

    return res.status(status).json({ success: false, message });
  }
};