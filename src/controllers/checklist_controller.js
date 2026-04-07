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

      // Document checklist
      if (section.type === "document_checklist") {
        section.items?.forEach(item => {
          if (item.checkField?.fieldId) {
            const saved = responseMap[item.checkField.fieldId];
            item.checkField.value = saved?.value ?? null;
          }
        });
      }

      // Line items table: keys are stored as `${rowId}_amount` and `${rowId}_remark`
      if (section.type === "line_items_table") {
        section.rows?.forEach(row => {
          const amount = responseMap[`${row.rowId}_amount`];
          const remark = responseMap[`${row.rowId}_remark`];
          row.savedAmount = amount?.value ?? null;
          row.savedRemark = remark?.value ?? null;
        });
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

    const values = responses
      .filter(r => questionMap[r.questionId])
      .map(r => ({
        checklistId,
        questionId: questionMap[r.questionId],
        responseValue: r.responseValue ?? null,
        remark: r.remark ?? null,
        respondedAt: new Date(),
        respondedBy: userId
      }));

    await db
      .insert(checklistResponses)
      .values(values)
      .onConflictDoUpdate({
        target: [
          checklistResponses.checklistId,
          checklistResponses.questionId
        ],
        set: {
          responseValue: sql`excluded.response_value`,
          remark: sql`excluded.remark`,
          respondedAt: new Date(),
          respondedBy: userId
        }
      });

    res.json({
      success: true,
      message: "Checklist responses saved"
    });

  } catch (err) {
    console.error("SAVE CHECKLIST RESPONSES ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to save responses"
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

    const userId = req.user.id;
    const supabase = getSupabase();
    const allAttachments = [];

    const uploadToSupabase = async (file) => {

      const filePath = `checklists/${checklistId}/${Date.now()}-${file.originalname}`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file.buffer);

      if (error) throw error;

      return filePath;
    };

    const processFiles = async (filesArr, category, slotPrefix) => {

      if (!filesArr) return;

      for (let i = 0; i < filesArr.length; i++) {

        const file = filesArr[i];

        const storagePath = await uploadToSupabase(file);

        allAttachments.push({
          fileId,
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

    if (allAttachments.length > 0) {
      await db.insert(attachments).values(allAttachments);
    }

    res.json({
      success: true,
      message: "Attachments uploaded successfully"
    });

  } catch (err) {

    console.error("🔥 ATTACHMENT UPLOAD ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.message
    });

  }
};