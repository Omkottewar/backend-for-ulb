import { getFilesByUserUlbs } from "../services/user-file.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Maps the client-facing auditType query-param values (lowercase kebab-case)
 * to the database enum values (Title Case).
 *
 * Frontend sends:  ?auditType=pre-audit   or  ?auditType=post-audit
 * Database stores: "Pre-Audit"            or  "Post-Audit"
 */
const AUDIT_TYPE_TO_STAGE = {
  "pre-audit": "Pre-Audit",
  "post-audit": "Post-Audit",
};

/**
 * GET /api/user-files?page=1&limit=50&auditType=pre-audit
 *
 * Returns paginated files belonging to ULBs where the user is
 * currently working.
 *
 * Optional query params:
 *   - page       (default 1)
 *   - limit      (default 50, max 100)
 *   - auditType  ("pre-audit" | "post-audit") — filters by file stage.
 *                 When omitted, returns all files regardless of stage.
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

    // ── Parse and validate auditType ───────────────────────────────────────
    const auditTypeParam = req.query.auditType;
    let stage;

    if (auditTypeParam) {
      stage = AUDIT_TYPE_TO_STAGE[auditTypeParam];

      if (!stage) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid auditType. Allowed values: pre-audit, post-audit",
        });
      }
    }

    // ── Call service ───────────────────────────────────────────────────────
    const result = await getFilesByUserUlbs({ userId, page, limit, stage });

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