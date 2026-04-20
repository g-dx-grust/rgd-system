"use client";

import { useActionState } from "react";
import { specialistLoginAction } from "@/server/usecases/specialist/actions";

const INITIAL_STATE = null;

export function SpecialistLoginForm() {
  const [state, formAction, isPending] = useActionState(
    specialistLoginAction,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[var(--color-text-sub)] mb-1"
        >
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={isPending}
          placeholder="example@example.com"
          className="w-full h-9 px-3 text-sm border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-[var(--color-text-sub)] mb-1"
        >
          パスワード
        </label>
        <input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          placeholder="••••••••"
          className="w-full h-9 px-3 text-sm border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed"
        />
      </div>

      {state?.error && (
        <p
          className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-[var(--radius-sm)] px-3 py-2"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-10 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium rounded-[var(--radius-sm)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </form>
  );
}
