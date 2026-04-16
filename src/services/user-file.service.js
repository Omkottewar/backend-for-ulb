import { db } from "../db/index.js";
import { files } from "../db/schema/files.js";
import { ulbs } from "../db/schema/ulbs.js";
import { ulbTeamAssignments } from "../db/schema/ulb_team_assignments.js";
import { teams } from "../db/schema/teams.js";
import { teamMembers } from "../db/schema/team_members.js";
import { eq, and, isNull, desc, countDistinct } from "drizzle-orm";

/**
 * Fetches paginated files belonging to ULBs where the given user
 * is currently working.
 *
 * Join chain:
 *   team_members → teams → ulb_team_assignments → ulbs → files
 *
 * "Currently working" means:
 *   - team_members.removed_at IS NULL  (user is active in the team)
 *   - ulb_team_assignments.removed_at IS NULL  (team is actively assigned to the ULB)
 *   - teams.is_deleted = false
 *   - ulbs.is_active = true AND ulbs.is_deleted = false
 *   - files.is_deleted = false
 *
 * Optional stage filter:
 *   When `stage` is provided (e.g. "Pre-Audit" or "Post-Audit"), only files
 *   with that exact stage value are returned. When omitted, all files are
 *   returned regardless of their stage value (including NULL).
 *
 * @param {Object}  params
 * @param {string}  params.userId - UUID of the user
 * @param {number}  params.page   - Current page number (1-based)
 * @param {number}  params.limit  - Records per page
 * @param {string}  [params.stage] - Optional file stage filter ("Pre-Audit" | "Post-Audit")
 * @returns {Promise<Object>} { data, pagination }
 */
export const getFilesByUserUlbs = async ({ userId, page, limit, stage }) => {

  // ── Shared filter conditions ─────────────────────────────────────────────
  // Both the count query and the data query use the exact same join chain
  // and WHERE clauses. Defining them once avoids drift between the two.
  const joinConditions = {
    teams: eq(teamMembers.teamId, teams.id),
    ulbTeamAssignments: eq(teams.id, ulbTeamAssignments.teamId),
    ulbs: eq(ulbTeamAssignments.ulbId, ulbs.id),
    files: eq(files.ulbId, ulbs.id),
  };

  const conditions = [
    eq(teamMembers.userId, userId),
    isNull(teamMembers.removedAt),
    eq(teams.isDeleted, false),
    isNull(ulbTeamAssignments.removedAt),
    eq(ulbs.isActive, true),
    eq(ulbs.isDeleted, false),
    eq(files.isDeleted, false),
  ];

  if (stage) {
    conditions.push(eq(files.stage, stage));
  }

  const whereClause = and(...conditions);

  // ── Count query (for pagination metadata) ────────────────────────────────
  const countResult = await db
    .select({ total: countDistinct(files.id) })
    .from(teamMembers)
    .innerJoin(teams, joinConditions.teams)
    .innerJoin(ulbTeamAssignments, joinConditions.ulbTeamAssignments)
    .innerJoin(ulbs, joinConditions.ulbs)
    .innerJoin(files, joinConditions.files)
    .where(whereClause);

  const totalRecords = Number(countResult[0].total);
  const totalPages = Math.ceil(totalRecords / limit);
  const offset = (page - 1) * limit;

  // ── Data query ───────────────────────────────────────────────────────────
  const rows = await db
    .selectDistinct({
      id: files.id,
      fileNumber: files.fileNumber,
      fileTitle: files.fileTitle,
      ulbName: ulbs.name,
      amount: files.amount,
      riskFlag: files.riskFlag,
      status: files.status,
      stage: files.stage,
      createdAt: files.createdAt,
    })
    .from(teamMembers)
    .innerJoin(teams, joinConditions.teams)
    .innerJoin(ulbTeamAssignments, joinConditions.ulbTeamAssignments)
    .innerJoin(ulbs, joinConditions.ulbs)
    .innerJoin(files, joinConditions.files)
    .where(whereClause)
    .orderBy(desc(files.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages,
    },
  };
};