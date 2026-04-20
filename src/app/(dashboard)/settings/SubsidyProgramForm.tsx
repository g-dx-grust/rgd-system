"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createSubsidyProgramAction } from "@/server/usecases/subsidy-programs/actions";

const INPUT_CLASS = [
  "w-full h-9 px-3 text-sm",
  "border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]",
  "bg-white text-[var(--color-text)]",
  "placeholder:text-[var(--color-text-muted)]",
  "outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
].join(" ");

const TEXTAREA_CLASS = [
  "w-full px-3 py-2 text-sm",
  "border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]",
  "bg-white text-[var(--color-text)]",
  "placeholder:text-[var(--color-text-muted)]",
  "outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
  "resize-none",
].join(" ");

const LABEL_CLASS = "block text-sm font-medium text-[var(--color-text-sub)] mb-1";

interface SubsidyProgramDialogProps {
  onClose: () => void;
}

export function SubsidyProgramForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        助成金種別を追加
      </Button>
    );
  }

  return <SubsidyProgramDialog onClose={() => setOpen(false)} />;
}

function SubsidyProgramDialog({ onClose }: SubsidyProgramDialogProps) {
  const [state, formAction, isPending] = useActionState(
    createSubsidyProgramAction,
    null
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
      aria-label="助成金種別追加"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-4 w-full max-w-md rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white shadow-md">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            助成金種別を追加
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <form action={formAction} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="subsidy-name" className={LABEL_CLASS}>
              助成金名 <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="subsidy-name"
              name="name"
              type="text"
              required
              disabled={isPending}
              placeholder="例: 人材開発支援助成金"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="subsidy-abbreviation" className={LABEL_CLASS}>
              略称
            </label>
            <input
              id="subsidy-abbreviation"
              name="abbreviation"
              type="text"
              disabled={isPending}
              placeholder="例: 人材開発（一般）"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="subsidy-code" className={LABEL_CLASS}>
              内部コード
            </label>
            <input
              id="subsidy-code"
              name="code"
              type="text"
              disabled={isPending}
              placeholder="未入力なら自動採番"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              任意です。未入力の場合はシステムで一意なコードを自動作成します。
            </p>
          </div>

          <div>
            <label htmlFor="subsidy-order" className={LABEL_CLASS}>
              表示順序
            </label>
            <input
              id="subsidy-order"
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={0}
              disabled={isPending}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="subsidy-description" className={LABEL_CLASS}>
              説明
            </label>
            <textarea
              id="subsidy-description"
              name="description"
              rows={3}
              disabled={isPending}
              placeholder="任意の補足説明"
              className={TEXTAREA_CLASS}
            />
          </div>

          {state?.error ? (
            <p className="text-sm text-[var(--color-error)]">{state.error}</p>
          ) : null}

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
              追加する
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
