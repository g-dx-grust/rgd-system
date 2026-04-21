"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/constants/case-status";
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "@/server/usecases/tasks/actions";
import { FormActionButton } from "@/components/ui/FormActionButton";

interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done" | "skipped";
  priority: "low" | "medium" | "high" | "critical";
  assigneeUserId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
}

interface UserOption {
  id: string;
  displayName: string;
}

interface Props {
  caseId: string;
  tasks: TaskItem[];
  canManageTasks: boolean;
}

const TASK_STATUS_OPTIONS = [
  { value: "open", label: TASK_STATUS_LABELS.open },
  { value: "in_progress", label: TASK_STATUS_LABELS.in_progress },
  { value: "done", label: TASK_STATUS_LABELS.done },
  { value: "skipped", label: TASK_STATUS_LABELS.skipped },
] as const;

const TASK_PRIORITY_OPTIONS = [
  { value: "low", label: TASK_PRIORITY_LABELS.low },
  { value: "medium", label: TASK_PRIORITY_LABELS.medium },
  { value: "high", label: TASK_PRIORITY_LABELS.high },
  { value: "critical", label: TASK_PRIORITY_LABELS.critical },
] as const;

export function TaskPanelClient({ caseId, tasks, canManageTasks }: Props) {
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (!canManageTasks) return;

    fetch("/api/master/users")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("users_fetch_failed"))
      )
      .then((data: UserOption[]) => setUsers(data ?? []))
      .catch(() => setUsers([]));
  }, [canManageTasks]);

  const openTasks = tasks.filter(
    (task) => task.status === "open" || task.status === "in_progress"
  );
  const closedTasks = tasks.filter(
    (task) => task.status === "done" || task.status === "skipped"
  );

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
        タスクがありません。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {openTasks.length === 0 ? (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
          未完了のタスクはありません。
        </div>
      ) : (
        <ul className="space-y-3 px-4 py-4">
          {openTasks.map((task) => (
            <li
              key={task.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4"
            >
              <TaskCard
                caseId={caseId}
                task={task}
                canManageTasks={canManageTasks}
                users={users}
              />
            </li>
          ))}
        </ul>
      )}

      {closedTasks.length > 0 && (
        <details className="border-t border-[var(--color-border)] px-4 py-4">
          <summary className="cursor-pointer text-sm font-medium text-[var(--color-text)]">
            完了済み・スキップ済みタスクを表示 ({closedTasks.length}件)
          </summary>
          <ul className="mt-3 space-y-3">
            {closedTasks.map((task) => (
              <li
                key={task.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
              >
                <TaskCard
                  caseId={caseId}
                  task={task}
                  canManageTasks={canManageTasks}
                  users={users}
                />
              </li>
            ))}
          </ul>
        </details>
      )}

      {canManageTasks && (
        <div className="border-t border-[var(--color-border)] px-4 py-4">
          <ManualTaskForm caseId={caseId} users={users} />
        </div>
      )}
    </div>
  );
}

function TaskCard({
  caseId,
  task,
  canManageTasks,
  users,
}: {
  caseId: string;
  task: TaskItem;
  canManageTasks: boolean;
  users: UserOption[];
}) {
  const priorityClass =
    task.priority === "critical"
      ? "text-[var(--color-error)]"
      : task.priority === "high"
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-text-muted)]";

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-[var(--color-text)]">
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {task.description}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right text-xs text-[var(--color-text-muted)]">
          <p className={["font-medium", priorityClass].join(" ")}>
            {TASK_PRIORITY_LABELS[task.priority]}
          </p>
          <p>{TASK_STATUS_LABELS[task.status]}</p>
        </div>
      </div>

      {canManageTasks ? (
        <TaskUpdateForm caseId={caseId} task={task} users={users} />
      ) : (
        <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)]">
          <span>担当: {task.assigneeName ?? "未割当"}</span>
          <span>期限: {task.dueDate ?? "未設定"}</span>
        </div>
      )}
    </div>
  );
}

function TaskUpdateForm({
  caseId,
  task,
  users,
}: {
  caseId: string;
  task: TaskItem;
  users: UserOption[];
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(updateTaskAction, null);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [router, state?.success]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="taskId" value={task.id} />

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-sub)]">
            状態
          </label>
          <select
            name="status"
            defaultValue={task.status}
            className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {TASK_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-sub)]">
            担当
          </label>
          <select
            name="assigneeUserId"
            defaultValue={task.assigneeUserId ?? ""}
            className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="">未割当</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-sub)]">
            期限
          </label>
          <input
            type="date"
            name="dueDate"
            defaultValue={task.dueDate ?? ""}
            className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[var(--color-text-muted)]">
          {state?.error ? (
            <span className="text-[var(--color-error)]">{state.error}</span>
          ) : (
            <>
              <span>担当: {task.assigneeName ?? "未割当"}</span>
              <span className="ml-3">期限: {task.dueDate ?? "未設定"}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FormActionButton
            action={deleteTaskAction}
            fields={{ caseId, taskId: task.id }}
            label="削除"
            pendingLabel="削除中..."
            confirmMessage={`タスク「${task.title}」を削除しますか？`}
            refreshOnSuccess={false}
            onSuccess={() => router.refresh()}
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {isPending ? "保存中..." : "更新する"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ManualTaskForm({
  caseId,
  users,
}: {
  caseId: string;
  users: UserOption[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, isPending] = useActionState(createTaskAction, null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state?.success]);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">
        手動でタスクを追加
      </h3>

      <form ref={formRef} action={action} className="space-y-3">
        <input type="hidden" name="caseId" value={caseId} />

        {state?.error && (
          <p className="text-xs text-[var(--color-error)]">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-xs text-[#16A34A]">タスクを追加しました。</p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-sub)]">
              タスク名
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder="例: 受講者登録の不足分を確認する"
              className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-sub)]">
              補足
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="何を確認・対応するかをメモできます"
              className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-sub)]">
              優先度
            </label>
            <select
              name="priority"
              defaultValue="medium"
              className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              {TASK_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-sub)]">
              担当
            </label>
            <select
              name="assigneeUserId"
              defaultValue=""
              className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="">未割当</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-sub)]">
              期限
            </label>
            <input
              type="date"
              name="dueDate"
              className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {isPending ? "追加中..." : "タスクを追加"}
          </button>
        </div>
      </form>
    </section>
  );
}
