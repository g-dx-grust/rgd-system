"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { updateCaseAction } from "@/server/usecases/cases/actions";

interface SubsidyProgram {
  id: string;
  name: string;
}

interface User {
  id: string;
  displayName: string;
}

interface InitialValues {
  caseName: string;
  organizationId: string;
  organizationName: string;
  subsidyProgramId: string | null;
  contractDate: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  preApplicationDueDate: string | null;
  finalApplicationDueDate: string | null;
  ownerUserId: string | null;
  summary: string | null;
}

interface Props {
  caseId: string;
  initialValues: InitialValues;
}

export function CaseEditForm({ caseId, initialValues }: Props) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(updateCaseAction, null);
  const [programs, setPrograms] = useState<SubsidyProgram[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch("/api/master/subsidy-programs")
      .then((r) => r.json())
      .then((d: SubsidyProgram[]) => setPrograms(d ?? []))
      .catch(() => {});

    fetch("/api/master/users")
      .then((r) => r.json())
      .then((d: User[]) => setUsers(d ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (state?.success) {
      router.push(`/cases/${caseId}`);
    }
  }, [state, caseId, router]);

  return (
    <div className="max-w-2xl space-y-6">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/cases" className="hover:text-[var(--color-accent)]">案件管理</Link>
        <span>/</span>
        <Link href={`/cases/${caseId}`} className="hover:text-[var(--color-accent)]">
          {initialValues.caseName}
        </Link>
        <span>/</span>
        <span>編集</span>
      </div>

      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">案件編集</h1>

      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-[var(--radius-md)] text-sm text-[var(--color-error)]">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-5">
        <input type="hidden" name="caseId" value={caseId} />

        {/* 顧客企業（変更不可） */}
        <Field label="顧客企業">
          <input
            type="text"
            value={initialValues.organizationName}
            readOnly
            className="w-full h-9 px-3 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
          />
        </Field>

        {/* 案件名 */}
        <Field label="案件名" required>
          <input
            name="caseName"
            type="text"
            required
            defaultValue={initialValues.caseName}
            placeholder="例: ○○社 人材開発支援助成金 2026年度"
            {...inputClass()}
          />
        </Field>

        {/* 助成金種別 */}
        <Field label="助成金種別">
          <select
            name="subsidyProgramId"
            defaultValue={initialValues.subsidyProgramId ?? ""}
            {...selectClass()}
          >
            <option value="">選択してください</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>

        {/* 担当者 */}
        <Field label="主担当">
          <select
            name="ownerUserId"
            defaultValue={initialValues.ownerUserId ?? ""}
            {...selectClass()}
          >
            <option value="">未割当</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
        </Field>

        {/* 日付系 */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="契約日">
            <input
              name="contractDate"
              type="date"
              defaultValue={initialValues.contractDate ?? ""}
              {...inputClass()}
            />
          </Field>
          <Field label="受講開始予定日">
            <input
              name="plannedStartDate"
              type="date"
              defaultValue={initialValues.plannedStartDate ?? ""}
              {...inputClass()}
            />
          </Field>
          <Field label="受講終了予定日">
            <input
              name="plannedEndDate"
              type="date"
              defaultValue={initialValues.plannedEndDate ?? ""}
              {...inputClass()}
            />
          </Field>
          <Field label="初回申請期限">
            <input
              name="preApplicationDueDate"
              type="date"
              defaultValue={initialValues.preApplicationDueDate ?? ""}
              {...inputClass()}
            />
          </Field>
          <Field label="最終申請期限">
            <input
              name="finalApplicationDueDate"
              type="date"
              defaultValue={initialValues.finalApplicationDueDate ?? ""}
              {...inputClass()}
            />
          </Field>
        </div>

        {/* 概要 */}
        <Field label="概要メモ">
          <textarea
            name="summary"
            rows={3}
            defaultValue={initialValues.summary ?? ""}
            placeholder="案件の概要・特記事項など"
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary" loading={isPending}>
            保存する
          </Button>
          <Link
            href={`/cases/${caseId}`}
            className="text-sm text-[var(--color-text-sub)] hover:text-[var(--color-text)]"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[var(--color-text)]">
        {label}
        {required && <span className="ml-1 text-[var(--color-error)]">*</span>}
      </label>
      {children}
    </div>
  );
}

function inputClass() {
  return {
    className: [
      "w-full h-9 px-3 text-sm",
      "border border-[var(--color-border)] rounded-[var(--radius-sm)]",
      "bg-white text-[var(--color-text)]",
      "focus:outline-none focus:border-[var(--color-accent)]",
    ].join(" "),
  };
}

function selectClass() {
  return {
    className: [
      "w-full h-9 px-3 text-sm",
      "border border-[var(--color-border)] rounded-[var(--radius-sm)]",
      "bg-white text-[var(--color-text)]",
      "focus:outline-none focus:border-[var(--color-accent)]",
    ].join(" "),
  };
}
