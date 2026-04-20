"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createUserAction } from "@/server/usecases/users/actions";
import type { RoleOption } from "@/server/repositories/users";
import {
  getRoleCodesForAccessMode,
  type UserAccessMode,
} from "@/lib/rbac/company-scope";
import type { RoleCode } from "@/lib/rbac";

interface OperatingCompanyOption {
  id: string;
  name: string;
}

interface Props {
  roles: RoleOption[];
  operatingCompanies: OperatingCompanyOption[];
}

interface CreateUserDialogProps extends Props {
  onClose: () => void;
}

const INPUT_CLASS = [
  "w-full h-9 px-3 text-sm",
  "border border-[var(--color-border-strong)] rounded-[var(--radius-sm)]",
  "bg-white text-[var(--color-text)]",
  "placeholder:text-[var(--color-text-muted)]",
  "outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]",
].join(" ");

const LABEL_CLASS = "block text-sm font-medium text-[var(--color-text-sub)] mb-1";

export function CreateUserForm({ roles, operatingCompanies }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        ユーザーを追加
      </Button>
    );
  }

  return (
    <CreateUserDialog
      roles={roles}
      operatingCompanies={operatingCompanies}
      onClose={() => setOpen(false)}
    />
  );
}

function CreateUserDialog({
  roles,
  operatingCompanies,
  onClose,
}: CreateUserDialogProps) {
  const [state, formAction, isPending] = useActionState(createUserAction, null);
  const [selectedAccessMode, setSelectedAccessMode] = useState<UserAccessMode>("company_scoped");
  const [selectedRoleCode, setSelectedRoleCode] = useState<RoleCode | "">("operations_staff");
  const [selectedOperatingCompanyId, setSelectedOperatingCompanyId] = useState("");

  const availableRoles = roles.filter((role) =>
    getRoleCodesForAccessMode(selectedAccessMode).includes(role.code)
  );
  const companyIsRequired = selectedAccessMode === "company_scoped";
  const currentRoleCode = availableRoles.some((role) => role.code === selectedRoleCode)
    ? selectedRoleCode
    : (availableRoles[0]?.code ?? "");

  useEffect(() => {
    if (state?.success) {
      onClose();
    }
  }, [onClose, state?.success]);

  const handleAccessModeChange = (nextAccessMode: UserAccessMode) => {
    setSelectedAccessMode(nextAccessMode);

    if (nextAccessMode !== "company_scoped") {
      setSelectedOperatingCompanyId("");
    }

    const nextRoleCodes = getRoleCodesForAccessMode(nextAccessMode);
    if (!nextRoleCodes.some((roleCode) => roleCode === selectedRoleCode)) {
      setSelectedRoleCode(nextRoleCodes[0] ?? "");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="ユーザー新規作成"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] shadow-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            ユーザーを追加
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

        <form action={formAction} className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="u-email" className={LABEL_CLASS}>
              メールアドレス <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="u-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="user@example.com"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="u-displayName" className={LABEL_CLASS}>
              氏名 <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="u-displayName"
              name="displayName"
              type="text"
              required
              placeholder="山田 太郎"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="u-password" className={LABEL_CLASS}>
              初期パスワード <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              id="u-password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="8文字以上"
              className={INPUT_CLASS}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              8文字以上。本人へ別経路で伝えてください。
            </p>
          </div>

          <div>
            <label htmlFor="u-access-mode" className={LABEL_CLASS}>
              アクセス区分 <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              id="u-access-mode"
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
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              会社横断 / 片方の会社利用 / 社労士 / 顧客ログインをここで切り替えます。
            </p>
          </div>

          <div>
            <label htmlFor="u-role" className={LABEL_CLASS}>
              ロール <span className="text-[var(--color-error)]">*</span>
            </label>
            <select
              id="u-role"
              name="roleCode"
              required
              value={currentRoleCode}
              onChange={(event) =>
                setSelectedRoleCode(event.target.value as RoleCode | "")
              }
              className={INPUT_CLASS}
            >
              {availableRoles.length === 0 && (
                <option value="">選択可能なロールがありません</option>
              )}
              {availableRoles.map((r) => (
                <option key={r.id} value={r.code}>
                  {r.labelJa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="u-company" className={LABEL_CLASS}>
              利用会社
              {companyIsRequired && (
                <span className="ml-1 text-[var(--color-error)]">*</span>
              )}
            </label>
            <select
              id="u-company"
              name="operatingCompanyId"
              required={companyIsRequired}
              value={companyIsRequired ? selectedOperatingCompanyId : ""}
              onChange={(event) => setSelectedOperatingCompanyId(event.target.value)}
              disabled={isPending || !companyIsRequired}
              className={INPUT_CLASS}
            >
              <option value="">
                {companyIsRequired ? "選択してください" : "（会社指定なし）"}
              </option>
              {operatingCompanies.map((oc) => (
                <option key={oc.id} value={oc.id}>
                  {oc.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {companyIsRequired
                ? "片方の会社で利用するアカウントは、株式会社グラスト / 株式会社エイムのどちらかを選択してください。"
                : selectedAccessMode === "cross_company"
                  ? "会社横断ログインでは運営会社の指定は不要です。"
                  : selectedAccessMode === "external_specialist"
                    ? "社労士ログインは会社に紐付けず、社労士専用画面で利用します。"
                    : "顧客ログインは会社に紐付けず、顧客向け導線で利用します。"}
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
              作成する
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
