import { db } from "../db/index.js";
import { queries } from "../db/schema/queries.js";
import { queryParticipants } from "../db/schema/query_participants.js";
import { queryActivityLog } from "../db/schema/query_activity_log.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { eq, and } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// POST — add a participant to a query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a user as a participant to a query.
 *
 * Validations:
 *   1. Query exists
 *   2. Participant user exists, is active, and is not soft-deleted
 *   3. User is not already a participant (graceful duplicate guard
 *      — checked in application code rather than relying solely on
 *      the unique index to produce a clear error message)
 *
 * Transaction (2 inserts):
 *   1. INSERT into query_participants
 *   2. INSERT into query_activity_log — "participant" action,
 *      detail constructed server-side: "Added {name} as participant"
 *
 * The actor (userId) is the user performing the action. The participant
 * being added is participantUserId. These may be different — e.g.,
 * Muskan adds Vikram as a participant.
 *
 * @param {string} queryId           - UUID of the query
 * @param {string} userId            - UUID of the acting user (who is adding)
 * @param {string} participantUserId - UUID of the user being added
 *
 * @returns {Promise<Object>} Added participant details
 *
 * @throws {Error} .statusCode = 400 — validation failures
 * @throws {Error} .statusCode = 404 — query or user not found
 * @throws {Error} .statusCode = 409 — user is already a participant
 */
export const addParticipantToQuery = async (queryId, userId, participantUserId) => {

  // ── Step 1: Validate query exists ────────────────────────────────────────
  const [queryRow] = await db
    .select({ id: queries.id })
    .from(queries)
    .where(eq(queries.id, queryId))
    .limit(1);

  if (!queryRow) {
    const err = new Error("Query not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 2: Validate participant user exists and is active ───────────────
  const [participant] = await db
    .select({
      id: users.id,
      name: users.name,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(
      and(
        eq(users.id, participantUserId),
        eq(users.isActive, true),
        eq(users.isDeleted, false)
      )
    )
    .limit(1);

  if (!participant) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 3: Check for duplicate participation ────────────────────────────
  const [existing] = await db
    .select({ id: queryParticipants.id })
    .from(queryParticipants)
    .where(
      and(
        eq(queryParticipants.queryId, queryId),
        eq(queryParticipants.userId, participantUserId)
      )
    )
    .limit(1);

  if (existing) {
    const err = new Error("User is already a participant of this query");
    err.statusCode = 409;
    throw err;
  }

  // ── Step 4: Validate acting user exists ──────────────────────────────────
  // The actor may differ from the participant being added. We need the
  // actor's name for the activity log detail string.
  let actorName;

  if (userId === participantUserId) {
    // Same person — reuse already-fetched data
    actorName = participant.name;
  } else {
    const [actor] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.isActive, true),
          eq(users.isDeleted, false)
        )
      )
      .limit(1);

    if (!actor) {
      const err = new Error("Acting user not found");
      err.statusCode = 404;
      throw err;
    }

    actorName = actor.name;
  }

  // ── Step 5: Transaction — insert participant + activity log ──────────────
  const result = await db.transaction(async (tx) => {

    // 5a. Insert participant
    const [inserted] = await tx
      .insert(queryParticipants)
      .values({
        queryId,
        userId: participantUserId,
        addedBy: userId,
      })
      .returning({
        id: queryParticipants.id,
        addedAt: queryParticipants.addedAt,
      });

    // 5b. Activity log — "participant"
    await tx.insert(queryActivityLog).values({
      queryId,
      actionType: "participant",
      actorId: userId,
      detail: `${actorName} added ${participant.name} as participant`,
    });

    return inserted;
  });

  // ── Shape response ──────────────────────────────────────────────────────
  return {
    id: result.id,
    userId: participant.id,
    name: participant.name,
    roleName: participant.roleName,
    addedAt: result.addedAt,
  };
};