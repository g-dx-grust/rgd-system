import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingSupabaseRelationError } from "@/lib/supabase/errors";

export interface OperatingCompanyOption {
  id: string;
  code: string;
  name: string;
  shortCode: string;
}

const DEFAULT_OPERATING_COMPANIES = [
  {
    code: "GRUST",
    name: "株式会社グラスト",
    short_code: "GRA",
    sort_order: 10,
    is_active: true,
  },
  {
    code: "AIM",
    name: "株式会社エイム",
    short_code: "AIM",
    sort_order: 20,
    is_active: true,
  },
] as const;

export async function ensureDefaultOperatingCompanies(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("operating_companies")
    .upsert(DEFAULT_OPERATING_COMPANIES, { onConflict: "code" });

  if (error && !isMissingSupabaseRelationError(error, ["operating_companies"])) {
    throw new Error(error.message);
  }
}

export async function listOperatingCompanies(): Promise<OperatingCompanyOption[]> {
  const supabase = await createClient();

  const defaultOptions = DEFAULT_OPERATING_COMPANIES.map((row) => ({
    id: row.code,
    code: row.code,
    name: row.name,
    shortCode: row.short_code,
  }));

  const fetchRows = async () => {
    return supabase
      .from("operating_companies")
      .select("id, code, name, short_code")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
  };

  let { data, error } = await fetchRows();

  if (error) {
    if (isMissingSupabaseRelationError(error, ["operating_companies"])) {
      return defaultOptions;
    }
    throw new Error(error.message);
  }

  if ((data ?? []).length === 0) {
    try {
      await ensureDefaultOperatingCompanies();
      const retryResult = await fetchRows();
      data = retryResult.data;
      error = retryResult.error;
    } catch (seedError) {
      console.error("[operating_companies] default seed failed:", seedError);
    }
  }

  if (error) {
    if (isMissingSupabaseRelationError(error, ["operating_companies"])) {
      return defaultOptions;
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    shortCode: String(row.short_code),
  }));

  return rows.length > 0 ? rows : defaultOptions;
}
