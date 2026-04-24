import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Attendance, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const rows = await Attendance.find({ userId: toObjectId(userId) }).sort({ date: -1 }).lean();
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  const body = await request.json();
  await connectToDatabase();

  const record = await Attendance.create({
    userId: toObjectId(userId),
    date: body.date,
    status: body.status,
    loginTime: body.loginTime || "",
    logoutTime: body.logoutTime || "",
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
  });

  return NextResponse.json(record, { status: 201 });
}



