import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Lead, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const leads = await Lead.find({ userId: toObjectId(userId) }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(leads);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  const body = await request.json();
  await connectToDatabase();

  const lead = await Lead.create({
    userId: toObjectId(userId),
    name: body.name || "",
    position: body.position || "",
    company: body.company || "",
    location: body.location || "",
    email: body.email || "",
    platform: body.platform || "Direct",
    status: body.status || "Contacted",
    logs: body.logs || [],
  });

  return NextResponse.json(lead, { status: 201 });
}



