import express from "express";
import { getUserFiles } from "../controllers/user-file.controller.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// TO PROTECT THIS ROUTE:
// Uncomment the `protect` middleware on the line below.
// Then switch the controller to read userId from req.user.id (see controller).
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/",
  protect,   // <-- uncomment this line to enable JWT auth
  getUserFiles
);

export default router;