import { db } from "../db/index.js";
import { queries } from "../db/schema/queries.js";
import { queryActivityLog } from "../db/schema/query_activity_log.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { eq, and } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the number of full calendar days between two dates.
 *
 * Strips time components so that a query created and resolved on
 * the same calendar day returns 0, created yesterday returns 1, etc.
 *
 * @param {Date} createdAt - Query creation timestamp
 * @param {Date} resolvedAt - Resolution timestamp (now)
 * @returns {number} Non-negative integer — calendar days elapsed
 */
const calculateDaysTaken = (createdAt, resolvedAt) => {
  const created = new Date(createdAt);
  created.setHours(0, 0, 0, 0);

  const resolved = new Date(resolvedAt);
  resolved.setHours(0, 0, 0, 0);

  const diffMs = resolved.getTime() - created.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — resolve a query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marks a query as resolved.
 *
 * Business rules:
 *   • resolution_text is mandatory
 *   • days_taken is auto-calculated (calendar days from created_at to now)
 *   • Any authenticated user can resolve — no role restriction
 *   • Re-resolution is allowed — an already-resolved query can be
 *     resolved again with updated resolution text and timestamp
 *
 * Validations:
 *   1. Query exists → retrieve created_at for days_taken calculation
 *   2. Acting user exists and is active → get name and role for
 *      activity log and response
 *   3. resolutionText is a non-empty string
 *
 * Transaction (2 operations):
 *   1. UPDATE queries — status, resolved_at, resolved_by,
 *      resolution_text, days_taken, updated_at
 *   2. INSERT into query_activity_log — "resolved" action
 *
 * @param {string} queryId        - UUID of the query
 * @param {string} userId         - UUID of the resolving user
 * @param {string} resolutionText - Mandatory resolution description
 *
 * @returns {Promise<Object>} Resolution details
 *
 * @throws {Error} .statusCode = 400 — validation failures
 * @throws {Error} .statusCode = 404 — query or user not found
 */
export const resolveQuery = async (queryId, userId, resolutionText) => {

  // ── Step 1: Validate resolutionText ──────────────────────────────────────
  if (typeof resolutionText !== "string" || resolutionText.trim().length === 0) {
    const err = new Error("resolutionText must be a non-empty string");
    err.statusCode = 400;
    throw err;
  }

  // ── Step 2: Validate query exists → get created_at and current status ───
  const [queryRow] = await db
    .select({
      id: queries.id,
      status: queries.status,
      createdAt: queries.createdAt,
    })
    .from(queries)
    .where(eq(queries.id, queryId))
    .limit(1);

  if (!queryRow) {
    const err = new Error("Query not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 3: Validate resolving user exists and is active ────────────────
  const [resolver] = await db
    .select({
      id: users.id,
      name: users.name,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(users.id, userId),
        eq(users.isActive, true),
        eq(users.isDeleted, false)
      )
    )
    .limit(1);

  if (!resolver) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 4: Calculate days_taken and resolution timestamp ────────────────
  const resolvedAt = new Date();
  const daysTaken = calculateDaysTaken(queryRow.createdAt, resolvedAt);

  // ── Step 5: Transaction — update query + activity log ───────────────────
  const previousStatus = queryRow.status;

  await db.transaction(async (tx) => {

    // 5a. Update query with resolution fields
    await tx
      .update(queries)
      .set({
        status: "Resolved",
        resolvedAt,
        resolvedBy: userId,
        resolutionText: resolutionText.trim(),
        daysTaken,
        updatedAt: resolvedAt,
      })
      .where(eq(queries.id, queryId));

    // 5b. Activity log — "resolved"
    await tx.insert(queryActivityLog).values({
      queryId,
      actionType: "resolved",
      actorId: userId,
      detail: `${resolver.name} resolved the query`,
    });

    // 5c. If status actually changed, log the status transition too
    if (previousStatus !== "Resolved") {
      await tx.insert(queryActivityLog).values({
        queryId,
        actionType: "status",
        actorId: userId,
        detail: `Status changed from ${previousStatus} to Resolved`,
      });
    }
  });

  // ── Shape response ──────────────────────────────────────────────────────
  return {
    id: queryRow.id,
    status: "Resolved",
    resolvedAt,
    resolvedBy: {
      id: resolver.id,
      name: resolver.name,
      roleName: resolver.roleName,
    },
    resolutionText: resolutionText.trim(),
    daysTaken,
  };
};