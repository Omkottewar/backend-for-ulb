import { db } from "../db/index.js";
import { queries } from "../db/schema/queries.js";
import { queryReplies } from "../db/schema/query_replies.js";
import { queryAttachments } from "../db/schema/query_attachments.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { eq, and, lt, desc, inArray } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default number of replies returned on initial load. */
const DEFAULT_LIMIT = 5;

/** Maximum replies that can be requested in a single call. */
const MAX_LIMIT = 50;

// ─────────────────────────────────────────────────────────────────────────────
// GET — paginated replies for a query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches cursor-paginated replies for a query, each carrying its
 * inline attachment metadata.
 *
 * Pagination model — "load previous" (reverse chronological cursor):
 *   • Initial load  : no `before` cursor → latest N replies
 *   • Load previous  : `before` = replied_at of the oldest reply the
 *                      frontend currently holds → next N older replies
 *
 * The service fetches `limit + 1` rows to detect whether more older
 * replies exist, avoiding a separate COUNT query.
 *
 * Queries:
 *   1. Query existence check — distinguishes "no replies yet" (200)
 *      from "query not found" (404).
 *   2. Paginated replies with replier name + role.
 *      Fetched in DESC order for correct LIMIT slicing, then reversed
 *      to chronological (ASC) before returning.
 *   3. Batch-fetch attachments for the reply IDs in the current page.
 *      Grouped by reply_id in JS and attached inline to each reply.
 *      Avoids a LEFT JOIN which would duplicate reply rows per
 *      attachment and break the LIMIT arithmetic.
 *
 * Join chain (query 2):
 *   query_replies
 *     INNER JOIN users ON query_replies.replied_by = users.id
 *     INNER JOIN roles ON users.role_id            = roles.id
 *
 * Both INNER JOINs are safe — replied_by and role_id are NOT NULL.
 * Soft-deleted replies (is_deleted = true) are excluded completely.
 *
 * @param {string} queryId          - UUID of the query
 * @param {Object} params
 * @param {number} [params.limit=5] - Replies per page (max 50)
 * @param {string} [params.before]  - ISO 8601 cursor (replied_at of
 *                                    the oldest reply on the frontend)
 * @returns {Promise<Object>}       - { replies, pagination }
 *
 * @throws {Error} .statusCode = 404 — query not found
 */
export const getQueryReplies = async (queryId, { limit = DEFAULT_LIMIT, before } = {}) => {
  // ── Clamp limit ──────────────────────────────────────────────────────────
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // ── Step 1: Verify query exists ──────────────────────────────────────────
  const queryResult = await db
    .select({ id: queries.id })
    .from(queries)
    .where(eq(queries.id, queryId))
    .limit(1);

  if (queryResult.length === 0) {
    const err = new Error("Query not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 2: Fetch replies ────────────────────────────────────────────────
  // Fetch one extra row to determine hasMore without a COUNT query.
  const fetchLimit = safeLimit + 1;

  const conditions = [
    eq(queryReplies.queryId, queryId),
    eq(queryReplies.isDeleted, false),
  ];

  if (before) {
    conditions.push(lt(queryReplies.repliedAt, new Date(before)));
  }

  const rows = await db
    .select({
      id: queryReplies.id,
      replyText: queryReplies.replyText,
      repliedAt: queryReplies.repliedAt,

      replierId: users.id,
      replierName: users.name,
      replierRoleName: roles.name,
    })
    .from(queryReplies)
    .innerJoin(users, eq(queryReplies.repliedBy, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(...conditions))
    .orderBy(desc(queryReplies.repliedAt))
    .limit(fetchLimit);

  // ── hasMore detection ────────────────────────────────────────────────────
  const hasMore = rows.length > safeLimit;
  const replyRows = hasMore ? rows.slice(0, safeLimit) : rows;

  // Reverse to chronological order (oldest → newest within the batch)
  replyRows.reverse();

  // Early return — valid query but no replies (yet)
  if (replyRows.length === 0) {
    return {
      replies: [],
      pagination: { hasMore: false, nextCursor: null },
    };
  }

  // ── Step 3: Batch-fetch attachments for reply IDs ────────────────────────
  const replyIds = replyRows.map((r) => r.id);

  const attachmentRows = await db
    .select({
      id: queryAttachments.id,
      replyId: queryAttachments.replyId,
      fileName: queryAttachments.fileName,
      fileSize: queryAttachments.fileSize,
      mimeType: queryAttachments.mimeType,
    })
    .from(queryAttachments)
    .where(inArray(queryAttachments.replyId, replyIds));

  // Group attachments by replyId
  const attachmentsByReplyId = {};
  for (const a of attachmentRows) {
    if (!attachmentsByReplyId[a.replyId]) {
      attachmentsByReplyId[a.replyId] = [];
    }
    attachmentsByReplyId[a.replyId].push({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
    });
  }

  // ── Step 4: Shape response ───────────────────────────────────────────────
  // nextCursor = replied_at of the oldest reply in the batch (index 0
  // after the ASC reverse). The frontend sends this as `before` in the
  // next "load previous" request.
  const nextCursor = hasMore ? replyRows[0].repliedAt.toISOString() : null;

  const replies = replyRows.map((r) => ({
    id: r.id,
    replyText: r.replyText,
    repliedAt: r.repliedAt,
    repliedBy: {
      id: r.replierId,
      name: r.replierName,
      roleName: r.replierRoleName,
    },
    attachments: attachmentsByReplyId[r.id] || [],
  }));

  return {
    replies,
    pagination: {
      hasMore,
      nextCursor,
    },
  };
};