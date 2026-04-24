import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";

type AuthSuccess = {
  userId: string;
};

type AuthFailure = {
  response: NextResponse;
};

export async function requireUserId() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as AuthFailure;
  }

  return { userId } as AuthSuccess;
}
