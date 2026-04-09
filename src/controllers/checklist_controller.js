import { db } from "../db/index.js";
import { checklists } from "../db/schema/checklist.js";
import { checklistResponses } from "../db/schema/checklist_responses.js";
import { checklistTemplateQuestions } from "../db/schema/checklist_template_questions.js";
import { attachments } from "../db/schema/attachments.js";
import { checklistTemplates } from "../db/schema/checklist_templates.js";
import { eq, and, sql } from "drizzle-orm";
import { getSupabase, STORAGE_BUCKET } from "../config/supabase.js";
import { getFileType } from "../utils/files_utils.js";

/* =========================================================
CREATE CHECKLIST
========================================================= */
export const createChecklist = async (req, res) => {
  try {

    const { fileId } = req.params;
    const { templateId, phaseNumber, checkerName, checkDate } = req.body;

    const userId = req.user.id;

    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: "fileId is required"
      });
    }

    if (!templateId || !phaseNumber) {
      return res.status(400).json({
        success: false,
        message: "templateId and phaseNumber are required"
      });
    }

    const existing = await db
      .select()
      .from(checklists)
      .where(
        and(
          eq(checklists.fileId, fileId),
          eq(checklists.phaseNumber, phaseNumber)
        )
      );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Checklist already exists for this phase"
      });
    }

    const [checklist] = await db
      .insert(checklists)
      .values({
        fileId,
        templateId,
        phaseNumber,
        checkerName,
        checkDate,
        status: "Draft",
        createdBy: userId
      })
      .returning();

    return res.status(201).json({
      success: true,
      data: checklist
    });

  } catch (err) {

    console.error("CREATE CHECKLIST ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to create checklist"
    });

  }
};

/* =========================================================
GET CHECKLISTS BY FILE
========================================================= */

export const getChecklistsByFile = async (req, res) => {

  try {

    const { fileId } = req.params;

    const result = await db
      .select()
      .from(checklists)
      .where(eq(checklists.fileId, fileId))
      .orderBy(checklists.phaseNumber);

    res.json({
      success: true,
      checklists: result
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to fetch checklists"
    });
  }
};


/* =========================================================
UPDATE CHECKLIST
========================================================= */

const ALLOWED_STATUS = ["Draft", "In Progress", "Completed"];

