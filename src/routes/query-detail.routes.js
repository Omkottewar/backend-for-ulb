import express from "express";
import { getQueryDetails } from "../controllers/query-detail.controller.js";
import { markQueryResolved } from "../controllers/resolve-query.controller.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THESE ROUTES:
// Uncomment the `protect` middleware on each route below.
// For GET:   read-only, no userId needed.
// For PATCH: switch controller to read userId from req.user.id (see controller).
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/:queryId",
  protect,   // <-- uncomment this line to enable JWT auth
  getQueryDetails
);

router.patch(
  "/:queryId/resolve",
  protect,   // <-- uncomment this line to enable JWT auth
  markQueryResolved
);

export default router;