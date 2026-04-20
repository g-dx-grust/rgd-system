import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { getUnreadCount } from "@/server/repositories/notifications";

export async function GET() {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await getUnreadCount(user.id);
  return NextResponse.json({ count });
}
