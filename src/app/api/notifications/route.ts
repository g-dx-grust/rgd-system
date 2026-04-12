/**
 * 通知一覧 API
 *
 * GET /api/notifications?unreadOnly=true&page=1
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { listNotifications } from "@/server/repositories/notifications";

export async function GET(req: NextRequest) {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp         = req.nextUrl.searchParams;
  const unreadOnly = sp.get("unreadOnly") === "true";
  const page       = Number(sp.get("page") ?? 1);

  const result = await listNotifications({
    userId: user.id,
    unreadOnly,
    page,
    perPage: 30,
  });

  return NextResponse.json(result);
}
