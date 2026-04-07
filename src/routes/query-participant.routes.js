import express from "express";
import { getParticipants } from "../controllers/query-participant.controller.js";
import { addParticipant } from "../controllers/add-query-participant.controller.js";
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
  protect,   // <-- uncomment this line to enable JWT auth
  getParticipants
);

router.post(
  "/",
  protect,   // <-- uncomment this line to enable JWT auth
  addParticipant
);

export default router;