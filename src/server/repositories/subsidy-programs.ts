/**
 * 助成金種別マスタ リポジトリ
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingSupabaseColumnError } from "@/lib/supabase/errors";

export interface SubsidyProgramRow {
  id: string;
  code: string;
  name: string;
  abbreviation: string | null;
  description: string | null;
  active: boolean;
  sortOrder: number;
}

export interface CreateSubsidyProgramInput {
  code: string;
  name: string;
  abbreviation?: string | null;
  description?: string | null;
  sortOrder?: number;
}

type SubsidyProgramRecord = Record<string, unknown>;

const SUBSIDY_PROGRAM_SELECT_FIELDS = [
  "id",
  "code",
  "name",
  "abbreviation",
  "description",
  "active",
  "sort_order",
].join(", ");

const SUBSIDY_PROGRAM_SELECT_FIELDS_LEGACY = [
  "id",
  "code",
  "name",
  "description",
  "active",
  "sort_order",
].join(", ");

function mapSubsidyProgram(row: SubsidyProgramRecord): SubsidyProgramRow {
  return {
    id: String(row["id"]),
    code: String(row["code"]),
    name: String(row["name"]),
    abbreviation:
      typeof row["abbreviation"] === "string" ? row["abbreviation"] : null,
    description:
      row["description"] != null ? String(row["description"]) : null,
    active: Boolean(row["active"]),
    sortOrder: Number(row["sort_order"]),
  };
}

export async function listSubsidyPrograms(activeOnly = true): Promise<SubsidyProgramRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("subsidy_programs")
    .select(SUBSIDY_PROGRAM_SELECT_FIELDS)
    .order("sort_order", { ascending: true });

  if (activeOnly) {
    query = query.eq("active", true);
  }

  let { data, error } = await query;
  if (error && isMissingSupabaseColumnError(error, ["abbreviation"])) {
    let fallbackQuery = supabase
      .from("subsidy_programs")
      .select(SUBSIDY_PROGRAM_SELECT_FIELDS_LEGACY)
      .order("sort_order", { ascending: true });

    if (activeOnly) {
      fallbackQuery = fallbackQuery.eq("active", true);
    }

    const fallbackResult = await fallbackQuery;
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as unknown as SubsidyProgramRecord[]);
  return rows.map(mapSubsidyProgram);
}

export async function getSubsidyProgram(id: string): Promise<SubsidyProgramRow | null> {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("subsidy_programs")
    .select(SUBSIDY_PROGRAM_SELECT_FIELDS)
    .eq("id", id)
    .single();

  if (error && isMissingSupabaseColumnError(error, ["abbreviation"])) {
    const fallbackResult = await supabase
      .from("subsidy_programs")
      .select(SUBSIDY_PROGRAM_SELECT_FIELDS_LEGACY)
      .eq("id", id)
      .single();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error || !data) return null;
  return mapSubsidyProgram(data as unknown as SubsidyProgramRecord);
}

export async function createSubsidyProgram(
  input: CreateSubsidyProgramInput
): Promise<string> {
  // Server Action 側で権限チェック済みのため、
  // 旧DBで INSERT 用RLSが不足している環境でも登録できるよう service role を使う。
  const supabase = createAdminClient();

  let { data, error } = await supabase
    .from("subsidy_programs")
    .insert({
      code: input.code,
      name: input.name,
      abbreviation: input.abbreviation ?? null,
      description: input.description ?? null,
      sort_order: input.sortOrder ?? 0,
      active: true,
    })
    .select("id")
    .single();

  if (error && isMissingSupabaseColumnError(error, ["abbreviation"])) {
    const fallbackResult = await supabase
      .from("subsidy_programs")
      .insert({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        sort_order: input.sortOrder ?? 0,
        active: true,
      })
      .select("id")
      .single();
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error || !data) throw new Error(error?.message ?? "助成金種別の作成に失敗しました。");
  return String(data.id);
}
