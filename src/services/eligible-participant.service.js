import { db } from "../db/index.js";
import { queries } from "../db/schema/queries.js";
import { files } from "../db/schema/files.js";
import { ulbTeamAssignments } from "../db/schema/ulb_team_assignments.js";
import { teamMembers } from "../db/schema/team_members.js";
import { queryParticipants } from "../db/schema/query_participants.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { eq, and, isNull, asc, notInArray } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// GET — eligible participants for a query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches users who can be added as participants to a query.
 *
 * Eligible users are those who:
 *   • Belong to at least one team assigned to the query's file's ULB
 *   • Are active team members (team_members.removed_at IS NULL)
 *   • Belong to active team assignments (ulb_team_assignments.removed_at IS NULL)
 *   • Are active and not soft-deleted (users.is_active, users.is_deleted)
 *   • Are NOT already participants of this query
 *
 * Queries:
 *   1. Query existence + ULB resolution
 *      queries INNER JOIN files → returns ulbId.
 *      Also serves as the 404 check.
 *   2. Existing participant user IDs for this query
 *      (used to exclude from eligible list).
 *   3. Eligible users through the ULB → teams → members chain,
 *      excluding existing participants.
 *
 * Join chain (query 3):
 *   ulb_team_assignments
 *     INNER JOIN team_members ON ulb_team_assignments.team_id = team_members.team_id
 *     INNER JOIN users        ON team_members.user_id         = users.id
 *     INNER JOIN roles        ON users.role_id                = roles.id
 *
 * DISTINCT is required because a user may belong to multiple teams
 * assigned to the same ULB, which would produce duplicate rows.
 * All INNER JOINs are safe — team_id, user_id, and role_id are NOT NULL.
 *
 * @param {string} queryId - UUID of the query
 * @returns {Promise<Object>} - { eligibleParticipants: [...] }
 *
 * @throws {Error} .statusCode = 404 — query not found
 */
export const getEligibleParticipants = async (queryId) => {
  // ── Step 1: Resolve query → file → ULB ───────────────────────────────────
  const [queryFile] = await db
    .select({
      queryId: queries.id,
      ulbId: files.ulbId,
    })
    .from(queries)
    .innerJoin(files, eq(queries.fileId, files.id))
    .where(eq(queries.id, queryId))
    .limit(1);

  if (!queryFile) {
    const err = new Error("Query not found");
    err.statusCode = 404;
    throw err;
  }

  const { ulbId } = queryFile;

  // ── Step 2: Get existing participant user IDs ────────────────────────────
  const existingRows = await db
    .select({ userId: queryParticipants.userId })
    .from(queryParticipants)
    .where(eq(queryParticipants.queryId, queryId));

  const existingUserIds = existingRows.map((r) => r.userId);

  // ── Step 3: Eligible users — ULB → teams → active members ───────────────
  const conditions = [
    eq(ulbTeamAssignments.ulbId, ulbId),
    isNull(ulbTeamAssignments.removedAt),
    isNull(teamMembers.removedAt),
    eq(users.isActive, true),
    eq(users.isDeleted, false),
  ];

  if (existingUserIds.length > 0) {
    conditions.push(notInArray(users.id, existingUserIds));
  }

  const rows = await db
    .selectDistinct({
      userId: users.id,
      name: users.name,
      roleName: roles.name,
    })
    .from(ulbTeamAssignments)
    .innerJoin(teamMembers, eq(ulbTeamAssignments.teamId, teamMembers.teamId))
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(...conditions))
    .orderBy(asc(users.name));

  // ── Shape response ──────────────────────────────────────────────────────
  return {
    eligibleParticipants: rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      roleName: r.roleName,
    })),
  };
};