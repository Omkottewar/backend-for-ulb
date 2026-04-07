import express from "express";
import { upload } from "../middlewares/upload_middleware.js";
import { protect } from "../middlewares/auth_middleware.js";
import { getFile, updateFile } from "../controllers/file.controller.js";
import { updateFileSupplier } from "../controllers/files_controller.js";

import {
  createFile,
  getFiles
} from "../controllers/files_controller.js";
import { createChecklist, getChecklistsByFile, uploadChecklistAttachments } from "../controllers/checklist_controller.js";

const router = express.Router();

// ---------------- Sahil ----------------

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THESE ROUTES:
// Uncomment the `protect` middleware on each route below.
// Then switch the controller to read userId from req.user.id (see controller).
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/:fileId",
  protect,   // <-- uncomment this line to enable JWT auth
  getFile
);

router.patch(
  "/:fileId",
  protect,   // <-- uncomment this line to enable JWT auth
  updateFile
);


// -------------------- OM ------------------
/* FILES */


router.patch("/:fileId/supplier", protect, updateFileSupplier);

/* Create File */
router.post("/", protect, createFile);

/* Get Files */
// router.get("/get-files", protect, getFiles); 
router.get("/:fileId/checklists", protect, getChecklistsByFile);

/* FILE ATTACHMENTS */
router.post("/:fileId/checklists", protect, createChecklist);
router.post(
  "/:fileId/checklists/:checklistId/attachments",
  protect,
  upload.fields([
    { name: "firstPage", maxCount: 1 },
    { name: "lastPage", maxCount: 3 },
    { name: "intermediatePages", maxCount: 10 },
    { name: "documents", maxCount: 10 },
  ]),
  uploadChecklistAttachments
);



export default router;