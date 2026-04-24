import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DailyReport, Deal, User } from "@/lib/models";

export async function GET() {
  await connectToDatabase();

  const users = await User.find({}).select("name email").lean();

  const leaderboard = await Promise.all(
    users.map(async (u) => {
      const [dealCount, reports] = await Promise.all([
        Deal.countDocuments({ userId: u._id }),
        DailyReport.find({ userId: u._id }).select("coldCalls followupsDone").lean(),
      ]);

      const calls = reports.reduce((sum, r) => sum + Number(r.coldCalls || 0), 0);
      const followups = reports.reduce((sum, r) => sum + Number(r.followupsDone || 0), 0);
      const score = dealCount * 100 + calls + followups;

      return {
        userId: String(u._id),
        name: u.name,
        deals: dealCount,
        calls,
        followups,
        score,
      };
    })
  );

  leaderboard.sort((a, b) => b.score - a.score);
  return NextResponse.json(leaderboard);
}
