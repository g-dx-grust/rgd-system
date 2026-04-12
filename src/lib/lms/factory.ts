/**
 * LMS Adapter ファクトリ
 *
 * adapter_type 文字列から対応する Adapter インスタンスを返す。
 * 新しい Adapter を追加する場合はここに追記する。
 *
 * 未対応の adapter_type が指定された場合は例外を throw せず、
 * NotSupportedLmsAdapter を返してエラーを呼び出し元で安全にハンドリングできるようにする。
 */

import type { LmsAdapter, LmsSyncResult } from "./adapter";
import { CsvLmsAdapter } from "./adapters/csv";

/** 未対応 adapter_type が選ばれたときのフォールバック実装 */
class NotSupportedLmsAdapter implements LmsAdapter {
  readonly adapterType = "manual" as const;

  constructor(private readonly requestedType: string) {}

  async fetchProgress(): Promise<LmsSyncResult> {
    return {
      totalRecords:   0,
      successRecords: 0,
      errorRecords:   0,
      errors: [
        {
          row:     0,
          message: `LMS連携方式 "${this.requestedType}" は現在対応していません。CSV方式またはシステム管理者へお問い合わせください。`,
        },
      ],
      records: [],
    };
  }
}

/** サポートする adapter_type の一覧 */
export const SUPPORTED_ADAPTER_TYPES = ["csv"] as const;
export type SupportedAdapterType = (typeof SUPPORTED_ADAPTER_TYPES)[number];

export function isSupportedAdapterType(type: string): type is SupportedAdapterType {
  return (SUPPORTED_ADAPTER_TYPES as readonly string[]).includes(type);
}

export function createLmsAdapter(adapterType: string): LmsAdapter {
  switch (adapterType) {
    case "csv":
      return new CsvLmsAdapter();
    case "api":
    case "webhook":
    case "manual":
    default:
      // 未対応の場合は実行時例外にせず、エラー内容を返せる Adapter を返す
      return new NotSupportedLmsAdapter(adapterType);
  }
}
