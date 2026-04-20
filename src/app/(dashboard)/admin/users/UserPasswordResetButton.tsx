"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { resetUserPasswordAction } from "@/server/usecases/users/actions";

interface Props {
  userId: string;
}

interface UserPasswordResetDialogProps extends Props {
  onClose: () => void;
}

const INITIAL_STATE = null;

const INPUT_CLASS = [
  "w-full h-9 px-3 text-sm",
  "border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]",
  "bg-white text-[var(--color-text)]",
  "outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
  "disabled:opacity-60 disabled:cursor-not-allowed",
].join(" ");

const LABEL_CLASS = "block text-sm font-medium text-[var(--color-text-sub)] mb-1";

export function UserPasswordResetButton({ userId }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        PW再設定
      </Button>
    );
  }

  return <UserPasswordResetDialog userId={userId} onClose={() => setOpen(false)} />;
}

function UserPasswordResetDialog({
  userId,
  onClose,
}: UserPasswordResetDialogProps) {
  const [state, formAction, isPending] = useActionState(
    resetUserPasswordAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (state?.success) {
      onClose();
    }
  }, [onClose, state?.success]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="パスワード再設定"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] shadow-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            パスワードを再設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors leading-none text-lg"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <form action={formAction} className="px-5 py-4 space-y-4">
          <input type="hidden" name="userId" value={userId} />

          <div>
            <label htmlFor={`password-${userId}`} className={LABEL_CLASS}>
              新しいパスワード <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id={`password-${userId}`}
              name="password"
              type="password"
              minLength={8}
              required
              disabled={isPending}
              className={INPUT_CLASS}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor={`password-confirm-${userId}`} className={LABEL_CLASS}>
              新しいパスワード（確認） <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id={`password-confirm-${userId}`}
              name="passwordConfirm"
              type="password"
              minLength={8}
              required
              disabled={isPending}
              className={INPUT_CLASS}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              8文字以上で設定し、本人へ別経路で伝えてください。
            </p>
          </div>

          {state?.error && (
            <p className="text-sm text-[var(--color-error)]">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isPending}
              disabled={isPending}
            >
              再設定する
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
