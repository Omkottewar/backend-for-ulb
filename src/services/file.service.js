import { db } from "../db/index.js";
import { files } from "../db/schema/files.js";
import { suppliers } from "../db/schema/suppliers.js";
import { contractTypes } from "../db/schema/contract_types.js";
import { ulbs } from "../db/schema/ulbs.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { fileVersionHistory } from "../db/schema/file_version_history.js";
import { fileVersionChanges } from "../db/schema/file_version_changes.js";
import { eq, and, ne, max, sql } from "drizzle-orm";
 
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
 
const VALID_RISK_FLAGS = ["Low", "Medium", "High"];
 
const VALID_STATUSES = ["Created", "Under Review", "Finalized", "Pre-Audit"];
 
/**
 * Allowed status transitions.
 * Key   = current status
 * Value = array of statuses the file may transition TO.
 */
const ALLOWED_STATUS_TRANSITIONS = {
  "Created":      ["Under Review"],
  "Under Review": ["Created", "Finalized"],
  "Finalized":    ["Pre-Audit"],
  "Pre-Audit":    [],
};
 
/**
 * Maps the DB column name (snake_case) used in file_version_changes.field_name
 * to a human-readable label stored in file_version_changes.field_label.
 */
const FIELD_LABEL_MAP = {
  file_number:       "File Number",
  file_title:        "Title",
  work_description:  "Description",
  amount:            "Amount",
  risk_flag:         "Risk Flag",
  status:            "Status",
};
 
/**
 * Maps the camelCase request-body key to the corresponding Drizzle column
 * reference on the `files` table and the snake_case DB column name used
 * for version-change tracking.
 */
const EDITABLE_FIELDS = {
  fileNumber:  { drizzleKey: "fileNumber",       dbName: "file_number" },
  title:       { drizzleKey: "fileTitle",        dbName: "file_title" },
  description: { drizzleKey: "workDescription",  dbName: "work_description" },
  amount:      { drizzleKey: "amount",           dbName: "amount" },
  riskFlag:    { drizzleKey: "riskFlag",         dbName: "risk_flag" },
  status:      { drizzleKey: "status",           dbName: "status" },
};
 
// ─────────────────────────────────────────────────────────────────────────────
// GET — single file by ID (existing)
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Fetches a single file record by its UUID, joined with supplier
 * and contract type data.
 *
 * @param {string} fileId - UUID of the file
 * @returns {Promise<Object>} Shaped response object
 * @throws {Error} with .statusCode = 404 if file not found or soft-deleted
 */
export const getFileById = async (fileId) => {
  const result = await db
    .select({
      // ---- file fields ----
      fileNumber: files.fileNumber,
      title: files.fileTitle,
      contractTypeId: files.contractTypeId,
      description: files.workDescription,
      amount: files.amount,
      riskFlag: files.riskFlag,
      status: files.status,
      createdAt: files.createdAt,

      // ---- contract type (nullable — LEFT JOIN) ----
      contractType: contractTypes.name,

      // ----- ULB fields (nullable — LEFT JOIN) ----
      ulbName: ulbs.name,

      // ---- supplier fields ----
      supplierId: suppliers.id,
      supplierName: suppliers.supplierName,
      pan: suppliers.pan,
      gst: suppliers.gstNo,
      epf: suppliers.epfRegistrationNo,
      esic: suppliers.esicRegistrationNo,
      labour: suppliers.labourLicenceNo,
      departmentName: suppliers.departmentName,
      supplierFileNo: suppliers.fileNo,
      fundName: suppliers.fundName,

      // ---- needed only for soft-delete guard ----
      isDeleted: files.isDeleted,
    })
    .from(files)
    .leftJoin(ulbs, eq(files.ulbId, ulbs.id))
    .leftJoin(suppliers, eq(files.supplierId, suppliers.id))
    .leftJoin(contractTypes, eq(files.contractTypeId, contractTypes.id))
    .where(eq(files.id, fileId))
    .limit(1);

  if (result.length === 0) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }

  const row = result[0];

  if (row.isDeleted) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }

  // Shape the final response — strip internal fields
  return {
    file: {
      fileNumber: row.fileNumber,
      title: row.title,
      description: row.description,
      amount: row.amount,
      contractTypeId: row.contractTypeId,
      contractType: row.contractType,
      riskFlag: row.riskFlag,
      status: row.status,
      createdAt: row.createdAt,
    },
    ulb: {
      ulbName: row.ulbName
    },
    supplier: {
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      pan: row.pan,
      gst: row.gst,
      epf: row.epf,
      esic: row.esic,
      labour: row.labour,
      departmentName: row.departmentName,
      fileNo: row.supplierFileNo,
      fundName: row.fundName,
    },
  };
};


