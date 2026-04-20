"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  deactivateCourseAction,
  activateCourseAction,
} from "@/server/usecases/courses/actions";

interface CourseToggleButtonProps {
  courseId: string;
  isActive: boolean;
}

const INITIAL_STATE = null;

export function CourseToggleButton({
  courseId,
  isActive,
}: CourseToggleButtonProps) {
  const action = isActive ? deactivateCourseAction : activateCourseAction;
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={courseId} />
      <Button
        type="submit"
        variant={isActive ? "danger" : "secondary"}
        size="sm"
        loading={isPending}
        disabled={isPending}
      >
        {isActive ? "無効化" : "有効化"}
      </Button>
      {state?.error && (
        <span className="ml-2 text-xs text-[var(--color-error)]">
          {state.error}
        </span>
      )}
    </form>
  );
}
