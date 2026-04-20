/**
 * 動画コース リポジトリ
 */

import { createClient } from "@/lib/supabase/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/errors";

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

export interface VideoCourseRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  displayTemplate: string | null;
}

export interface VideoCourseAdminRow {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  displayTemplate: string | null;
  isActive: boolean;
  displayOrder: number;
  subsidyProgramId: string | null;
  subsidyProgramName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVideoCourseInput {
  name: string;
  description?: string | null;
  code?: string | null;
  displayTemplate?: string | null;
  subsidyProgramId: string | null;
  displayOrder?: number;
}

export interface UpdateVideoCourseInput {
  name?: string;
  description?: string | null;
  code?: string | null;
  displayTemplate?: string | null;
  subsidyProgramId?: string | null;
  displayOrder?: number;
}

// ---------------------------------------------------------------
// 案件フォーム用（アクティブのみ）
// ---------------------------------------------------------------

export async function listVideoCourses(): Promise<VideoCourseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_courses")
    .select("id, name, description, is_active, display_order, display_template")
    .eq("is_active", true)
    .order("display_order")
    .order("name");
  if (error) {
    if (isMissingSupabaseRelationError(error, ["video_courses"])) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    isActive: Boolean(r.is_active),
    displayOrder: Number(r.display_order),
    displayTemplate: r.display_template != null ? String(r.display_template) : null,
  }));
}

export async function listVideoCoursesBySubsidy(
  subsidyProgramId: string
): Promise<VideoCourseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_courses")
    .select("id, name, description, is_active, display_order, display_template")
    .eq("is_active", true)
    .eq("subsidy_program_id", subsidyProgramId)
    .order("display_order")
    .order("name");
  if (error) {
    if (isMissingSupabaseRelationError(error, ["video_courses"])) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    isActive: Boolean(r.is_active),
    displayOrder: Number(r.display_order),
    displayTemplate: r.display_template != null ? String(r.display_template) : null,
  }));
}

export async function getVideoCourse(id: string): Promise<{
  name: string;
  displayTemplate: string | null;
  subsidyProgramId: string | null;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_courses")
    .select("name, display_template, subsidy_program_id")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return {
    name: String(data.name),
    displayTemplate: data.display_template != null ? String(data.display_template) : null,
    subsidyProgramId: data.subsidy_program_id != null ? String(data.subsidy_program_id) : null,
  };
}

// ---------------------------------------------------------------
// 管理者向け CRUD
// ---------------------------------------------------------------

export async function listVideoCoursesAdmin(): Promise<VideoCourseAdminRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_courses")
    .select(
      `
      id, name, description, code, display_template, is_active, display_order,
      subsidy_program_id, created_at, updated_at,
      subsidy_programs ( name )
      `
    )
    .order("display_order")
    .order("name");
  if (error) {
    if (isMissingSupabaseRelationError(error, ["video_courses"])) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const sp = r.subsidy_programs as { name?: string } | null;
    return {
      id: String(r.id),
      name: String(r.name),
      description: r.description != null ? String(r.description) : null,
      code: r.code != null ? String(r.code) : null,
      displayTemplate: r.display_template != null ? String(r.display_template) : null,
      isActive: Boolean(r.is_active),
      displayOrder: Number(r.display_order),
      subsidyProgramId: r.subsidy_program_id ? String(r.subsidy_program_id) : null,
      subsidyProgramName: sp?.name ?? null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  });
}

export async function getVideoCourseAdmin(
  id: string
): Promise<VideoCourseAdminRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_courses")
    .select(
      `
      id, name, description, code, display_template, is_active, display_order,
      subsidy_program_id, created_at, updated_at,
      subsidy_programs ( name )
      `
    )
    .eq("id", id)
    .single();
  if (error || !data) return null;
  const sp = data.subsidy_programs as { name?: string } | null;
  return {
    id: String(data.id),
    name: String(data.name),
    description: data.description != null ? String(data.description) : null,
    code: data.code != null ? String(data.code) : null,
    displayTemplate: data.display_template != null ? String(data.display_template) : null,
    isActive: Boolean(data.is_active),
    displayOrder: Number(data.display_order),
    subsidyProgramId: data.subsidy_program_id ? String(data.subsidy_program_id) : null,
    subsidyProgramName: sp?.name ?? null,
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

export async function createVideoCourse(
  input: CreateVideoCourseInput
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_courses")
    .insert({
      name: input.name,
      description: input.description ?? null,
      code: input.code ?? null,
      display_template: input.displayTemplate ?? null,
      subsidy_program_id: input.subsidyProgramId ?? null,
      display_order: input.displayOrder ?? 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function updateVideoCourse(
  id: string,
  input: UpdateVideoCourseInput
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.code !== undefined) patch.code = input.code;
  if (input.displayTemplate !== undefined) patch.display_template = input.displayTemplate;
  if (input.subsidyProgramId !== undefined)
    patch.subsidy_program_id = input.subsidyProgramId;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;

  const { error } = await supabase
    .from("video_courses")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deactivateVideoCourse(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("video_courses")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function activateVideoCourse(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("video_courses")
    .update({ is_active: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 案件×コース 中間テーブル
// ---------------------------------------------------------------

export async function getCaseVideoCourseIds(caseId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("case_video_courses")
    .select("video_course_id")
    .eq("case_id", caseId);
  if (error) {
    if (isMissingSupabaseRelationError(error, ["case_video_courses"]))
      return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => String(r.video_course_id));
}

export async function syncCaseVideoCourses(
  caseId: string,
  courseIds: string[],
  assignedBy: string
): Promise<void> {
  const supabase = await createClient();

  const { error: delError } = await supabase
    .from("case_video_courses")
    .delete()
    .eq("case_id", caseId);
  if (delError) {
    if (isMissingSupabaseRelationError(delError, ["case_video_courses"]))
      return;
    throw new Error(delError.message);
  }

  if (courseIds.length === 0) return;

  const rows = courseIds.map((id) => ({
    case_id: caseId,
    video_course_id: id,
    assigned_by: assignedBy,
  }));

  const { error: insError } = await supabase
    .from("case_video_courses")
    .insert(rows);
  if (insError) {
    if (isMissingSupabaseRelationError(insError, ["case_video_courses"]))
      return;
    throw new Error(insError.message);
  }
}
