import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) redirect("/login");

  return <DashboardClient userName={session.user.name || "User"} />;
}
