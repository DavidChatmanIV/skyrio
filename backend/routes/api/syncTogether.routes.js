router.post("/:id/plan", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const group = await SyncGroup.findById(req.params.id);
    if (!group)
      return res.status(404).json({ ok: false, error: "Group not found" });
    if (!isGroupMember(group, userId)) {
      return res
        .status(403)
        .json({ ok: false, error: "Only group members can update the plan" });
    }

    const { plan, atlasMessages } = req.body;

    group.plan = plan;
    group.planGeneratedAt = new Date();
    group.planVersion = (group.planVersion || 0) + 1;
    if (atlasMessages) group.atlasMessages = atlasMessages;
    group.status = "reviewing";

    // Reset all approvals when plan changes
    group.members.forEach((m) => {
      m.approved = false;
      m.approvedAt = null;
    });

    logActivity(
      group,
      group.planVersion <= 1 ? "plan_generated" : "plan_updated",
      userId,
      `Plan v${group.planVersion} generated`
    );

    await group.save();

    // Notify all other members the plan is ready (non-blocking)
    try {
      const planner = await User.findById(userId)
        .select("name username")
        .lean();
      const plannerName = planner?.name || planner?.username || "Someone";
      const groupUrl = `${
        process.env.FRONTEND_ORIGIN || "https://skyrio-iota.vercel.app"
      }/sync-together/${group._id}`;

      for (const m of group.members) {
        // Skip notifying the person who just generated the plan
        if (m.user && String(m.user) === String(userId)) continue;

        let email = m.email;
        if (!email && m.user) {
          const u = await User.findById(m.user).select("email").lean();
          email = u?.email;
        }
        if (email) {
          sendPlanReady({
            to: email,
            tripTitle: group.title,
            destination: group.destination,
            plannerName,
            groupUrl,
          }).catch((err) => console.error("[email] plan-ready error:", err));
        }
      }
    } catch (emailErr) {
      console.error(
        "[email] Failed to send plan-ready notifications:",
        emailErr.message
      );
    }

    const populated = await SyncGroup.findById(group._id)
      .populate("owner", "username name avatar")
      .populate("members.user", "username name avatar")
      .populate("changeRequests.user", "username name avatar")
      .lean();

    return res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("[sync-together] plan error:", err);
    return res.status(500).json({ ok: false, error: "Failed to save plan" });
  }
});
