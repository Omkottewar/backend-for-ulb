// ulb_controller
import { db } from "../db/index.js";
import { ulbs } from "../db/schema/ulbs.js";
import { ulbTeamAssignments } from "../db/schema/ulb_team_assignments.js";
import { teamMembers } from "../db/schema/team_members.js";

import { eq, and, isNull } from "drizzle-orm";

export const getUlbs = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await db
      .selectDistinct({
        id: ulbs.id,
        name: ulbs.name
      })
      .from(teamMembers)
      .innerJoin(ulbTeamAssignments, eq(teamMembers.teamId, ulbTeamAssignments.teamId))
      .innerJoin(ulbs, eq(ulbTeamAssignments.ulbId, ulbs.id))
      .where(
        and(
          eq(teamMembers.userId, userId),       // 👈 only this user's teams
          isNull(teamMembers.removedAt),         // user is still active in team
          isNull(ulbTeamAssignments.removedAt),  // team is still assigned to ULB
          eq(ulbs.isActive, true),
          eq(ulbs.isDeleted, false)
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