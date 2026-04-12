/**
 * 顧客向け書類提出画面
 * /upload/[token]
 *
 * - アップロードトークンでアクセスを制限する
 * - 認証不要（顧客担当者が直接アクセス）
 * - 内部メモ・審査情報は一切表示しない
 * - アップロード完了後に /api/documents/confirm を呼ぶ
 */

import { notFound } from "next/navigation";
import { getUploadToken } from "@/server/repositories/documents";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExternalUploadClient } from "./ExternalUploadClient";

interface Props {
  params: Promise<{ token: string }>;
}

async function getCaseRequirements(caseId: string, organizationId: string) {
  const admin = createAdminClient();

  const [{ data: caseData }, { data: orgData }, { data: requirements }, { data: docTypes }] =
    await Promise.all([
      admin
        .from("cases")
        .select("id, case_code, case_name")
        .eq("id", caseId)
        .maybeSingle(),
      admin
        .from("organizations")
        .select("id, legal_name")
        .eq("id", organizationId)
        .maybeSingle(),
      admin
        .from("document_requirements")
        .select("id, document_type_id, required_flag, due_date, status, participant_id")
        .eq("case_id", caseId)
        .is("participant_id", null)  // 会社単位のみ表示（顧客向け）
        .in("status", ["pending", "returned"]),  // 未提出・差戻しのみ
      admin
        .from("document_types")
        .select("id, code, name, scope, reusable_level, description, sort_order, active")
        .eq("active", true),
    ]);

  return { caseData, orgData, requirements: requirements ?? [], docTypes: docTypes ?? [] };
}

export default async function ExternalUploadPage({ params }: Props) {
  const { token } = await params;

  // トークン検証
  const tokenRecord = await getUploadToken(token).catch(() => null);

  if (!tokenRecord) {
    notFound();
  }

  if (!tokenRecord.isActive) {
    return (
      <div className="max-w-lg mx-auto text-center mt-20">
        <h1 className="text-xl font-semibold text-[var(--color-text)] mb-2">
          このリンクは無効化されています
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          担当者にお問い合わせください。
        </p>
      </div>
    );
  }

  if (new Date(tokenRecord.expiresAt) < new Date()) {
    return (
      <div className="max-w-lg mx-auto text-center mt-20">
        <h1 className="text-xl font-semibold text-[var(--color-text)] mb-2">
          このリンクの有効期限が切れています
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          担当者に新しいリンクの発行を依頼してください。
        </p>
      </div>
    );
  }

  const { caseData, orgData, requirements, docTypes } = await getCaseRequirements(
    tokenRecord.caseId,
    tokenRecord.organizationId
  );

  if (!caseData || !orgData) notFound();

  // 要件と書類種別を結合
  const requirementsWithType = requirements.map((req) => {
    const dt = docTypes.find((d) => d.id === req.document_type_id);
    return { ...req, documentType: dt };
  }).filter((req) => req.documentType !== undefined);

  return (
    <div className="max-w-2xl mx-auto">
      {/* ヘッダー情報 */}
      <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-4 mb-6">
        <p className="text-xs text-[var(--color-text-muted)] mb-1">
          {(caseData as { case_code: string }).case_code}
        </p>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">
          {(caseData as { case_name: string }).case_name}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {(orgData as { legal_name: string }).legal_name}
        </p>
        <p className="mt-3 text-sm text-[var(--color-text)]">
          以下の書類を提出してください。ご不明な点は担当者にご連絡ください。
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          有効期限: {new Date(tokenRecord.expiresAt).toLocaleDateString("ja-JP")} まで
        </p>
      </div>

      {requirementsWithType.length === 0 ? (
        <div className="bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-5 py-10 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            現在、提出が必要な書類はありません。
          </p>
        </div>
      ) : (
        <ExternalUploadClient
          caseId={tokenRecord.caseId}
          organizationId={tokenRecord.organizationId}
          uploadToken={token}
          requirements={requirementsWithType as ExternalRequirement[]}
        />
      )}
    </div>
  );
}

// 型定義（外部ページ専用の軽量版）
export interface ExternalRequirement {
  id:              string;
  document_type_id: string;
  required_flag:   boolean;
  due_date:        string | null;
  status:          string;
  documentType: {
    id:          string;
    code:        string;
    name:        string;
    scope:       string;
    reusable_level: string;
    description: string | null;
    sort_order:  number;
    active:      boolean;
  };
}
