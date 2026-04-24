import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Deal, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const deals = await Deal.find({ userId: toObjectId(userId) }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(deals);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  const body = await request.json();
  await connectToDatabase();

  const deal = await Deal.create({
    userId: toObjectId(userId),
    clientCompany: body.clientCompany || "",
    contactPerson: body.contactPerson || "",
    services: Array.isArray(body.services) ? body.services : [],
    pricingPerCheck: Number(body.pricingPerCheck || 0),
    monthlyVolume: Number(body.monthlyVolume || 0),
    contractDuration: body.contractDuration || "",
    totalValueInr: Number(body.totalValueInr || 0),
    paymentTerms: body.paymentTerms || "",
    specialTerms: body.specialTerms || "",
    onboardingDate: body.onboardingDate || "",
  });

  return NextResponse.json(deal, { status: 201 });
}



