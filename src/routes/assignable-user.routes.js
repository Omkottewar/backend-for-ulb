import express from "express";
import { getAssignableUserList } from "../controllers/assignable-user.controller.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THIS ROUTE:
// Uncomment the `protect` middleware on the line below.
// This endpoint is read-only and does not require userId.
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/",
  protect,   // <-- uncomment this line to enable JWT auth
  getAssignableUserList
);

export default router;