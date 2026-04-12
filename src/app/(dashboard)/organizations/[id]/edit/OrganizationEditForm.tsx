"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { updateOrganizationAction } from "@/server/usecases/organizations/actions";
import { EMPLOYEE_SIZE_OPTIONS } from "@/lib/constants/case-status";

interface InitialValues {
  legalName: string;
  corporateNumber: string | null;
  postalCode: string | null;
  address: string | null;
  industry: string | null;
  employeeSize: string | null;
  notes: string | null;
}

interface Props {
  orgId: string;
  initialValues: InitialValues;
}

export function OrganizationEditForm({ orgId, initialValues }: Props) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(updateOrganizationAction, null);

  useEffect(() => {
    if (state?.success) {
      router.push(`/organizations/${orgId}`);
    }
  }, [state, orgId, router]);

  return (
    <div className="max-w-2xl space-y-6">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/organizations" className="hover:text-[var(--color-accent)]">企業管理</Link>
        <span>/</span>
        <Link href={`/organizations/${orgId}`} className="hover:text-[var(--color-accent)]">
          {initialValues.legalName}
        </Link>
        <span>/</span>
        <span>編集</span>
      </div>

      <h1 className="text-[22px] font-semibold text-[var(--color-text)]">企業情報を編集</h1>

      {state?.error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-[var(--radius-md)] text-sm text-[var(--color-error)]">
          {state.error}
        </div>
      )}

      <form action={action} className="space-y-5">
        <input type="hidden" name="orgId" value={orgId} />

        <Field label="法人名" required>
          <input
            name="legalName"
            type="text"
            required
            defaultValue={initialValues.legalName}
            placeholder="株式会社○○"
            {...inputClass()}
          />
        </Field>

        <Field label="法人番号">
          <input
            name="corporateNumber"
            type="text"
            defaultValue={initialValues.corporateNumber ?? ""}
            placeholder="13桁の法人番号"
            {...inputClass()}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="郵便番号">
            <input
              name="postalCode"
              type="text"
              defaultValue={initialValues.postalCode ?? ""}
              placeholder="000-0000"
              {...inputClass()}
            />
          </Field>
          <Field label="業種">
            <input
              name="industry"
              type="text"
              defaultValue={initialValues.industry ?? ""}
              placeholder="IT・通信"
              {...inputClass()}
            />
          </Field>
        </div>

        <Field label="住所">
          <input
            name="address"
            type="text"
            defaultValue={initialValues.address ?? ""}
            placeholder="東京都千代田区..."
            {...inputClass()}
          />
        </Field>

        <Field label="従業員規模">
          <select
            name="employeeSize"
            defaultValue={initialValues.employeeSize ?? ""}
            {...inputClass()}
          >
            <option value="">選択してください</option>
            {EMPLOYEE_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label="備考">
          <textarea
            name="notes"
            rows={3}
            defaultValue={initialValues.notes ?? ""}
            placeholder="特記事項など"
            className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-white text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary" loading={isPending}>
            保存する
          </Button>
          <Link
            href={`/organizations/${orgId}`}
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
