"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  changeUserRoleAction,
  type UserActionResult,
} from "@/server/usecases/users/actions";
import type { RoleCode } from "@/lib/rbac";
import {
  getRoleCodesForAccessMode,
  getUserAccessMode,
  type UserAccessMode,
} from "@/lib/rbac/company-scope";
import type { RoleOption } from "@/server/repositories/users";

interface OperatingCompanyOption {
  id: string;
  name: string;
}

interface UserRoleFormProps {
  userId: string;
  currentRoleCode: RoleCode | null;
  currentOperatingCompanyId: string | null;
  roles: RoleOption[];
  operatingCompanies: OperatingCompanyOption[];
}

const INITIAL_STATE = null;

const INPUT_CLASS = [
  "w-full h-9 px-3 text-sm",
  "border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]",
  "bg-white text-[var(--color-text)]",
  "outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
  "disabled:opacity-60 disabled:cursor-not-allowed",
].join(" ");

const LABEL_CLASS = "block text-sm font-medium text-[var(--color-text-sub)] mb-1";

export function UserRoleForm({
  userId,
  currentRoleCode,
  currentOperatingCompanyId,
  roles,
  operatingCompanies,
}: UserRoleFormProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<UserActionResult | null>(INITIAL_STATE);
  const [isPending, startTransition] = useTransition();
  const [selectedAccessMode, setSelectedAccessMode] = useState<UserAccessMode>(
    currentRoleCode ? getUserAccessMode(currentRoleCode) : "company_scoped"
  );
  const [selectedRoleCode, setSelectedRoleCode] = useState<RoleCode | "">(
    currentRoleCode ?? "operations_staff"
  );
  const [selectedOperatingCompanyId, setSelectedOperatingCompanyId] = useState(
    currentRoleCode && getUserAccessMode(currentRoleCode) === "company_scoped"
      ? (currentOperatingCompanyId ?? "")
      : ""
  );

  const availableRoles = roles.filter((role) =>
    getRoleCodesForAccessMode(selectedAccessMode).includes(role.code)
  );
  const companyIsRequired = selectedAccessMode === "company_scoped";

  const initializeDraft = () => {
    const nextAccessMode = currentRoleCode
      ? getUserAccessMode(currentRoleCode)
      : "company_scoped";
    const nextRoleCode =
      currentRoleCode ?? getRoleCodesForAccessMode(nextAccessMode)[0] ?? "";

    setSelectedAccessMode(nextAccessMode);
    setSelectedRoleCode(nextRoleCode);
    setSelectedOperatingCompanyId(
      nextAccessMode === "company_scoped"
        ? (currentOperatingCompanyId ?? "")
        : ""
    );
    setState(INITIAL_STATE);
  };

  const handleOpen = () => {
    initializeDraft();
    setOpen(true);
  };

  const handleAccessModeChange = (mode: UserAccessMode) => {
    const nextRoles = getRoleCodesForAccessMode(mode);
    const nextRoleCode = nextRoles.includes(selectedRoleCode as RoleCode)
      ? selectedRoleCode
      : (nextRoles[0] ?? "");

    setSelectedAccessMode(mode);
    setSelectedRoleCode(nextRoleCode);
    if (mode !== "company_scoped") {
      setSelectedOperatingCompanyId("");
    }
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(() => {
      void (async () => {
        const result = await changeUserRoleAction(null, formData);
        setState(result);
        if (result?.success) {
          setOpen(false);
        }
      })();
    });
  };

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={handleOpen}>
        {currentRoleCode ? "編集" : "追加"}
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="ユーザー権限編集"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] shadow-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {currentRoleCode ? "ロール・所属運営会社を編集" : "ユーザーを管理対象に追加"}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors leading-none text-lg"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <form action={handleSubmit} className="px-5 py-4 space-y-4">
          <input type="hidden" name="userId" value={userId} />

          <div>
            <label htmlFor={`access-mode-${userId}`} className={LABEL_CLASS}>
              アクセス区分 <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              id={`access-mode-${userId}`}
              value={selectedAccessMode}
              onChange={(event) => handleAccessModeChange(event.target.value as UserAccessMode)}
              disabled={isPending}
              className={INPUT_CLASS}
            >
              <option value="company_scoped">運営会社別ログイン</option>
              <option value="cross_company">会社横断ログイン</option>
              <option value="external_specialist">社労士ログイン</option>
              <option value="client_portal">顧客ログイン</option>
            </select>
          </div>

          <div>
            <label htmlFor={`role-${userId}`} className={LABEL_CLASS}>
              ロール <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              id={`role-${userId}`}
              name="roleCode"
              value={selectedRoleCode}
              onChange={(event) =>
                setSelectedRoleCode(event.target.value as RoleCode | "")
              }
              disabled={isPending}
              required
              className={INPUT_CLASS}
            >
              {availableRoles.map((role) => (
                <option key={role.id} value={role.code}>
                  {role.labelJa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`company-${userId}`} className={LABEL_CLASS}>
              利用会社
              {companyIsRequired && (
                <span className="ml-1 text-[var(--color-error)]">*</span>
              )}
            </label>
            <select
              id={`company-${userId}`}
              name="operatingCompanyId"
              value={selectedOperatingCompanyId}
              onChange={(event) => setSelectedOperatingCompanyId(event.target.value)}
              disabled={isPending || !companyIsRequired}
              required={companyIsRequired}
              className={INPUT_CLASS}
            >
              <option value="">{companyIsRequired ? "選択してください" : "（会社指定なし）"}</option>
              {operatingCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {companyIsRequired
                ? "片方の会社で利用する権限です。株式会社グラスト / 株式会社エイムのどちらかを選択してください。"
                : selectedAccessMode === "cross_company"
                  ? "会社横断ログインでは利用会社の指定は不要です。"
                  : selectedAccessMode === "external_specialist"
                    ? "社労士ログインは会社に紐付けません。"
                    : "顧客ログインは会社に紐付けません。"}
            </p>
          </div>

          {state?.error && (
            <p className="text-sm text-[var(--color-error)]">{state.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setOpen(false)}
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
              更新する
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
