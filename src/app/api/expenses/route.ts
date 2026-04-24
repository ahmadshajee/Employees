import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Expense, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const expenses = await Expense.find({ userId: toObjectId(userId) }).sort({ createdAt: -1 }).lean();
  return NextResponse.json(expenses);
}

export async function POST(request: NextRequest) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  const body = await request.json();
  await connectToDatabase();

  const expense = await Expense.create({
    userId: toObjectId(userId),
    date: body.date,
    expenseType: body.expenseType,
    amountInr: Number(body.amountInr || 0),
    paymentMethod: body.paymentMethod || "",
    description: body.description || "",
  });

  return NextResponse.json(expense, { status: 201 });
}



