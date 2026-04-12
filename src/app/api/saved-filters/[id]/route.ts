/**
 * 保存フィルタ個別操作 API
 *
 * DELETE /api/saved-filters/:id          — 削除
 * PATCH  /api/saved-filters/:id/default  — デフォルト設定（→ /api/saved-filters/:id?action=default）
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import {
  deleteSavedFilter,
  setDefaultSavedFilter,
  getSavedFilterById,
} from "@/server/repositories/saved-filters";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteSavedFilter(id, user.id);
  if (!ok) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  if (body.isDefault === true) {
    const filter = await getSavedFilterById(id);
    if (!filter || filter.userId !== user.id) {
      return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
    }
    await setDefaultSavedFilter(id, user.id, filter.scope);
  }

  return NextResponse.json({ success: true });
}
