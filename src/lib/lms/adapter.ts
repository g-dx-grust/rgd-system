/**
 * LMS Adapter 共通インターフェース
 *
 * システム本体はこのインターフェースだけを参照する。
 * LMS製品依存ロジックは各 Adapter クラスに閉じ込め、
 * 製品切替時の影響範囲を最小化する。
 */

/** Adapter が返す受講者ごとの進捗データ */
export interface LmsProgressRecord {
  /** LMS側のユーザー識別子（メールアドレス、社員番号など） */
  lmsUserId: string;
  /** 進捗率（0〜100）*/
  progressRate: number;
  /** 完了フラグ */
  isCompleted: boolean;
  /** LMS上の最終アクセス日時 */
  lastAccessAt: Date | null;
  /** 累計視聴秒数（取得できない場合は null）*/
  totalWatchSeconds: number | null;
  /** LMSから取得した生データ（raw_payload 保管用）*/
  rawPayload: Record<string, unknown>;
}

/** 同期結果サマリー */
export interface LmsSyncResult {
  totalRecords: number;
  successRecords: number;
  errorRecords: number;
  /** エラー行の詳細（行番号とエラー内容）*/
  errors: Array<{ row: number; message: string }>;
  records: LmsProgressRecord[];
}

/**
 * LMS Adapter 共通インターフェース
 * 全 Adapter はこのインターフェースを実装すること。
 */
export interface LmsAdapter {
  /** Adapter の種別識別子 */
  readonly adapterType: 'csv' | 'api' | 'webhook' | 'manual';

  /**
   * 進捗データを取得・パースして共通形式で返す。
   * @param source - CSV ならファイル内容 (string)、API なら config から自動取得
   */
  fetchProgress(source?: string): Promise<LmsSyncResult>;
}
