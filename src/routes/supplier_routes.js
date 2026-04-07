import express from "express";
import { protect } from "../middlewares/auth_middleware.js";
import { createSupplier } from "../controllers/supplier_controller.js";

const router = express.Router();

router.post("/", protect, createSupplier);

export default router;