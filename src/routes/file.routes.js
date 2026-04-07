import express from "express";
import { getFile, updateFile } from "../controllers/file.controller.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router();

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

export default router;