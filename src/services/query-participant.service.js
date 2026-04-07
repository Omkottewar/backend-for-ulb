import { db } from "../db/index.js";
import { queries } from "../db/schema/queries.js";
import { queryParticipants } from "../db/schema/query_participants.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { eq, asc } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// GET — participants for a query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the current participant list for a query.
 *
 * Every query has at least the raiser as a participant (inserted at
 * creation time). The assignee is also added if different from the
 * raiser. Additional participants can be added manually.
 *
 * Queries:
 *   1. Query existence check — distinguishes "no participants" (200)
 *      from "query not found" (404).
 *   2. Participants joined with user name and role name, ordered by
 *      added_at ASC so the raiser (earliest participant) appears first.
 *
 * Join chain (query 2):
 *   query_participants
 *     INNER JOIN users ON query_participants.user_id = users.id
 *     INNER JOIN roles ON users.role_id              = roles.id
 *
 * Both INNER JOINs are safe — user_id and role_id are NOT NULL.
 *
 * @param {string} queryId - UUID of the query
 * @returns {Promise<Object>} - { participants: [...] }
 *
 * @throws {Error} .statusCode = 404 — query not found
 */
export const getQueryParticipants = async (queryId) => {
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

  // ── Step 2: Fetch participants with user details ─────────────────────────
  const rows = await db
    .select({
      id: queryParticipants.id,
      userId: users.id,
      name: users.name,
      roleName: roles.name,
      addedAt: queryParticipants.addedAt,
    })
    .from(queryParticipants)
    .innerJoin(users, eq(queryParticipants.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(queryParticipants.queryId, queryId))
    .orderBy(asc(queryParticipants.addedAt));

  // ── Shape response ──────────────────────────────────────────────────────
  return {
    participants: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      roleName: r.roleName,
      addedAt: r.addedAt,
    })),
  };
};