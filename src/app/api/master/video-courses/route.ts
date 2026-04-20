import { NextRequest, NextResponse } from "next/server";
import { listVideoCourses, listVideoCoursesBySubsidy } from "@/server/repositories/video-courses";
import { getCurrentUserProfile } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json([], { status: 401 });

  const subsidyProgramId = req.nextUrl.searchParams.get("subsidyProgramId");

  try {
    const courses = subsidyProgramId
      ? await listVideoCoursesBySubsidy(subsidyProgramId)
      : await listVideoCourses();
    return NextResponse.json(courses);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
