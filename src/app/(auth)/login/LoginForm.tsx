"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { loginAction } from "@/server/usecases/auth/actions";

const INITIAL_STATE = null;

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    INITIAL_STATE
  );

  return (
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
      <Input
        type="password"
        name="password"
        label="パスワード"
        placeholder="••••••••"
        autoComplete="current-password"
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

      <div className="pt-1">
        <Button
          type="submit"
          variant="primary"
          className="w-full h-10"
          loading={isPending}
          disabled={isPending}
        >
          {isPending ? "ログイン中..." : "ログイン"}
        </Button>
      </div>

      <div className="text-center">
        <a
          href="/reset-password"
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          パスワードをお忘れですか？
        </a>
      </div>
    </form>
  );
}
