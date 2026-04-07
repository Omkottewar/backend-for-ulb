import express from "express";
import { downloadAttachment } from "../controllers/attachment-download.controller.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THIS ROUTE:
// Uncomment the `protect` middleware on the line below.
// This endpoint is read-only and does not require userId.
// When auth is enabled, the protect middleware ensures only
// authenticated users can generate download URLs.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/:attachmentId/download",
  protect,   // <-- uncomment this line to enable JWT auth
  downloadAttachment
);

export default router;