// ─────────────────────────────────────────────────────────────────────────────
// PATCH — edit file details
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Updates editable fields on a file, records a version-history snapshot,
 * and writes field-level change records — all inside a single transaction.
 *
 * Editable fields: fileNumber, title, description, amount, riskFlag, status.
 * Only the fields present in `payload` are considered (partial update).
 *
 * @param {string}  fileId  - UUID of the file to update
 * @param {string}  userId  - UUID of the user performing the edit
 * @param {Object}  payload - Partial object with editable fields + optional reason
 * @returns {Promise<Object>} { fileId, versionNumber, changesCount }
 *
 * @throws {Error} .statusCode = 400  — no editable fields, invalid values
 * @throws {Error} .statusCode = 404  — file or user not found
 * @throws {Error} .statusCode = 409  — file is finalized / fileNumber collision
 * @throws {Error} .statusCode = 422  — invalid status transition
 */
export const updateFileDetails = async (fileId, userId, payload) => {
 
  // ── Step 1: Extract and validate editable fields from payload ────────────
  const incoming = {};
  const editableKeys = Object.keys(EDITABLE_FIELDS);
 
  for (const key of editableKeys) {
    if (payload[key] !== undefined) {
      incoming[key] = payload[key];
    }
  }
 
  if (Object.keys(incoming).length === 0) {
    const err = new Error(
      "At least one editable field is required: fileNumber, title, description, amount, riskFlag, status"
    );
    err.statusCode = 400;
    throw err;
  }
 
  // ── Step 2: Field-level validation ───────────────────────────────────────
 
  if (incoming.fileNumber !== undefined) {
    if (typeof incoming.fileNumber !== "string" || incoming.fileNumber.trim().length === 0) {
      const err = new Error("fileNumber must be a non-empty string");
      err.statusCode = 400;
      throw err;
    }
    if (incoming.fileNumber.trim().length > 50) {
      const err = new Error("fileNumber must not exceed 50 characters");
      err.statusCode = 400;
      throw err;
    }
    incoming.fileNumber = incoming.fileNumber.trim();
  }
 
  if (incoming.title !== undefined) {
    if (typeof incoming.title !== "string" || incoming.title.trim().length === 0) {
      const err = new Error("title must be a non-empty string");
      err.statusCode = 400;
      throw err;
    }
    if (incoming.title.trim().length > 500) {
      const err = new Error("title must not exceed 500 characters");
      err.statusCode = 400;
      throw err;
    }
    incoming.title = incoming.title.trim();
  }
 
  if (incoming.description !== undefined) {
    if (incoming.description !== null && typeof incoming.description !== "string") {
      const err = new Error("description must be a string or null");
      err.statusCode = 400;
      throw err;
    }
    if (typeof incoming.description === "string") {
      incoming.description = incoming.description.trim();
    }
  }
 
  if (incoming.amount !== undefined) {
    if (incoming.amount !== null) {
      // Accept both string and number — normalise to string for numeric column
      const parsed = Number(incoming.amount);
      if (isNaN(parsed) || parsed < 0) {
        const err = new Error("amount must be a non-negative number");
        err.statusCode = 400;
        throw err;
      }
      incoming.amount = parsed.toFixed(2);
    }
  }
 
  if (incoming.riskFlag !== undefined) {
    if (!VALID_RISK_FLAGS.includes(incoming.riskFlag)) {
      const err = new Error(
        `riskFlag must be one of: ${VALID_RISK_FLAGS.join(", ")}`
      );
      err.statusCode = 400;
      throw err;
    }
  }
 
  if (incoming.status !== undefined) {
    if (!VALID_STATUSES.includes(incoming.status)) {
      const err = new Error(
        `status must be one of: ${VALID_STATUSES.join(", ")}`
      );
      err.statusCode = 400;
      throw err;
    }
  }
 
  // ── Step 3: Fetch current file ───────────────────────────────────────────
  const fileResult = await db
    .select({
      id:              files.id,
      fileNumber:      files.fileNumber,
      fileTitle:       files.fileTitle,
      workDescription: files.workDescription,
      amount:          files.amount,
      riskFlag:        files.riskFlag,
      status:          files.status,
      finalized:       files.finalized,
      isDeleted:       files.isDeleted,
    })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);
 
  if (fileResult.length === 0) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }
 
  const currentFile = fileResult[0];
 
  if (currentFile.isDeleted) {
    const err = new Error("File not found");
    err.statusCode = 404;
    throw err;
  }
 
  // ── Step 4: Guard — finalized files cannot be edited ─────────────────────
  if (currentFile.finalized) {
    const err = new Error("Cannot edit a finalized file");
    err.statusCode = 409;
    throw err;
  }
 
  // ── Step 5: Guard — status transition ────────────────────────────────────
  if (incoming.status !== undefined && incoming.status !== currentFile.status) {
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentFile.status] || [];
    if (!allowed.includes(incoming.status)) {
      const err = new Error(
        `Status transition from '${currentFile.status}' to '${incoming.status}' is not allowed. ` +
        `Allowed transitions: ${allowed.length > 0 ? allowed.join(", ") : "none"}`
      );
      err.statusCode = 422;
      throw err;
    }
  }
 
  // ── Step 6: Guard — fileNumber uniqueness ────────────────────────────────
  if (
    incoming.fileNumber !== undefined &&
    incoming.fileNumber !== currentFile.fileNumber
  ) {
    const collision = await db
      .select({ id: files.id })
      .from(files)
      .where(
        and(
          eq(files.fileNumber, incoming.fileNumber),
          ne(files.id, fileId)
        )
      )
      .limit(1);
 
    if (collision.length > 0) {
      const err = new Error(
        `File number '${incoming.fileNumber}' is already in use by another file`
      );
      err.statusCode = 409;
      throw err;
    }
  }
 
  // ── Step 7: Diff calculation — only persist actual changes ───────────────
  // Build a map: { dbColumnName: { oldValue, newValue } } for fields that
  // actually differ. Values are cast to string|null for consistent comparison
  // because the DB stores numeric/enum as text in version-change records.
 
  const currentValues = {
    fileNumber:  currentFile.fileNumber,
    title:       currentFile.fileTitle,
    description: currentFile.workDescription,
    amount:      currentFile.amount,       // already a string from numeric col
    riskFlag:    currentFile.riskFlag,
    status:      currentFile.status,
  };
 
  const changes = [];
 
  for (const [key, newVal] of Object.entries(incoming)) {
    const oldVal = currentValues[key];
 
    // Normalise both sides to string|null for a reliable equality check.
    const oldStr = oldVal === null || oldVal === undefined ? null : String(oldVal);
    const newStr = newVal === null || newVal === undefined ? null : String(newVal);
 
    if (oldStr === newStr) continue;
 
    const { dbName } = EDITABLE_FIELDS[key];
    changes.push({
      fieldName:  dbName,
      fieldLabel: FIELD_LABEL_MAP[dbName],
      oldValue:   oldStr,
      newValue:   newStr,
    });
  }
 
  if (changes.length === 0) {
    return { fileId, versionNumber: null, changesCount: 0, message: "No changes detected" };
  }
 
  // ── Step 8: Resolve actor's role name ────────────────────────────────────
  const userResult = await db
    .select({ roleName: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
    .limit(1);
 
  if (userResult.length === 0) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
 
  const changedByRole = userResult[0].roleName;
 
  // ── Step 9: Compute next version number ──────────────────────────────────
  const maxResult = await db
    .select({ maxVersion: max(fileVersionHistory.versionNumber) })
    .from(fileVersionHistory)
    .where(eq(fileVersionHistory.fileId, fileId));
 
  const nextVersion = (maxResult[0]?.maxVersion ?? 0) + 1;
 
  // ── Step 10: Transactional write — update + version history + changes ────
  const reason = payload.reason !== undefined ? payload.reason : null;
 
  const result = await db.transaction(async (tx) => {
 
    // 10a. Build the dynamic SET clause for the files table
    const updateSet = {
      updatedBy: userId,
      updatedAt: sql`now()`,
    };
 
    for (const [key, newVal] of Object.entries(incoming)) {
      // Only include fields that actually changed
      const { dbName, drizzleKey } = EDITABLE_FIELDS[key];
      const hasChange = changes.some((c) => c.fieldName === dbName);
      if (!hasChange) continue;
 
      updateSet[drizzleKey] = newVal;
    }
 
    await tx
      .update(files)
      .set(updateSet)
      .where(eq(files.id, fileId));
 
    // 10b. Insert version history record
    const [versionRow] = await tx
      .insert(fileVersionHistory)
      .values({
        fileId,
        versionNumber: nextVersion,
        changedBy:     userId,
        changedByRole,
        reason,
      })
      .returning({ id: fileVersionHistory.id });
 
    // 10c. Insert one change record per changed field
    const changeRows = changes.map((c) => ({
      versionId:  versionRow.id,
      fieldName:  c.fieldName,
      fieldLabel: c.fieldLabel,
      oldValue:   c.oldValue,
      newValue:   c.newValue,
    }));
 
    await tx.insert(fileVersionChanges).values(changeRows);
 
    return versionRow.id;
  });
 
  // ── Step 11: Return minimal success data ─────────────────────────────────
  return {
    fileId,
    versionNumber: nextVersion,
    changesCount:  changes.length,
  };
};