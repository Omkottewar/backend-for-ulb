import express from "express";
import { getUlbs } from "../controllers/ulb_controller.js";
import { protect } from "../middlewares/auth_middleware.js";

const router = express.Router();

router.get("/", protect, getUlbs);  // 👈 protect added

export default router;