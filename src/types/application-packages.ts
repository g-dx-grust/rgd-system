/**
 * 申請パッケージ型定義
 *
 * application_packages / application_package_items テーブルに対応。
 */

// ------------------------------------------------------------
// Enum 相当
// ------------------------------------------------------------

export type PackageType   = 'pre' | 'final';
export type PackageStatus = 'draft' | 'shared' | 'archived';
export type PackageItemType = 'file' | 'csv' | 'pdf' | 'note';

// ------------------------------------------------------------
// ApplicationPackage
// ------------------------------------------------------------

export interface ApplicationPackage {
  id:                     string;
  caseId:                 string;
  packageType:            PackageType;
  packageStatus:          PackageStatus;
  generatedBy:            string | null;
  generatedByName:        string | null;
  generatedAt:            string;
  exportedFileDocumentId: string | null;
  sharedTo:               string | null;
  sharedAt:               string | null;
  note:                   string | null;
  items:                  ApplicationPackageItem[];
}

// ------------------------------------------------------------
// ApplicationPackageItem
// ------------------------------------------------------------

export interface ApplicationPackageItem {
  id:                string;
  packageId:         string;
  documentId:        string | null;
  snapshotVersionNo: number | null;
  itemType:          PackageItemType;
  label:             string | null;
  note:              string | null;
  sortOrder:         number;
  // 結合フィールド
  originalFilename?: string | null;
  mimeType?:         string | null;
}

// ------------------------------------------------------------
// 入力型
// ------------------------------------------------------------

export interface CreateApplicationPackageInput {
  caseId:       string;
  packageType:  PackageType;
  sharedTo?:    string;
  note?:        string;
  items:        CreateApplicationPackageItemInput[];
}

export interface CreateApplicationPackageItemInput {
  documentId?:        string;
  snapshotVersionNo?: number;
  itemType:           PackageItemType;
  label?:             string;
  note?:              string;
  sortOrder?:         number;
}

// ------------------------------------------------------------
// 初回申請可否チェック結果
// ------------------------------------------------------------

export interface PreApplicationReadinessResult {
  ready:                boolean;
  insufficientRequired: number;  // 必須書類で未充足の件数
  returnedCount:        number;  // 差戻し中の書類件数
  missingItems:         ReadinessMissingItem[];
}

export interface ReadinessMissingItem {
  label:       string;   // 表示名（書類名 or 受講者名+書類名）
  reason:      'not_submitted' | 'returned';
}

// ------------------------------------------------------------
// アカウント発行シート行
// ------------------------------------------------------------

export interface AccountSheetRow {
  no:             number;
  employeeCode:   string;
  name:           string;
  nameKana:       string;
  email:          string;
  department:     string;
  employmentType: string;
  joinedAt:       string;
}
