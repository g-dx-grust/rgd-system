import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  return NextResponse.json(
    (data ?? []).map((u) => ({ id: String(u.id), displayName: String(u.display_name) }))
  );
}
