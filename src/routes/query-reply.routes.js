import express from "express";
import { getReplies } from "../controllers/query-reply.controller.js";
import { addReply } from "../controllers/add-query-reply.controller.js";
import { handleDocumentUpload } from "../middlewares/upload.middleware.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THESE ROUTES:
// Uncomment the `protect` middleware on each route below.
// For GET:  read-only, no userId needed.
// For POST: switch controller to read userId from req.user.id (see controller).
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/",
  protect,            // <-- uncomment this line to enable JWT auth
  getReplies
);

router.post(
  "/",
  protect,            // <-- uncomment this line to enable JWT auth
  handleDocumentUpload,  // multer: parses multipart/form-data, populates req.files
  addReply
);

export default router;