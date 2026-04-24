import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { FollowUp, Lead, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const followups = await FollowUp.find({ userId: toObjectId(userId) }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(followups);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  const body = await request.json();
  await connectToDatabase();

  const followup = await FollowUp.create({
    userId: toObjectId(userId),
    date: body.date,
    clientName: body.clientName,
    contactPerson: body.contactPerson || "",
    mode: body.mode || "Phone Call",
    summary: body.summary || "",
    responseStatus: body.responseStatus || "No Response",
    nextAction: body.nextAction || "",
    nextFollowUpDate: body.nextFollowUpDate || "",
  });

  if (typeof body.leadId === "string" && body.leadId) {
    const summary = body.summary ? String(body.summary).trim() : "";
    const mode = body.mode ? String(body.mode).trim() : "Follow-up";
    const responseStatus = body.responseStatus ? String(body.responseStatus).trim() : "";
    const noteParts = [`${mode} logged`];
    if (summary) noteParts.push(summary);
    if (responseStatus) noteParts.push(`Status: ${responseStatus}`);

    await Lead.findOneAndUpdate(
      { _id: toObjectId(body.leadId), userId: toObjectId(userId) },
      {
        $push: {
          logs: {
            type: "followup",
            note: noteParts.join(" — "),
            createdAt: new Date(),
          },
        },
      },
    );
  }

  return NextResponse.json(followup, { status: 201 });
}