export const updateChecklist = async (req, res) => {
  try {
    const { checklistId } = req.params;
    const { checkerName, checkDate, status } = req.body;

    const userId = req.user?.id; // assume auth middleware

    if (!checklistId) {
      return res.status(400).json({
        success: false,
        message: "Checklist ID is required"
      });
    }

    // Validate status
    if (status && !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid checklist status"
      });
    }

    // Build update payload safely
    const updateData = {
      updatedAt: new Date(),
      updatedBy: userId || null
    };

    if (checkerName !== undefined) updateData.checkerName = checkerName;
    if (checkDate !== undefined) updateData.checkDate = checkDate;
    if (status !== undefined) updateData.status = status;

    // Check checklist exists
    const existing = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, checklistId))
      .limit(1);

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Checklist not found"
      });
    }
    const [updatedChecklist] = await db
      .update(checklists)
      .set(updateData)
      .where(eq(checklists.id, checklistId))
      .returning();

    return res.status(200).json({
      success: true,
      checklist: updatedChecklist
    });

  } catch (err) {
    console.error("Update Checklist Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};



export const getChecklistDetails = async (req, res) => {
  try {
    const { checklistId } = req.params;

    // 1. Fetch checklist
    const checklistResult = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, checklistId))
      .limit(1);

    const checklist = checklistResult[0];
    if (!checklist) {
      return res.status(404).json({ success: false, message: "Checklist not found" });
    }

    // 2. Fetch template
    const templateResult = await db
      .select()
      .from(checklistTemplates)
      .where(eq(checklistTemplates.id, checklist.templateId))
      .limit(1);

    const template = templateResult[0];
    if (!template?.templateJson) {
      return res.status(404).json({ success: false, message: "Template not found or JSON missing" });
    }

    const templateJson = JSON.parse(JSON.stringify(template.templateJson));

    // 3. Fetch responses joined with question_key
    //    responseMap keyed by questionKey (e.g. "gem_availability_status")
    const rawResponses = await db
      .select({
        questionKey: checklistTemplateQuestions.questionKey,
        responseValue: checklistResponses.responseValue,
        remark: checklistResponses.remark,
      })
      .from(checklistResponses)
      .innerJoin(
        checklistTemplateQuestions,
        eq(checklistResponses.questionId, checklistTemplateQuestions.id)
      )
      .where(eq(checklistResponses.checklistId, checklistId));

    const responseMap = {};
    rawResponses.forEach(r => {
      responseMap[r.questionKey] = {
        value: r.responseValue,
        remark: r.remark ?? "",
      };
    });

    // 4. Inject responses into all section types
    templateJson.sections?.forEach(section => {

      // Regular fields
      section.fields?.forEach(field => {
        const saved = responseMap[field.fieldId];
        field.value = saved?.value ?? null;
        field.remark = saved?.remark ?? "";
      });

      // Conditional group fields
      section.conditionalGroups?.forEach(group => {
        group.fields?.forEach(field => {
          const saved = responseMap[field.fieldId];
          field.value = saved?.value ?? null;
          field.remark = saved?.remark ?? "";
        });
      });

      // Checklist table items
      if (section.type === "checklist_table") {
        section.items?.forEach(item => {
          if (item.responseField?.fieldId) {
            const saved = responseMap[item.responseField.fieldId];
            item.responseField.value = saved?.value ?? null;
          }
          if (item.remarkField?.fieldId) {
            const saved = responseMap[item.remarkField.fieldId];
            item.remarkField.value = saved?.value ?? null;
          }
        });
      }
      // ── Dynamic table — parse JSON blob back into savedRows ───────────
      if (section.type === "table") {
        const key = `__table_${section.sectionId}`;
        const saved = responseMap[key];
        if (saved?.value) {
          try {
            section.savedRows = JSON.parse(saved.value);
            console.log(`✅ Loaded ${section.savedRows.length} rows for ${section.sectionId}`);
          } catch {
            console.warn(`⚠️ Could not parse table data for ${section.sectionId}`);
            section.savedRows = [];
          }
        } else {
          section.savedRows = [];
        }
      }
      // Document checklist
      // Document checklist — already correct in your backend, just verify it's there
      if (section.type === "document_checklist") {
        section.items?.forEach(item => {
          if (item.checkField?.fieldId) {
            const saved = responseMap[item.checkField.fieldId];
            item.checkField.value = saved?.value ?? null;
          }
        });
      }

      // Line items table: keys are stored as `${rowId}_amount` and `${rowId}_remark`
      // Line items table: keys stored as `rowId_columnId` (single underscore)
      // FIX: was hardcoded to _amount and _remark only — now uses columnId to
      // match the frontend's `${row.rowId}_${col.columnId}` convention.
      // ── Line items table — inject savedValues per column ─────────────
      if (section.type === "line_items_table") {
        section.rows?.forEach(row => {
          row.savedValues = {};
          section.columns?.forEach(col => {
            if (col.type === "readonly") return;
            const key = `${row.rowId}_${col.columnId}`;
            row.savedValues[col.columnId] = responseMap[key]?.value ?? null;
          });
          // legacy compat
          row.savedAmount = row.savedValues?.bd_amount ?? null;
          row.savedRemark = row.savedValues?.bd_remark ?? null;
        });
      }

      // ── Dynamic table — parse JSON blob into savedRows ────────────────
      if (section.type === "table") {
        const key = `__table_${section.sectionId}`;
        const saved = responseMap[key];
        if (saved?.value) {
          try {
            section.savedRows = JSON.parse(saved.value);
          } catch {
            console.warn(`⚠️ Could not parse table rows for ${section.sectionId}`);
            section.savedRows = [];
          }
        } else {
          section.savedRows = [];
        }
      }

      // Dynamic table columns — row data stored separately, skip injection here
    });

    // 5. Also send responses as a flat array so the frontend can build its own map
    res.json({
      success: true,
      checklist,
      form: templateJson,
      responses: rawResponses,  // [ { questionKey, responseValue, remark } ]
    });

  } catch (err) {
    console.error("GET CHECKLIST DETAILS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to load checklist" });
  }
};
export const saveChecklistResponses = async (req, res) => {
  try {
    const { checklistId } = req.params;
    const { responses } = req.body;
    const userId = req.user.id;

    const checklist = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, checklistId))
      .limit(1);

    if (!checklist.length) {
      return res.status(404).json({ message: "Checklist not found" });
    }

    const templateId = checklist[0].templateId;

    const questions = await db
      .select()
      .from(checklistTemplateQuestions)
      .where(eq(checklistTemplateQuestions.templateId, templateId));

    const questionMap = {};
    questions.forEach(q => {
      questionMap[q.questionKey] = q.id;
    });

    // FIX: log dropped keys so silent failures are visible in server logs
    const dropped = responses.filter(r => !questionMap[r.questionId]);
    if (dropped.length > 0) {
      console.warn(
        `⚠️  ${dropped.length} response(s) dropped — questionKey not found in template [${templateId}]:`,
        dropped.map(r => r.questionId)
      );
    }

    const values = responses
      .filter(r => questionMap[r.questionId])
      .map(r => ({
        checklistId,
        questionId: questionMap[r.questionId],
        // FIX: allow null values so cleared fields are actually persisted
        responseValue: r.responseValue ?? null,
        remark: r.remark ?? null,
        respondedAt: new Date(),
        respondedBy: userId,
      }));

    if (values.length === 0) {
      console.warn("⚠️  No valid responses to save after filtering.");
      return res.json({
        success: true,
        message: "No valid responses to save",
        dropped: dropped.length,
      });
    }

    await db
      .insert(checklistResponses)
      .values(values)
      .onConflictDoUpdate({
        target: [
          checklistResponses.checklistId,
          checklistResponses.questionId,
        ],
        set: {
          // FIX: allow null to overwrite — clears previously saved values
          responseValue: sql`excluded.response_value`,
          remark: sql`excluded.remark`,
          respondedAt: new Date(),
          respondedBy: userId,
        },
      });

    console.log(`✅ Saved ${values.length} responses for checklist ${checklistId}`);

    return res.json({
      success: true,
      message: "Checklist responses saved",
      saved: values.length,
      dropped: dropped.length,
    });

  } catch (err) {
    console.error("SAVE CHECKLIST RESPONSES ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save responses",
    });
  }
};

