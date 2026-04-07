import { db } from "../db/index.js";
import { queries } from "../db/schema/queries.js";
import { queryActivityLog } from "../db/schema/query_activity_log.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { eq, asc } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// GET — activity log for a query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the full activity log for a query in chronological order.
 *
 * Each log entry records a discrete action (created, assigned, replied,
 * participant added, status change, resolved) with the actor's identity
 * and a server-generated detail string.
 *
 * Queries:
 *   1. Query existence check — distinguishes "no activity" (200, empty)
 *      from "query not found" (404).
 *   2. Activity log joined with actor's name and role.
 *
 * Join chain (query 2):
 *   query_activity_log
 *     INNER JOIN users ON query_activity_log.actor_id = users.id
 *     INNER JOIN roles ON users.role_id               = roles.id
 *
 * Both INNER JOINs are safe — actor_id and role_id are NOT NULL.
 * Results are ordered by performed_at ASC (oldest → newest),
 * matching the top-to-bottom timeline in the UI.
 *
 * @param {string} queryId - UUID of the query
 * @returns {Promise<Object>} - { activityLog: [...] }
 *
 * @throws {Error} .statusCode = 404 — query not found
 */
export const getQueryActivityLog = async (queryId) => {
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

  // ── Step 2: Fetch activity log with actor details ────────────────────────
  const rows = await db
    .select({
      id: queryActivityLog.id,
      actionType: queryActivityLog.actionType,
      detail: queryActivityLog.detail,
      performedAt: queryActivityLog.performedAt,

      actorId: users.id,
      actorName: users.name,
      actorRoleName: roles.name,
    })
    .from(queryActivityLog)
    .innerJoin(users, eq(queryActivityLog.actorId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(queryActivityLog.queryId, queryId))
    .orderBy(asc(queryActivityLog.performedAt));

  // ── Shape response ──────────────────────────────────────────────────────
  return {
    activityLog: rows.map((r) => ({
      id: r.id,
      actionType: r.actionType,
      detail: r.detail,
      performedAt: r.performedAt,
      actor: {
        id: r.actorId,
        name: r.actorName,
        roleName: r.actorRoleName,
      },
    })),
  };
};