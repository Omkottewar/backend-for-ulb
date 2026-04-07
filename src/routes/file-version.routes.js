import express from "express";
import { getFileVersions } from "../controllers/file-version.controller.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THIS ROUTE:
// Uncomment the `protect` middleware on the line below.
// No other change needed anywhere.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/",
  protect,   // <-- uncomment this line to enable JWT auth
  getFileVersions
);

export default router;