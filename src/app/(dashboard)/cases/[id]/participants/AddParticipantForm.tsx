"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { createParticipantAction } from "@/server/usecases/participants/actions";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/constants/case-status";

interface Props {
  caseId: string;
}

export function AddParticipantForm({ caseId }: Props) {
  const [state, action, isPending] = useActionState(createParticipantAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="caseId" value={caseId} />

      {state?.error && (
        <p className="text-xs text-[var(--color-error)]">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-[#16A34A] font-medium">追加しました。</p>
      )}

      <Field label="氏名" required>
        <input name="name" type="text" required placeholder="山田 太郎" {...inputClass()} />
      </Field>
      <Field label="氏名（カナ）">
        <input name="nameKana" type="text" placeholder="ヤマダ タロウ" {...inputClass()} />
      </Field>
      <Field label="社員番号">
        <input name="employeeCode" type="text" placeholder="EMP001" {...inputClass()} />
      </Field>
      <Field label="メール">
        <input name="email" type="email" placeholder="example@company.co.jp" {...inputClass()} />
      </Field>
      <Field label="部署">
        <input name="department" type="text" placeholder="営業部" {...inputClass()} />
      </Field>
      <Field label="雇用形態">
        <select name="employmentType" {...inputClass()}>
          <option value="">選択してください</option>
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="入社日">
        <input name="joinedAt" type="date" {...inputClass()} />
      </Field>

      <Button type="submit" variant="primary" size="sm" loading={isPending}>
        追加する
      </Button>
    </form>
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
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[var(--color-text)]">
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
      "w-full h-8 px-2.5 text-sm",
      "border border-[var(--color-border)] rounded-[var(--radius-sm)]",
      "bg-white text-[var(--color-text)]",
      "focus:outline-none focus:border-[var(--color-accent)]",
    ].join(" "),
  };
}
