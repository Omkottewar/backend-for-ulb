import express from "express";
import { protect } from "../middlewares/auth_middleware.js";

import {
  createChecklist,
  getChecklistsByFile,
  updateChecklist,
  getChecklistDetails,
  getChecklistAttachments,
  uploadChecklistAttachments,
  saveChecklistResponses
} from "../controllers/checklist_controller.js";

import { upload } from "../middlewares/upload_middleware.js";

const router = express.Router();

/* CHECKLIST */

/* Create checklist for file */
router.post("/file/:fileId", protect, createChecklist);

/* Get checklists for file */
router.get("/file/:fileId", protect, getChecklistsByFile);

/* Update checklist */
router.patch("/:checklistId", protect, updateChecklist);


/* CHECKLIST DETAILS */

router.get("/:checklistId/details", protect, getChecklistDetails);

router.post(
  "/:checklistId/responses",
  protect,
  saveChecklistResponses
);
/* ATTACHMENTS */

router.get("/:checklistId/attachments", protect, getChecklistAttachments);
router.post("/:checklistId/attachments", protect, uploadChecklistAttachments);



export default router;