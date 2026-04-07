import express from "express";
import { addQueryAttachments } from "../controllers/query-attachment.controller.js";
import { handleDocumentUpload } from "../middlewares/upload.middleware.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THIS ROUTE:
// Uncomment the `protect` middleware on the line below.
// Then switch the controller to read userId from req.user.id (see controller).
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/",
  protect,          // <-- uncomment this line to enable JWT auth
  handleDocumentUpload,  // multer: parses multipart/form-data, populates req.files
  addQueryAttachments
);

export default router;