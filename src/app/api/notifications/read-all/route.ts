/**
 * 全通知一括既読 API
 *
 * POST /api/notifications/read-all
 */

import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { markAllNotificationsRead } from "@/server/repositories/notifications";

export async function POST() {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await markAllNotificationsRead(user.id);
  return NextResponse.json({ success: true });
}
