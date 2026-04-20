"use client";

import { useActionState, useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { createCourseAction, updateCourseAction } from "@/server/usecases/courses/actions";
import type { VideoCourseAdminRow } from "@/server/repositories/video-courses";
import type { SubsidyProgramRow } from "@/server/repositories/subsidy-programs";

interface CourseFormDialogProps {
  course?: VideoCourseAdminRow;
  subsidyPrograms: SubsidyProgramRow[];
  onClose: () => void;
}

const INITIAL_STATE = null;

const INPUT_CLASS = [
  "w-full h-9 px-3 text-sm",
  "border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]",
  "bg-white text-[var(--color-text)]",
  "placeholder:text-[var(--color-text-muted)]",
  "outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
  "disabled:opacity-60 disabled:cursor-not-allowed",
].join(" ");

const LABEL_CLASS = "block text-sm font-medium text-[var(--color-text-sub)] mb-1";

export function CourseFormDialog({
  course,
  subsidyPrograms,
  onClose,
}: CourseFormDialogProps) {
  const isEdit = !!course;
  const action = isEdit ? updateCourseAction : createCourseAction;

  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (state?.success) {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "コース編集" : "コース新規作成"}
    >
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ダイアログ本体 */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] shadow-md">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {isEdit ? "コース編集" : "コース新規作成"}
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

        {/* フォーム */}
        <form action={formAction} className="px-5 py-4 space-y-4">
          {isEdit && (
            <input type="hidden" name="id" value={course.id} />
          )}

          {/* コース名 */}
          <div>
            <label htmlFor="course-name" className={LABEL_CLASS}>
              コース名
              <span className="ml-1 text-[var(--color-error)]">*</span>
            </label>
            <input
              id="course-name"
              name="name"
              type="text"
              required
              defaultValue={course?.name ?? ""}
              disabled={isPending}
              placeholder="例: DXリテラシー向上コース"
              className={INPUT_CLASS}
            />
          </div>

          {/* 助成金種別 */}
          <div>
            <label htmlFor="course-subsidy" className={LABEL_CLASS}>
              助成金種別
              <span className="ml-1 text-[var(--color-text-muted)]">任意</span>
            </label>
            <select
              id="course-subsidy"
              name="subsidyProgramId"
              defaultValue={course?.subsidyProgramId ?? ""}
              disabled={isPending}
              className={INPUT_CLASS}
            >
              <option value="">未設定のまま保存</option>
              {subsidyPrograms.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              まだ助成金を決めていないコースは、未設定のまま先に登録できます。
            </p>
          </div>

          {/* 略称 */}
          <div>
            <label htmlFor="course-code" className={LABEL_CLASS}>
              略称（コース番号）
            </label>
            <input
              id="course-code"
              name="code"
              type="text"
              defaultValue={course?.code ?? ""}
              disabled={isPending}
              placeholder="例: DX-101"
              className={INPUT_CLASS}
            />
          </div>

          {/* 案件名テンプレート */}
          <div>
            <label htmlFor="course-template" className={LABEL_CLASS}>
              案件名テンプレート
            </label>
            <input
              id="course-template"
              name="displayTemplate"
              type="text"
              defaultValue={course?.displayTemplate ?? ""}
              disabled={isPending}
              placeholder="例: {abbreviation} / {course}"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              変数: <code>{"{abbreviation}"}</code>（助成金略称）・<code>{"{program}"}</code>（正式名）・<code>{"{course}"}</code>（コース名）。
              空白の場合は <code>{"{abbreviation} / {course}"}</code> を使用します。
            </p>
          </div>

          {/* 表示順 */}
          <div>
            <label htmlFor="course-order" className={LABEL_CLASS}>
              表示順序
            </label>
            <input
              id="course-order"
              name="displayOrder"
              type="number"
              min="0"
              defaultValue={course?.displayOrder ?? 0}
              disabled={isPending}
              className={INPUT_CLASS}
            />
          </div>

          {/* 説明 */}
          <div>
            <label htmlFor="course-desc" className={LABEL_CLASS}>
              説明
            </label>
            <textarea
              id="course-desc"
              name="description"
              rows={3}
              defaultValue={course?.description ?? ""}
              disabled={isPending}
              placeholder="任意の補足説明"
              className={[
                "w-full px-3 py-2 text-sm",
                "border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]",
                "bg-white text-[var(--color-text)]",
                "placeholder:text-[var(--color-text-muted)]",
                "outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "resize-none",
              ].join(" ")}
            />
          </div>

          {/* エラー */}
          {state?.error && (
            <p className="text-sm text-[var(--color-error)]">{state.error}</p>
          )}

          {/* ボタン */}
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
              {isEdit ? "更新" : "作成"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// CourseFormTrigger — 新規作成 / 編集ボタンと Dialog の組み合わせ
// ---------------------------------------------------------------

interface CourseFormTriggerProps {
  course?: VideoCourseAdminRow;
  subsidyPrograms: SubsidyProgramRow[];
}

export function CourseFormTrigger({
  course,
  subsidyPrograms,
}: CourseFormTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={course ? "secondary" : "primary"}
        size={course ? "sm" : "md"}
        onClick={() => setOpen(true)}
      >
        {course ? "編集" : "コースを追加"}
      </Button>

      {open && (
        <CourseFormDialog
          course={course}
          subsidyPrograms={subsidyPrograms}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
