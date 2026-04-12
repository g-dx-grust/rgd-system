"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { createCaseAction } from "@/server/usecases/cases/actions";

interface Organization {
  id: string;
  legalName: string;
}

interface SubsidyProgram {
  id: string;
  name: string;
}

interface User {
  id: string;
  displayName: string;
}

export default function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [state, action, isPending] = useActionState(createCaseAction, null);
  const [organizations, setOrgs] = useState<Organization[]>([]);
  const [programs, setPrograms]  = useState<SubsidyProgram[]>([]);
  const [users, setUsers]        = useState<User[]>([]);
  const [preOrgId, setPreOrgId]  = useState("");

  // URLパラメータからデフォルト企業IDを取得
  useEffect(() => {
    searchParams.then((sp) => {
      setPreOrgId(sp["organizationId"] ?? "");
    });
  }, [searchParams]);

  // クライアントサイドでマスタデータを取得
  useEffect(() => {
    fetch("/api/master/organizations")
      .then((r) => r.json())
      .then((d) => setOrgs(d ?? []))
      .catch(() => {});

    fetch("/api/master/subsidy-programs")
      .then((r) => r.json())
      .then((d) => setPrograms(d ?? []))
      .catch(() => {});

    fetch("/api/master/users")
      .then((r) => r.json())
      .then((d) => setUsers(d ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">案件を追加</h1>

      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-[var(--radius-md)] text-sm text-[var(--color-error)]">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-5">
        {/* 顧客企業 */}
        <Field label="顧客企業" required>
          <select
            name="organizationId"
            required
            defaultValue={preOrgId}
            {...selectClass()}
          >
            <option value="">選択してください</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.legalName}</option>
            ))}
          </select>
        </Field>

        {/* 案件名 */}
        <Field label="案件名" required>
          <input
            name="caseName"
            type="text"
            required
            placeholder="例: ○○社 人材開発支援助成金 2026年度"
            {...inputClass()}
          />
        </Field>

        {/* 助成金種別 */}
        <Field label="助成金種別">
          <select name="subsidyProgramId" {...selectClass()}>
            <option value="">選択してください</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>

        {/* 担当者 */}
        <Field label="主担当">
          <select name="ownerUserId" {...selectClass()}>
            <option value="">未割当</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
        </Field>

        {/* 日付系 */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="契約日">
            <input name="contractDate" type="date" {...inputClass()} />
          </Field>
          <Field label="受講開始予定日">
            <input name="plannedStartDate" type="date" {...inputClass()} />
          </Field>
          <Field label="受講終了予定日">
            <input name="plannedEndDate" type="date" {...inputClass()} />
          </Field>
          <Field label="初回申請期限">
            <input name="preApplicationDueDate" type="date" {...inputClass()} />
          </Field>
          <Field label="最終申請期限">
            <input name="finalApplicationDueDate" type="date" {...inputClass()} />
          </Field>
        </div>

        {/* 概要 */}
        <Field label="概要メモ">
          <textarea
            name="summary"
            rows={3}
            placeholder="案件の概要・特記事項など"
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary" loading={isPending}>
            作成する
          </Button>
          <Link
            href="/cases"
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
