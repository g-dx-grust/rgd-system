import { redirect } from "next/navigation";

/**
 * グローバル受講者管理タブは廃止（修正依頼③）。
 * 受講者管理は各案件詳細 > 受講者タブで行う。
 */
export default function ParticipantsPage() {
  redirect("/cases");
}
