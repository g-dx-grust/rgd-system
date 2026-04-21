/**
 * 動画コース リポジトリ
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOptionalFeatureUnavailableMessage,
  isMissingSupabaseColumnError,
  isMissingSupabaseRelationError,
} from "@/lib/supabase/errors";

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

type VideoCourseRecord = Record<string, unknown>;

const VIDEO_COURSE_ADMIN_SELECT_FIELDS = [
  "id",
  "name",
  "description",
  "code",
  "display_template",
  "is_active",
  "display_order",
  "subsidy_program_id",
  "created_at",
  "updated_at",
  "subsidy_programs ( name )",
].join(", ");

const VIDEO_COURSE_ADMIN_SELECT_FIELDS_LEGACY = [
  "id",
  "name",
  "description",
  "is_active",
  "display_order",
  "created_at",
  "updated_at",
].join(", ");

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";

  const details = error as {
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  };

  return [details.message, details.details, details.hint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function isLegacyVideoCourseSchemaError(error: unknown): boolean {
  if (
    isMissingSupabaseColumnError(error, [
      "code",
      "display_template",
      "subsidy_program_id",
    ])
  ) {
    return true;
  }

  const message = getErrorMessage(error);
  return (
    message.includes("subsidy_programs") &&
    (message.includes("relationship") || message.includes("schema cache"))
  );
}

function mapVideoCourseAdmin(row: VideoCourseRecord): VideoCourseAdminRow {
  const subsidyProgramRelation = row["subsidy_programs"];
  const subsidyProgram =
    Array.isArray(subsidyProgramRelation)
      ? subsidyProgramRelation[0]
      : subsidyProgramRelation;
  const subsidyProgramRecord =
    subsidyProgram && typeof subsidyProgram === "object"
      ? (subsidyProgram as VideoCourseRecord)
      : null;

  return {
    id: String(row["id"]),
    name: String(row["name"]),
    description: row["description"] != null ? String(row["description"]) : null,
    code: row["code"] != null ? String(row["code"]) : null,
    displayTemplate:
      row["display_template"] != null ? String(row["display_template"]) : null,
    isActive: Boolean(row["is_active"]),
    displayOrder: Number(row["display_order"]),
    subsidyProgramId:
      row["subsidy_program_id"] != null ? String(row["subsidy_program_id"]) : null,
    subsidyProgramName:
      subsidyProgramRecord?.["name"] != null ? String(subsidyProgramRecord["name"]) : null,
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}

function buildVideoCourseWritePayload(input: {
  name?: string;
  description?: string | null;
  code?: string | null;
  displayTemplate?: string | null;
  subsidyProgramId?: string | null;
  displayOrder?: number;
}) {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.code !== undefined) payload.code = input.code;
  if (input.displayTemplate !== undefined) payload.display_template = input.displayTemplate;
  if (input.subsidyProgramId !== undefined) {
    payload.subsidy_program_id = input.subsidyProgramId;
  }
  if (input.displayOrder !== undefined) payload.display_order = input.displayOrder;

  return payload;
}

function buildLegacyVideoCourseWritePayload(input: {
  name?: string;
  description?: string | null;
  displayOrder?: number;
}) {
  return buildVideoCourseWritePayload({
    name: input.name,
    description: input.description,
    displayOrder: input.displayOrder,
  });
}

export async function isVideoCoursesFeatureAvailable(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("video_courses").select("id").limit(1);

  if (!error) return true;
  if (isMissingSupabaseRelationError(error, ["video_courses"])) return false;

  throw new Error(error.message);
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
  let { data, error } = await supabase
    .from("video_courses")
    .select(VIDEO_COURSE_ADMIN_SELECT_FIELDS)
    .order("display_order")
    .order("name");

  if (error && isLegacyVideoCourseSchemaError(error)) {
    const fallbackResult = await supabase
      .from("video_courses")
      .select(VIDEO_COURSE_ADMIN_SELECT_FIELDS_LEGACY)
      .order("display_order")
      .order("name");
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    if (isMissingSupabaseRelationError(error, ["video_courses"])) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as VideoCourseRecord[]).map(mapVideoCourseAdmin);
}

export async function getVideoCourseAdmin(
  id: string
): Promise<VideoCourseAdminRow | null> {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("video_courses")
    .select(VIDEO_COURSE_ADMIN_SELECT_FIELDS)
    .eq("id", id)
    .single();

  if (error && isLegacyVideoCourseSchemaError(error)) {
    const fallbackResult = await supabase
      .from("video_courses")
      .select(VIDEO_COURSE_ADMIN_SELECT_FIELDS_LEGACY)
      .eq("id", id)
      .single();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error || !data) return null;

  return mapVideoCourseAdmin(data as unknown as VideoCourseRecord);
}

export async function createVideoCourse(
  input: CreateVideoCourseInput
): Promise<string> {
  // Server Action 側で権限チェック済みのため、
  // 旧DBで INSERT/UPDATE 用RLSが不足している環境でも保存できるよう service role を使う。
  const supabase = createAdminClient();
  let { data, error } = await supabase
    .from("video_courses")
    .insert(
      buildVideoCourseWritePayload({
        name: input.name,
        description: input.description ?? null,
        code: input.code ?? null,
        displayTemplate: input.displayTemplate ?? null,
        subsidyProgramId: input.subsidyProgramId ?? null,
        displayOrder: input.displayOrder ?? 0,
      })
    )
    .select("id")
    .single();

  if (error && isLegacyVideoCourseSchemaError(error)) {
    const fallbackResult = await supabase
      .from("video_courses")
      .insert(
        buildLegacyVideoCourseWritePayload({
          name: input.name,
          description: input.description ?? null,
          displayOrder: input.displayOrder ?? 0,
        })
      )
      .select("id")
      .single();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error && isMissingSupabaseRelationError(error, ["video_courses"])) {
    throw new Error(getOptionalFeatureUnavailableMessage("コースマスタ"));
  }

  if (error || !data) throw new Error(error?.message ?? "コースの作成に失敗しました。");
  return String(data.id);
}

export async function updateVideoCourse(
  id: string,
  input: UpdateVideoCourseInput
): Promise<void> {
  const supabase = createAdminClient();
  const patch = buildVideoCourseWritePayload(input);

  let { error } = await supabase
    .from("video_courses")
    .update(patch)
    .eq("id", id);

  if (error && isLegacyVideoCourseSchemaError(error)) {
    const fallbackPatch = buildLegacyVideoCourseWritePayload({
      name: input.name,
      description: input.description,
      displayOrder: input.displayOrder,
    });

    const fallbackResult = await supabase
      .from("video_courses")
      .update(fallbackPatch)
      .eq("id", id);
    error = fallbackResult.error;
  }

  if (error && isMissingSupabaseRelationError(error, ["video_courses"])) {
    throw new Error(getOptionalFeatureUnavailableMessage("コースマスタ"));
  }

  if (error) throw new Error(error.message);
}

export async function deactivateVideoCourse(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("video_courses")
    .update({ is_active: false })
    .eq("id", id);
  if (error && isMissingSupabaseRelationError(error, ["video_courses"])) {
    throw new Error(getOptionalFeatureUnavailableMessage("コースマスタ"));
  }
  if (error) throw new Error(error.message);
}

export async function activateVideoCourse(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("video_courses")
    .update({ is_active: true })
    .eq("id", id);
  if (error && isMissingSupabaseRelationError(error, ["video_courses"])) {
    throw new Error(getOptionalFeatureUnavailableMessage("コースマスタ"));
  }
  if (error) throw new Error(error.message);
}

export async function deleteVideoCourse(id: string): Promise<void> {
  const supabase = createAdminClient();

  const { count: caseCount, error: caseError } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("video_course_id", id);

  if (caseError) throw new Error(caseError.message);
  if ((caseCount ?? 0) > 0) {
    throw new Error("案件で使用中のコースは削除できません。");
  }

  const { count: linkedCount, error: linkedError } = await supabase
    .from("case_video_courses")
    .select("case_id", { count: "exact", head: true })
    .eq("video_course_id", id);

  if (
    linkedError &&
    !isMissingSupabaseRelationError(linkedError, ["case_video_courses"])
  ) {
    throw new Error(linkedError.message);
  }
  if ((linkedCount ?? 0) > 0) {
    throw new Error("案件履歴に紐付くコースは削除できません。");
  }

  const { error } = await supabase
    .from("video_courses")
    .delete()
    .eq("id", id);

  if (error && isMissingSupabaseRelationError(error, ["video_courses"])) {
    throw new Error(getOptionalFeatureUnavailableMessage("コースマスタ"));
  }
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
