"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { activateUserAction, deactivateUserAction } from "@/server/usecases/users/actions";

interface Props {
  userId: string;
  isActive: boolean;
}

export function UserStatusButton({ userId, isActive }: Props) {
  const action = isActive ? deactivateUserAction : activateUserAction;
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        loading={isPending}
        disabled={isPending}
      >
        {isActive ? "停止" : "有効化"}
      </Button>
      {state?.error && (
        <span className="text-xs text-[var(--color-error)]">{state.error}</span>
      )}
    </form>
  );
}
