/**
 * Supabase の optional テーブル未適用時エラーを判定するヘルパー群。
 */

interface SupabaseErrorLike {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}

const MISSING_RELATION_ERROR_CODES = new Set(["PGRST205", "42P01"]);
const MISSING_COLUMN_ERROR_CODES = new Set(["PGRST204", "42703"]);

export function isMissingSupabaseRelationError(
  error: unknown,
  tableNames: string[] = []
): boolean {
  if (!error || typeof error !== "object") return false;

  const supabaseError = error as SupabaseErrorLike;
  const code = typeof supabaseError.code === "string" ? supabaseError.code : "";
  const message = [
    supabaseError.message,
    supabaseError.details,
    supabaseError.hint,
  ]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0
    )
    .join(" ")
    .toLowerCase();

  const matchesTable =
    tableNames.length === 0 ||
    tableNames.some((tableName) => message.includes(tableName.toLowerCase()));

  if (!matchesTable) return false;
  if (MISSING_RELATION_ERROR_CODES.has(code)) return true;

  return (
    (message.includes("could not find the table") &&
      message.includes("schema cache")) ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export function isMissingSupabaseColumnError(
  error: unknown,
  columnNames: string[] = []
): boolean {
  if (!error || typeof error !== "object") return false;

  const supabaseError = error as SupabaseErrorLike;
  const code = typeof supabaseError.code === "string" ? supabaseError.code : "";
  const message = [
    supabaseError.message,
    supabaseError.details,
    supabaseError.hint,
  ]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0
    )
    .join(" ")
    .toLowerCase();

  const matchesColumn =
    columnNames.length === 0 ||
    columnNames.some((columnName) =>
      message.includes(columnName.toLowerCase())
    );

  if (!matchesColumn) return false;
  if (MISSING_COLUMN_ERROR_CODES.has(code)) return true;

  return (
    message.includes("column") &&
    message.includes("schema cache") &&
    (message.includes("does not exist") || message.includes("could not find"))
  );
}

export function isMissingStorageBucketError(
  error: unknown,
  bucketNames: string[] = []
): boolean {
  if (!error || typeof error !== "object") return false;

  const supabaseError = error as SupabaseErrorLike;
  const message = [
    supabaseError.message,
    supabaseError.details,
    supabaseError.hint,
  ]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0
    )
    .join(" ")
    .toLowerCase();

  const matchesBucket =
    bucketNames.length === 0 ||
    bucketNames.some((bucketName) =>
      message.includes(bucketName.toLowerCase())
    );

  if (!matchesBucket) return false;

  return message.includes("bucket") && message.includes("not found");
}

export function getOptionalFeatureUnavailableMessage(
  featureName: string
): string {
  return `${featureName}機能はまだデータベースに反映されていません。Supabase の migration 適用後に利用できます。`;
}
