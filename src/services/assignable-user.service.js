import { db } from "../db/index.js";
import { files } from "../db/schema/files.js";
import { ulbTeamAssignments } from "../db/schema/ulb_team_assignments.js";
import { teamMembers } from "../db/schema/team_members.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { eq, and, isNull, asc } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// GET — assignable users for a file (used when raising a new query)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active users who belong to teams assigned to the
 * file's ULB. Used to populate the "Assign To" dropdown when
 * raising a new query on a file.
 *
 * Unlike the eligible-participants endpoint (which excludes existing
 * query participants), this endpoint returns ALL active ULB users
 * because no query exists yet — there are no participants to exclude.
 * The raiser is included because a user can assign a query to themselves.
 *
 * Join chain:
 *   files
 *     → ulb_team_assignments (removed_at IS NULL)
 *       → team_members (removed_at IS NULL)
 *         → users (is_active = true, is_deleted = false)
 *           → roles
 *
 * DISTINCT is required because a user may belong to multiple teams
 * assigned to the same ULB, which would produce duplicate rows.
 * All INNER JOINs are safe — ulb_id, team_id, user_id, role_id
 * are all NOT NULL.
 *
 * @param {string} fileId - UUID of the file
 * @returns {Promise<Object>} - { assignableUsers: [...] }
 *
 * @throws {Error} .statusCode = 404 — file not found or soft-deleted
 */
export const getAssignableUsers = async (fileId) => {

  // ── Step 1: Resolve file → ULB ──────────────────────────────────────────
  const [fileRow] = await db
    .select({
      id: files.id,
      ulbId: files.ulbId,
    })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.isDeleted, false)))
    .limit(1);

  if (!fileRow) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }

  const { ulbId } = fileRow;

  // ── Step 2: Fetch all active users in the ULB ───────────────────────────
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
    .where(
      and(
        eq(ulbTeamAssignments.ulbId, ulbId),
        isNull(ulbTeamAssignments.removedAt),
        isNull(teamMembers.removedAt),
        eq(users.isActive, true),
        eq(users.isDeleted, false)
      )
    )
    .orderBy(asc(users.name));

  // ── Shape response ──────────────────────────────────────────────────────
  return {
    assignableUsers: rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      roleName: r.roleName,
    })),
  };
};