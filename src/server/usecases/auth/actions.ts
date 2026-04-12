"use server";

/**
 * 認証 Server Actions
 *
 * ログイン / ログアウト / パスワードリセット を Server Action として実装。
 * フォームから直接呼び出す。
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/server/repositories/audit-log";
import { getAuthUser } from "@/lib/auth/session";

// ---------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// ---------------------------------------------------------------
// ログイン
// ---------------------------------------------------------------

export async function loginAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    // ログイン失敗を監査ログに記録
    await writeAuditLog({
      userId: null,
      action: "login_failed",
      metadata: { email: email.trim(), reason: error.message },
    });
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  // ログイン成功を監査ログに記録
  await writeAuditLog({
    userId: data.user.id,
    action: "login",
    metadata: { email: data.user.email },
  });

  redirect("/dashboard");
}

// ---------------------------------------------------------------
// ログアウト
// ---------------------------------------------------------------

export async function logoutAction(): Promise<void> {
  const user = await getAuthUser();
  const supabase = await createClient();

  if (user) {
    await writeAuditLog({
      userId: user.id,
      action: "logout",
    });
  }

  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------
// パスワードリセット要求（メール送信）
// ---------------------------------------------------------------

export async function requestPasswordResetAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get("email");

  if (typeof email !== "string" || !email.trim()) {
    return { error: "メールアドレスを入力してください。" };
  }

  const supabase = await createClient();

  // redirectTo は環境変数から取得（直書き禁止）
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${siteUrl}/reset-password/confirm`,
  });

  if (error) {
    console.error("[password_reset] error:", error.message);
    // セキュリティ上、エラー有無に関わらず同じメッセージを返す
  }

  await writeAuditLog({
    userId: null,
    action: "password_reset_request",
    metadata: { email: email.trim() },
  });

  return {
    success: true,
  };
}

// ---------------------------------------------------------------
// パスワードリセット確定（新パスワード設定）
// ---------------------------------------------------------------

export async function confirmPasswordResetAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const password = formData.get("password");
  const passwordConfirm = formData.get("passwordConfirm");

  if (typeof password !== "string" || password.length < 8) {
    return { error: "パスワードは8文字以上で入力してください。" };
  }
  if (password !== passwordConfirm) {
    return { error: "パスワードが一致しません。" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。" };
  }

  if (data.user) {
    await writeAuditLog({
      userId: data.user.id,
      action: "password_reset_complete",
    });
  }

  redirect("/login?reset=done");
}
