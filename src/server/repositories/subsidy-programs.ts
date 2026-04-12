/**
 * 助成金種別マスタ リポジトリ
 */

import { createClient } from "@/lib/supabase/server";

export interface SubsidyProgramRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
}

export async function listSubsidyPrograms(activeOnly = true): Promise<SubsidyProgramRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("subsidy_programs")
    .select("id, code, name, description, active, sort_order")
    .order("sort_order", { ascending: true });

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    active: row.active,
    sortOrder: row.sort_order,
  }));
}

export async function getSubsidyProgram(id: string): Promise<SubsidyProgramRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subsidy_programs")
    .select("id, code, name, description, active, sort_order")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description,
    active: data.active,
    sortOrder: data.sort_order,
  };
}
