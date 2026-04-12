"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPasswordResetAction } from "@/server/usecases/auth/actions";

const INITIAL_STATE = null;

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    INITIAL_STATE
  );

  if (state?.success) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-white px-6">
        <div className="w-full max-w-[360px] space-y-4">
          <h1 className="text-[22px] font-semibold text-[var(--color-text)]">
            RGDシステム
          </h1>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-4 text-sm text-[var(--color-text)]">
            <p className="font-medium mb-1">メールを送信しました</p>
            <p className="text-[var(--color-text-muted)]">
              入力したメールアドレスにパスワードリセット用のリンクを送信しました。メールをご確認ください。
            </p>
          </div>
          <a
            href="/login"
            className="block text-center text-xs text-[var(--color-accent)] hover:underline"
          >
            ログイン画面に戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-[360px]">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)] mb-2">
          RGDシステム
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">
          パスワードをリセットします。登録済みのメールアドレスを入力してください。
        </p>

        <form action={formAction} className="space-y-4" noValidate>
          <Input
            type="email"
            name="email"
            label="メールアドレス"
            placeholder="example@grast.co.jp"
            autoComplete="email"
            required
            disabled={isPending}
          />

          {state?.error && (
            <p
              className="text-xs text-[var(--color-error)] bg-red-50 border border-red-200 rounded-[var(--radius-sm)] px-3 py-2"
              role="alert"
            >
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full h-10"
            loading={isPending}
            disabled={isPending}
          >
            リセットメールを送信
          </Button>
        </form>

        <div className="mt-4 text-center">
          <a
            href="/login"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            ログイン画面に戻る
          </a>
        </div>
      </div>
    </div>
  );
}
