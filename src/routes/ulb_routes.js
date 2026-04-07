import express from "express";
import { getUlbs } from "../controllers/ulb_controller.js";

const router = express.Router();

router.get("/", getUlbs);

export default router;