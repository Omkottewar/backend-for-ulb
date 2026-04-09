import { db } from "../db/index.js";
import { files } from "../db/schema/files.js";
import { attachments } from "../db/schema/attachments.js";
import { getSupabase } from "../config/supabase.js";
import { getFileType } from "../utils/files_utils.js";
import { checklists } from "../db/schema/checklist.js";
import { eq } from "drizzle-orm";

export const createFile = async (req, res) => {
  try {
    console.log("📥 Incoming createFile request body:");
    console.log(JSON.stringify(req.body, null, 2));
    const {
      fileNumber,
      fileTitle,
      ulbId,
      supplierId,
      contractTypeId,
      officerName,
      templateId,
      workDescription,
      amount,
      riskFlag,
    } = req.body;

    const userId = req.user.id;

    const numericAmount = Number(amount || 0);

    if (Number.isNaN(numericAmount)) {
      console.error("❌ Amount is not a valid number:", amount);
      return res.status(400).json({
        success: false,
        message: "Invalid amount value"
      });
    }

    console.log("💰 Parsed numeric amount:", numericAmount);

    const result = await db.transaction(async (trx) => {

      console.log("🚀 Starting DB transaction");

      const [newFile] = await trx
        .insert(files)
        .values({
          fileNumber,
          fileTitle,
          ulbId,
          supplierId,
          contractTypeId,
          officerName,
          workDescription,
          amount: numericAmount,
          riskFlag,
          createdBy: userId,
        })
        .returning();

      console.log("✅ File inserted:", newFile);

      const fileId = newFile.id;

      const templateId = req.body.templateId ;
      if(!templateId) {
        console.error("❌ templateId is required to create checklist");
        throw new Error("templateId is required");
      }

      console.log("📋 Creating checklist with template:", templateId);

      const [newChecklist] = await trx
        .insert(checklists)
        .values({
          fileId,
          templateId,
          phaseNumber: 1,
          createdBy: userId,
        })
        .returning();

      console.log("✅ Checklist inserted:", newChecklist);

      return {
        fileId,
        checklistId: newChecklist.id,
      };
    });

    console.log("🎉 Transaction successful:", result);

    res.json({
      success: true,
      message: "File created successfully",
      fileId: result.fileId,
      checklistId: result.checklistId,
    });

  } catch (err) {

    console.error("🔥 CREATE FILE ERROR:");
    console.error(err);
    console.error("Stack:", err.stack);

    res.status(500).json({
      success: false,
      message: "Failed to create file",
      error: err.message
    });

  }
};

export const uploadFileAttachments = async (req, res) => {
  try {

    console.log("📥 Upload attachments request");
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("Files:", Object.keys(req.files || {}));

    const { fileId } = req.params;
    const { checklistId } = req.body;

    if (!checklistId) {
      console.error("❌ checklistId missing");
      return res.status(400).json({
        message: "checklistId is required"
      });
    }

    const userId = req.user.id;

    const allAttachments = [];

    const uploadToSupabase = async (file) => {

      console.log("⬆ Uploading file:", file.originalname);

      const filePath = `files/${fileId}/${Date.now()}-${file.originalname}`;

      const { error } = await getSupabase.storage
        .from("file-uploads")
        .upload(filePath, file.buffer);

      if (error) {
        console.error("❌ Supabase upload error:", error);
        throw error;
      }

      console.log("✅ Uploaded to:", filePath);

      return filePath;
    };

    const processFiles = async (filesArr, category, slotPrefix) => {

      if (!filesArr) return;

      console.log(`📂 Processing ${category} files`, filesArr.length);

      for (let i = 0; i < filesArr.length; i++) {

        const file = filesArr[i];

        console.log("Processing file:", file.originalname);

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

    console.log("📦 Total attachments prepared:", allAttachments.length);

    if (allAttachments.length > 0) {
      await db.insert(attachments).values(allAttachments);
      console.log("✅ Attachments inserted in DB");
    }

    res.json({
      success: true,
      message: "Attachments uploaded successfully",
    });

  } catch (err) {

    console.error("🔥 ATTACHMENT UPLOAD ERROR:");
    console.error(err);
    console.error("Stack:", err.stack);

    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: err.message
    });
  }
};

export const getFiles = async (req, res) => {
  try {

    console.log("📥 Fetching files");

    const data = await db
      .select()
      .from(files);

    console.log("✅ Files fetched:", data.length);

    res.json({
      success: true,
      files: data
    });

  } catch (err) {

    console.error("🔥 GET FILES ERROR");
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch files"
    });

  }
};

export const updateFileSupplier = async (req, res) => {
  try {

    const { fileId } = req.params;
    const { supplierId } = req.body;

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "supplierId is required"
      });
    }

    const [updatedFile] = await db
      .update(files)
      .set({
        supplierId,
        updatedAt: new Date(),
        updatedBy: req.user.id
      })
      .where(eq(files.id, fileId))
      .returning();

    if (!updatedFile) {
      return res.status(404).json({
        success: false,
        message: "File not found"
      });
    }

    res.json({
      success: true,
      message: "Supplier linked to file",
      file: updatedFile
    });

  } catch (err) {

    console.error("UPDATE FILE SUPPLIER ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to update supplier"
    });

  }
};
