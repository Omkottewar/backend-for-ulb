import { db } from "../db/index.js";
import { files } from "../db/schema/files.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { checklists } from "../db/schema/checklist.js";
import { queries } from "../db/schema/queries.js";
import { queryParticipants } from "../db/schema/query_participants.js";
import { queryActivityLog } from "../db/schema/query_activity_log.js";
import { eq, and, sql, count, desc } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_PRIORITIES = ["Low", "Medium", "High"];

/**
 * All possible query statuses from the query_status_enum.
 * Used to zero-fill the status-count summary so the frontend always
 * receives every status key — even those with zero queries.
 */
const ALL_STATUSES = ["Open", "In Progress", "Resolved"];

// ─────────────────────────────────────────────────────────────────────────────
// GET — paginated queries for a file
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches paginated queries belonging to a file, along with a
 * status-wise count summary.
 *
 * Queries:
 *   1. File existence check (soft-delete aware)
 *   2. Status-wise GROUP BY count (drives both the summary badges
 *      and totalRecords for pagination — no separate count query)
 *   3. Paginated data query with LEFT JOINs to resolve assignee
 *      name and role name
 *
 * Join chain (data query):
 *   queries
 *     LEFT JOIN users   ON queries.assigned_to = users.id
 *     LEFT JOIN roles   ON users.role_id       = roles.id
 *
 * LEFT JOINs are used because assigned_to is nullable in the schema.
 * If a query has no assignee, assignedTo is returned as null.
 *
 * @param {string} fileId          - UUID of the file
 * @param {Object} params
 * @param {number} params.page     - Current page number (1-based)
 * @param {number} params.limit    - Records per page
 * @returns {Promise<Object>}      - { summary, queries, pagination }
 *
 * @throws {Error} .statusCode = 404 — file not found or soft-deleted
 */
