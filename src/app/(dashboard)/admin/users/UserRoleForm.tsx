"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { changeUserRoleAction } from "@/server/usecases/users/actions";
import type { RoleCode } from "@/lib/rbac";
import type { RoleOption } from "@/server/repositories/users";

interface UserRoleFormProps {
  userId: string;
  currentRoleCode: RoleCode;
  roles: RoleOption[];
}

const INITIAL_STATE = null;

export function UserRoleForm({
  userId,
  currentRoleCode,
  roles,
}: UserRoleFormProps) {
  const [state, formAction, isPending] = useActionState(
    changeUserRoleAction,
    INITIAL_STATE
  );
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        ref={selectRef}
        name="roleCode"
        defaultValue={currentRoleCode}
        disabled={isPending}
        className={[
          "h-8 px-2 text-xs",
          "border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]",
          "bg-white text-[var(--color-text)]",
          "outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {roles.map((role) => (
          <option key={role.id} value={role.code}>
            {role.labelJa}
          </option>
        ))}
      </select>

      <Button
        type="submit"
        variant="secondary"
        size="sm"
        loading={isPending}
        disabled={isPending}
      >
        変更
      </Button>

      {state?.error && (
        <span className="text-xs text-[var(--color-error)]">{state.error}</span>
      )}
    </form>
  );
}
