"use client";

import { useTransition } from "react";
import { specialistLogoutAction } from "@/server/usecases/specialist/actions";

export function SpecialistLogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => specialistLogoutAction())}
      disabled={isPending}
      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-50 transition-colors"
    >
      {isPending ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
