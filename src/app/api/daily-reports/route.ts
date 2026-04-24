import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DailyReport, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const reports = await DailyReport.find({ userId: toObjectId(userId) }).sort({ date: -1 }).lean();
  return NextResponse.json(reports);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  const body = await request.json();
  await connectToDatabase();

  const report = await DailyReport.create({
    userId: toObjectId(userId),
    date: body.date,
    coldCalls: Number(body.coldCalls || 0),
    emailsSent: Number(body.emailsSent || 0),
    linkedInMessages: Number(body.linkedInMessages || 0),
    newLeads: Number(body.newLeads || 0),
    followupsDone: Number(body.followupsDone || 0),
    demosScheduled: Number(body.demosScheduled || 0),
    demosCompleted: Number(body.demosCompleted || 0),
    proposalsSent: Number(body.proposalsSent || 0),
    dealsClosed: Number(body.dealsClosed || 0),
    dealValueInr: Number(body.dealValueInr || 0),
    remarks: body.remarks || "",
  });

  return NextResponse.json(report, { status: 201 });
}



