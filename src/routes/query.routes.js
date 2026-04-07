import express from "express";
import { getQueriesByFile, raiseQuery } from "../controllers/query.controller.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THESE ROUTES:
// Uncomment the `protect` middleware on each route below.
// Then switch the controller to read userId from req.user.id (see controller).
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/",
  protect,   // <-- uncomment this line to enable JWT auth
  getQueriesByFile
);

router.post(
  "/",
  protect,   // <-- uncomment this line to enable JWT auth
  raiseQuery
);

export default router;