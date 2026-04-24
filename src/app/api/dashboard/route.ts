import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DailyReport, Deal, EmailLog, FollowUp, Lead, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const uid = toObjectId(userId);

  const [leadsCount, emailsCount, followupsCount, reports, dealsCount] = await Promise.all([
    Lead.countDocuments({ userId: uid }),
    EmailLog.countDocuments({ userId: uid }),
    FollowUp.countDocuments({ userId: uid }),
    DailyReport.find({ userId: uid }).sort({ date: -1 }).limit(1).lean(),
    Deal.countDocuments({ userId: uid }),
  ]);

  const latest = reports[0];

  return NextResponse.json({
    callsToday: latest?.coldCalls || 0,
    emailsSent: latest?.emailsSent || 0,
    demosToday: latest?.demosScheduled || 0,
    dealsClosed: latest?.dealsClosed || 0,
    formsSubmitted: leadsCount + dealsCount + followupsCount + (reports.length ? 1 : 0),
    totalLeads: leadsCount,
    totalEmails: emailsCount,
    totalFollowups: followupsCount,
  });
}



