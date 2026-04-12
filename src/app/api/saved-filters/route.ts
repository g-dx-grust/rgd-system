/**
 * 保存フィルタ API
 *
 * GET  /api/saved-filters?scope=cases  — 一覧取得
 * POST /api/saved-filters              — 新規作成
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/auth/session";
import {
  listSavedFilters,
  createSavedFilter,
} from "@/server/repositories/saved-filters";

interface CreateBody {
  name?: unknown;
  scope?: unknown;
  filterParams?: unknown;
  isDefault?: unknown;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = req.nextUrl.searchParams.get("scope") ?? "cases";
  const filters = await listSavedFilters(user.id, scope);
  return NextResponse.json({ filters });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const scope = typeof body.scope === "string" ? body.scope.trim() : "";
  const filterParams =
    body.filterParams !== null &&
    typeof body.filterParams === "object" &&
    !Array.isArray(body.filterParams)
      ? (body.filterParams as Record<string, unknown>)
      : null;

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "name is required (max 60 chars)" }, { status: 422 });
  }
  if (!scope || scope.length > 40) {
    return NextResponse.json({ error: "scope is required (max 40 chars)" }, { status: 422 });
  }
  if (!filterParams) {
    return NextResponse.json({ error: "filterParams must be an object" }, { status: 422 });
  }

  const created = await createSavedFilter({
    userId:       user.id,
    name,
    scope,
    filterParams,
    isDefault:    body.isDefault === true,
  });

  if (!created) {
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }

  return NextResponse.json({ filter: created }, { status: 201 });
}
