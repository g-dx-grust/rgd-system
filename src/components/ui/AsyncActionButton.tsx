"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "./Button";

interface ActionResult {
  error?: string;
  success?: boolean;
}

interface AsyncActionButtonProps {
  label: string;
  confirmMessage: string;
  action: () => Promise<ActionResult | void>;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md";
  className?: string;
  wrapperClassName?: string;
  disabled?: boolean;
  refreshOnSuccess?: boolean;
  onSuccess?: () => void;
  align?: "start" | "end";
}

export function AsyncActionButton({
  label,
  confirmMessage,
  action,
  pendingLabel,
  variant = "danger",
  size = "sm",
  className = "",
  wrapperClassName = "",
  disabled = false,
  refreshOnSuccess = true,
  onSuccess,
  align = "start",
}: AsyncActionButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setError(null);

    startTransition(async () => {
      try {
        const result = await action();
        if (result?.error) {
          setError(result.error);
          return;
        }

        onSuccess?.();
        if (refreshOnSuccess) {
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "処理に失敗しました。");
      }
    });
  }

  return (
    <div
      className={[
        "flex flex-col gap-1",
        align === "end" ? "items-end" : "items-start",
        wrapperClassName,
      ].join(" ")}
    >
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={isPending}
        disabled={disabled || isPending}
        className={className}
        onClick={handleClick}
      >
        {isPending ? pendingLabel ?? `${label}中...` : label}
      </Button>
      {error && (
        <p className="text-xs text-[var(--color-error)]">{error}</p>
      )}
    </div>
  );
}
