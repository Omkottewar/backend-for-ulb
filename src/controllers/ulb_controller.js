import { db } from "../db/index.js";
import { ulbs } from "../db/schema/ulbs.js";

import { eq, and } from "drizzle-orm";

export const getUlbs = async (req, res) => {
  try {

    const result = await db
      .select()
      .from(ulbs)
      .where(
        and(
          eq(ulbs.isDeleted, false),
          eq(ulbs.isActive, true)
        )
      );

    res.json({
      success: true,
      ulbs: result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch ULBs" });
  }
};