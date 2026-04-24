import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DailyReport, Deal, Expense, FollowUp, toObjectId } from "@/lib/models";
import { requireUserId } from "@/lib/api";

export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const userId = auth.userId;

  await connectToDatabase();
  const uid = toObjectId(userId);

  const [reports, deals, expenses, followups] = await Promise.all([
    DailyReport.find({ userId: uid }).select("date createdAt").lean(),
    Deal.find({ userId: uid }).select("clientCompany createdAt").lean(),
    Expense.find({ userId: uid }).select("expenseType createdAt").lean(),
    FollowUp.find({ userId: uid }).select("clientName createdAt").lean(),
  ]);

  const history = [
    ...reports.map((x) => ({ date: x.date, type: "Daily Activity Report", status: "Submitted", createdAt: x.createdAt })),
    ...deals.map((x) => ({ date: new Date(x.createdAt).toISOString().slice(0, 10), type: `Deal Closure - ${x.clientCompany}`, status: "Submitted", createdAt: x.createdAt })),
    ...expenses.map((x) => ({ date: new Date(x.createdAt).toISOString().slice(0, 10), type: `Expense - ${x.expenseType}`, status: "Submitted", createdAt: x.createdAt })),
    ...followups.map((x) => ({ date: new Date(x.createdAt).toISOString().slice(0, 10), type: `Follow-up - ${x.clientName}`, status: "Submitted", createdAt: x.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(history);
}



