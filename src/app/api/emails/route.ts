import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { EmailLog, Lead, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const emails = await EmailLog.find({ userId: toObjectId(userId) }).sort({ sentAt: -1 }).lean();
  return NextResponse.json(emails);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  const body = await request.json();
  await connectToDatabase();

  const email = await EmailLog.create({
    userId: toObjectId(userId),
    to: body.to,
    cc: body.cc || "",
    subject: body.subject,
    body: body.body,
    status: "Sent",
  });

  if (typeof body.leadId === "string" && body.leadId) {
    const subject = body.subject ? String(body.subject).trim() : "Email sent";
    await Lead.findOneAndUpdate(
      { _id: toObjectId(body.leadId), userId: toObjectId(userId) },
      {
        $push: {
          logs: {
            type: "email",
            note: `Email sent — ${subject}`,
            createdAt: new Date(),
          },
        },
      },
    );
  }

  return NextResponse.json(email, { status: 201 });
}



