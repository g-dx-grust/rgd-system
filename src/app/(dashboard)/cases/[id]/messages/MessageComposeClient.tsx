"use client";

/**
 * メッセージ作成フォーム（Client Component）
 *
 * テンプレートを選択すると差し込み済みの件名・本文をプレビュー表示し、
 * 編集後に送信履歴として記録する。
 */

import { useState, useActionState, useTransition } from "react";
import { sendMessageAction, previewMessageAction } from "@/server/usecases/messages/actions";
import type { MessageTemplateRow, TemplateType } from "@/server/repositories/message-templates";

const TEMPLATE_TYPE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: "start_guide",    label: "開始案内" },
  { value: "billing_notice", label: "請求書送付案内" },
  { value: "doc_request",    label: "書類依頼" },
  { value: "questionnaire",  label: "アンケート依頼" },
  { value: "reminder",       label: "リマインド" },
  { value: "other",          label: "その他" },
];

const SEND_METHOD_OPTIONS = [
  { value: "manual", label: "手動（メール・電話等）" },
  { value: "email",  label: "メール送信" },
  { value: "lark",   label: "Lark" },
];

interface CaseInfo {
  caseName:         string;
  organizationName: string;
  acceptanceDate:   string | null;
  plannedStartDate: string | null;
  plannedEndDate:   string | null;
}

interface Props {
  caseId:    string;
  templates: MessageTemplateRow[];
  caseInfo:  CaseInfo;
}

export function MessageComposeClient({ caseId, templates, caseInfo }: Props) {
  const [state, action, isSending] = useActionState(sendMessageAction, null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateType,       setTemplateType]       = useState<string>("start_guide");
  const [subject,            setSubject]            = useState<string>("");
  const [body,               setBody]               = useState<string>("");
  const [, startTransition]                         = useTransition();

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setSubject("");
      setBody("");
      return;
    }

    // テンプレートを選択したら差し込みプレビューをサーバーから取得
    const formData = new FormData();
    formData.set("caseId",     caseId);
    formData.set("templateId", templateId);

    startTransition(async () => {
      const result = await previewMessageAction(null, formData);
      if ("error" in result) return;
      setSubject(result.subject);
      setBody(result.body);

      // テンプレート種別も自動設定
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) setTemplateType(tpl.templateType);
    });
  };

  return (
    <section className="border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 space-y-4">
      <h2 className="text-base font-semibold text-[var(--color-text)]">メッセージを作成・記録</h2>

      <form action={action} className="space-y-4">
        <input type="hidden" name="caseId"       value={caseId} />
        <input type="hidden" name="templateId"   value={selectedTemplateId} />
        <input type="hidden" name="templateType" value={templateType} />

        {state?.error && (
          <p className="text-sm text-[var(--color-error)]">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-[#16A34A]">送信履歴を記録しました。</p>
        )}

        {/* 案件情報プレビュー */}
        <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-sm)] px-3 py-2 text-xs text-[var(--color-text-muted)] space-y-0.5">
          <p>案件: {caseInfo.caseName}（{caseInfo.organizationName}）</p>
          <p>受理日: {caseInfo.acceptanceDate ?? "未登録"} / 受講期間: {caseInfo.plannedStartDate ?? "—"} 〜 {caseInfo.plannedEndDate ?? "—"}</p>
        </div>

        {/* テンプレート選択 */}
        {templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              テンプレートから選択
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">— テンプレートを選択 —</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 種別 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
            種別
          </label>
          <select
            name="templateType"
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          >
            {TEMPLATE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 件名 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
            件名 <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            type="text"
            name="subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="メールの件名"
            className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {/* 本文 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
            本文 <span className="text-[var(--color-error)]">*</span>
          </label>
          <textarea
            name="body"
            required
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="本文を入力してください"
            className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)] resize-y font-mono"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 送付先 */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              送付先
            </label>
            <input
              type="text"
              name="sentTo"
              placeholder="例: 山田 太郎 / taro@example.com"
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* 送信方法 */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
              送信方法
            </label>
            <select
              name="sendMethod"
              defaultValue="manual"
              className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
            >
              {SEND_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 備考 */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-sub)] mb-1">
            備考
          </label>
          <input
            type="text"
            name="note"
            placeholder="補足事項があれば記入"
            className="w-full border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[var(--radius-sm)] disabled:opacity-50 transition-colors"
          >
            {isSending ? "記録中..." : "送信履歴を記録"}
          </button>
        </div>
      </form>
    </section>
  );
}