export const getQueriesByFileId = async (fileId, { page, limit }) => {

  // ── Step 1: Confirm the file exists and is not soft-deleted ──────────────
  const fileResult = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.isDeleted, false)))
    .limit(1);

  if (fileResult.length === 0) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 2: Status-wise counts ───────────────────────────────────────────
  // A single GROUP BY gives us both the summary badges and the total
  // record count for pagination metadata — no separate COUNT(*) needed.
  const countRows = await db
    .select({
      status: queries.status,
      count: count(),
    })
    .from(queries)
    .where(eq(queries.fileId, fileId))
    .groupBy(queries.status);

  // Zero-fill so every status key is always present in the response,
  // even if no queries have that status.
  const statusCounts = {};
  for (const s of ALL_STATUSES) {
    statusCounts[s] = 0;
  }
  for (const row of countRows) {
    statusCounts[row.status] = Number(row.count);
  }

  const totalRecords = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const totalPages = Math.ceil(totalRecords / limit);
  const offset = (page - 1) * limit;

  // ── Step 3: Paginated data query ─────────────────────────────────────────
  const rows = await db
    .select({
      // query fields
      id:           queries.id,
      queryNumber:  queries.queryNumber,
      title:        queries.title,
      priority:     queries.priority,
      status:       queries.status,
      dueDate:      queries.dueDate,
      checklistId:  queries.checklistId,
      createdAt:    queries.createdAt,

      // assignee fields (nullable — LEFT JOIN)
      assigneeId:       users.id,
      assigneeName:     users.name,
      assigneeRoleName: roles.name,
    })
    .from(queries)
    .leftJoin(users, eq(queries.assignedTo, users.id))
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(queries.fileId, fileId))
    .orderBy(desc(queries.createdAt))
    .limit(limit)
    .offset(offset);

  // ── Step 4: Shape response ───────────────────────────────────────────────
  const queryList = rows.map((row) => ({
    id:          row.id,
    queryNumber: row.queryNumber,
    title:       row.title,
    priority:    row.priority,
    status:      row.status,
    dueDate:     row.dueDate,
    checklist:   row.checklistId !== null,
    createdAt:   row.createdAt,
    assignedTo:  row.assigneeId
      ? {
          id:       row.assigneeId,
          name:     row.assigneeName,
          roleName: row.assigneeRoleName,
        }
      : null,
  }));

  return {
    summary: {
      total: totalRecords,
      statusCounts,
    },
    queries: queryList,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// POST — create a new query on a file (manual)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new manual query on a file.
 *
 * Inserts into four tables inside a single transaction:
 *   1. queries          — the query itself
 *   2. query_participants — raiser + assignee (if different)
 *   3. query_activity_log — "created" entry
 *   4. query_activity_log — "assigned" entry
 *
 * The query_number is auto-generated using the PostgreSQL sequence
 * `query_number_seq`, formatted as QRY-000001.
 *
 * @param {string} fileId  - UUID of the file (from route param)
 * @param {string} userId  - UUID of the user raising the query
 * @param {Object} payload - Request body fields
 * @param {string} payload.title       - Query title (required, max 500 chars)
 * @param {string} [payload.description] - Detailed description (optional)
 * @param {string} payload.assignedTo  - UUID of the user being assigned (required)
 * @param {string} [payload.priority]  - "Low" | "Medium" | "High" (defaults to "Medium")
 * @param {string} payload.dueDate     - Due date in YYYY-MM-DD format (required)
 * @param {string} [payload.checklistId] - UUID of a checklist linked to this file (optional)
 *
 * @returns {Promise<Object>} Created query data with assignee details
 *
 * @throws {Error} .statusCode = 400 — validation failures
 * @throws {Error} .statusCode = 404 — file, user, or checklist not found
 */
export const createQuery = async (fileId, userId, payload) => {

  const { title, description, assignedTo, priority, dueDate, checklistId } = payload;

  // ── Step 1: Validate title ───────────────────────────────────────────────
  if (typeof title !== "string" || title.trim().length === 0) {
    const err = new Error("title must be a non-empty string");
    err.statusCode = 400;
    throw err;
  }

  if (title.trim().length > 500) {
    const err = new Error("title must not exceed 500 characters");
    err.statusCode = 400;
    throw err;
  }

  // ── Step 2: Validate description (optional) ──────────────────────────────
  if (description !== undefined && description !== null && typeof description !== "string") {
    const err = new Error("description must be a string");
    err.statusCode = 400;
    throw err;
  }

  // ── Step 3: Validate priority (optional, defaults to Medium) ─────────────
  const resolvedPriority = priority || "Medium";

  if (!VALID_PRIORITIES.includes(resolvedPriority)) {
    const err = new Error(
      `Invalid priority value. Allowed: ${VALID_PRIORITIES.join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }

  // ── Step 4: Validate dueDate ─────────────────────────────────────────────
  const parsedDueDate = new Date(dueDate);

  if (isNaN(parsedDueDate.getTime())) {
    const err = new Error("dueDate must be a valid date (YYYY-MM-DD)");
    err.statusCode = 400;
    throw err;
  }

  // Strip time from both dates to compare calendar days only.
  // This allows a due date set to "today" to pass validation.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedDueDate.setHours(0, 0, 0, 0);

  if (parsedDueDate < today) {
    const err = new Error("dueDate cannot be in the past");
    err.statusCode = 400;
    throw err;
  }

  // ── Step 5: Verify file exists and is not soft-deleted ───────────────────
  const fileResult = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.isDeleted, false)))
    .limit(1);

  if (fileResult.length === 0) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }

  // ── Step 6: Verify assigned user exists and is active ────────────────────
  // We also fetch the user's name here — needed for the activity log detail
  // and the response shape. This avoids a post-insert lookup.
  const assigneeResult = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.id, assignedTo),
        eq(users.isActive, true),
        eq(users.isDeleted, false)
      )
    )
    .limit(1);

  if (assigneeResult.length === 0) {
    const err = new Error("Assigned user not found");
    err.statusCode = 404;
    throw err;
  }

  const assigneeName = assigneeResult[0].name;

  // ── Step 7: Verify checklist belongs to this file (conditional) ──────────
  if (checklistId) {
    const checklistResult = await db
      .select({ id: checklists.id })
      .from(checklists)
      .where(
        and(
          eq(checklists.id, checklistId),
          eq(checklists.fileId, fileId)
        )
      )
      .limit(1);

    if (checklistResult.length === 0) {
      const err = new Error("Checklist not found for this file");
      err.statusCode = 404;
      throw err;
    }
  }

  // ── Step 8: Transaction — insert query + participants + activity logs ────
  const result = await db.transaction(async (tx) => {

    // 8a. Generate query number from PostgreSQL sequence
    const seqResult = await tx.execute(
      sql`SELECT nextval('query_number_seq') AS seq`
    );
    const seq = Number(seqResult[0].seq);
    const queryNumber = `QRY-${String(seq).padStart(6, "0")}`;

    // 8b. Insert into queries table
    const [insertedQuery] = await tx
      .insert(queries)
      .values({
        queryNumber,
        fileId,
        title: title.trim(),
        description: description ? description.trim() : null,
        priority: resolvedPriority,
        status: "Open",
        raisedBy: userId,
        assignedTo,
        dueDate,
        checklistId: checklistId || null,
        checklistRef: null,
        autoGenerated: false,
      })
      .returning({
        id: queries.id,
        queryNumber: queries.queryNumber,
        fileId: queries.fileId,
        title: queries.title,
        description: queries.description,
        priority: queries.priority,
        status: queries.status,
        raisedBy: queries.raisedBy,
        assignedTo: queries.assignedTo,
        dueDate: queries.dueDate,
        checklistId: queries.checklistId,
        autoGenerated: queries.autoGenerated,
        createdAt: queries.createdAt,
      });

    // 8c. Insert raiser as participant
    await tx.insert(queryParticipants).values({
      queryId: insertedQuery.id,
      userId,
      addedBy: userId,
    });

    // 8d. Insert assignee as participant (only if different from raiser)
    if (assignedTo !== userId) {
      await tx.insert(queryParticipants).values({
        queryId: insertedQuery.id,
        userId: assignedTo,
        addedBy: userId,
      });
    }

    // 8e. Activity log — "created"
    await tx.insert(queryActivityLog).values({
      queryId: insertedQuery.id,
      actionType: "created",
      actorId: userId,
      detail: "Query created",
    });

    // 8f. Activity log — "assigned"
    await tx.insert(queryActivityLog).values({
      queryId: insertedQuery.id,
      actionType: "assigned",
      actorId: userId,
      detail: `Query assigned to ${assigneeName}`,
    });

    return insertedQuery;
  });

  // ── Step 9: Shape and return response ────────────────────────────────────
  return {
    id: result.id,
    queryNumber: result.queryNumber,
    fileId: result.fileId,
    title: result.title,
    description: result.description,
    priority: result.priority,
    status: result.status,
    raisedBy: result.raisedBy,
    assignedTo: {
      id: assignedTo,
      name: assigneeName,
    },
    dueDate: result.dueDate,
    checklistId: result.checklistId,
    autoGenerated: result.autoGenerated,
    createdAt: result.createdAt,
  };
};