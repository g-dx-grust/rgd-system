"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { confirmPasswordResetAction } from "@/server/usecases/auth/actions";

const INITIAL_STATE = null;

export default function ResetPasswordConfirmPage() {
  const [state, formAction, isPending] = useActionState(
    confirmPasswordResetAction,
    INITIAL_STATE
  );

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-[360px]">
        <h1 className="text-[22px] font-semibold text-[var(--color-text)] mb-2">
          RGDシステム
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">
          新しいパスワードを設定してください。
        </p>

        <form action={formAction} className="space-y-4" noValidate>
          <Input
            type="password"
            name="password"
            label="新しいパスワード"
            placeholder="••••••••"
            autoComplete="new-password"
            hint="8文字以上で入力してください"
            required
            disabled={isPending}
          />
          <Input
            type="password"
            name="passwordConfirm"
            label="新しいパスワード（確認）"
            placeholder="••••••••"
            autoComplete="new-password"
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
            パスワードを更新する
          </Button>
        </form>
      </div>
    </div>
  );
}