export const getChecklistAttachments = async (req, res) => {

  try {

    const { checklistId } = req.params;

    const result = await db
      .select()
      .from(attachments)
      .where(eq(attachments.checklistId, checklistId));

    res.json({
      success: true,
      attachments: result
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Failed to fetch attachments"
    });
  }
};
export const uploadChecklistAttachments = async (req, res) => {
  try {
    console.log("📥 Upload checklist attachments");

    const { fileId, checklistId } = req.params;

    if (!checklistId) {
      return res.status(400).json({
        success: false,
        message: "checklistId is required"
      });
    }

    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: "fileId is required"
      });
    }

    // ✅ Verify checklist exists and fileId matches
    const checklistResult = await db
      .select()
      .from(checklists)
      .where(eq(checklists.id, checklistId))
      .limit(1);

    if (!checklistResult.length) {
      return res.status(404).json({
        success: false,
        message: "Checklist not found"
      });
    }

    const trustedFileId = checklistResult[0].fileId;

    if (trustedFileId !== fileId) {
      console.error(`❌ fileId mismatch: param=${fileId}, db=${trustedFileId}`);
      return res.status(400).json({
        success: false,
        message: "fileId mismatch: param does not match checklist record"
      });
    }

    const userId = req.user.id;
    const supabase = getSupabase();
    const allAttachments = [];

    const uploadToSupabase = async (file) => {
      const filePath = `checklists/${checklistId}/${Date.now()}-${file.originalname}`;

      console.log("⬆ Uploading to Supabase:", filePath);

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file.buffer);

      if (error) {
        console.error("❌ Supabase upload error:", error);
        throw error;
      }

      console.log("✅ Uploaded:", filePath);
      return filePath;
    };

    const processFiles = async (filesArr, category, slotPrefix) => {
      if (!filesArr || filesArr.length === 0) return;

      console.log(`📂 Processing [${category}/${slotPrefix}] — ${filesArr.length} file(s)`);

      for (let i = 0; i < filesArr.length; i++) {
        const file = filesArr[i];
        const storagePath = await uploadToSupabase(file);

        allAttachments.push({
          fileId: trustedFileId,   // ✅ always use the DB-verified fileId
          checklistId,
          category,
          slot: `${slotPrefix}_${i + 1}`,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileType: getFileType(file.mimetype),
          storagePath,
          storageBackend: "s3",
          uploadedBy: userId,
        });
      }
    };

    await processFiles(req.files?.firstPage, "page", "FIRST");
    await processFiles(req.files?.lastPage, "page", "LAST");
    await processFiles(req.files?.intermediatePages, "page", "INTERMEDIATE");
    await processFiles(req.files?.documents, "document", "DOC");

    console.log("📦 Total attachments prepared:", allAttachments.length);

    if (allAttachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded"
      });
    }

    await db.insert(attachments).values(allAttachments);
    console.log("✅ Attachments inserted in DB");

    return res.status(200).json({
      success: true,
      message: "Attachments uploaded successfully",
      count: allAttachments.length
    });

  } catch (err) {
    console.error("🔥 ATTACHMENT UPLOAD ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.message
    });
  }
};