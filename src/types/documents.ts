/**
 * 書類・ファイル管理 型定義
 * Step 4: 書類回収・ファイル管理
 */

// ------------------------------------------------------------
// 定数
// ------------------------------------------------------------

export const DOCUMENT_SCOPE = {
  COMPANY:     'company',
  PARTICIPANT: 'participant',
  CASE:        'case',
} as const;
export type DocumentScope = typeof DOCUMENT_SCOPE[keyof typeof DOCUMENT_SCOPE];

export const REUSABLE_LEVEL = {
  ORGANIZATION: 'organization',
  CASE:         'case',
  PARTICIPANT:  'participant',
} as const;
export type ReusableLevel = typeof REUSABLE_LEVEL[keyof typeof REUSABLE_LEVEL];

export const DOCUMENT_REQUIREMENT_STATUS = {
  PENDING:  'pending',
  RECEIVED: 'received',
  RETURNED: 'returned',
  APPROVED: 'approved',
} as const;
export type DocumentRequirementStatus =
  typeof DOCUMENT_REQUIREMENT_STATUS[keyof typeof DOCUMENT_REQUIREMENT_STATUS];

export const REVIEW_STATUS = {
  UPLOADED:  'uploaded',
  REVIEWING: 'reviewing',
  RETURNED:  'returned',
  APPROVED:  'approved',
} as const;
export type ReviewStatus = typeof REVIEW_STATUS[keyof typeof REVIEW_STATUS];

export const RETURN_REASON = {
  UNCLEAR_IMAGE:        'unclear_image',
  MISSING_PAGES:        'missing_pages',
  WRONG_SUBJECT:        'wrong_subject',
  WRONG_TYPE:           'wrong_type',
  INSUFFICIENT_CONTENT: 'insufficient_content',
  EXPIRED:              'expired',
  OTHER:                'other',
} as const;
export type ReturnReason = typeof RETURN_REASON[keyof typeof RETURN_REASON];

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  unclear_image:        '画像が不鮮明',
  missing_pages:        'ページが不足している',
  wrong_subject:        '対象者が不一致',
  wrong_type:           '書類種別の誤り',
  insufficient_content: '記載内容が不足している',
  expired:              '有効期限切れ',
  other:                'その他',
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  uploaded:  'アップロード済み',
  reviewing: '確認中',
  returned:  '差戻し',
  approved:  '承認済み',
};

export const REQUIREMENT_STATUS_LABEL: Record<DocumentRequirementStatus, string> = {
  pending:  '未提出',
  received: '受領済み',
  returned: '差戻し中',
  approved: '確定',
};

// MIME タイプ検証用
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
] as const;
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export const STORAGE_BUCKET = 'case-documents' as const;

// ------------------------------------------------------------
// ドメイン型
// ------------------------------------------------------------

export interface DocumentType {
  id:             string;
  code:           string;
  name:           string;
  scope:          DocumentScope;
  reusableLevel:  ReusableLevel;
  description:    string | null;
  sortOrder:      number;
  active:         boolean;
}

export interface DocumentRequirement {
  id:               string;
  caseId:           string;
  participantId:    string | null;
  documentTypeId:   string;
  documentType:     DocumentType;
  requiredFlag:     boolean;
  dueDate:          string | null;   // ISO date string
  status:           DocumentRequirementStatus;
  requestedAt:      string | null;   // ISO datetime
  approvedAt:       string | null;   // ISO datetime
  note:             string | null;
  latestDocument:   Document | null; // 最新版ファイル
}

export interface Document {
  id:                   string;
  caseId:               string;
  organizationId:       string;
  participantId:        string | null;
  documentRequirementId: string | null;
  documentTypeId:       string;
  documentType:         DocumentType;
  storageBucket:        string;
  storagePath:          string;
  originalFilename:     string;
  mimeType:             string;
  fileSize:             number;
  versionNo:            number;
  replacedDocumentId:   string | null;
  reviewStatus:         ReviewStatus;
  returnReason:         ReturnReason | null;
  returnReasonDetail:   string | null;
  uploadedByUserId:     string | null;
  uploadedAt:           string;  // ISO datetime
  deletedAt:            string | null;
}

export interface UploadToken {
  id:              string;
  token:           string;
  caseId:          string;
  organizationId:  string;
  expiresAt:       string;  // ISO datetime
  isActive:        boolean;
  note:            string | null;
}

// ------------------------------------------------------------
// 充足率集計型
// ------------------------------------------------------------

export interface CaseDocumentSummary {
  caseId:               string;
  totalRequirements:    number;
  requiredCount:        number;
  approvedCount:        number;
  receivedCount:        number;
  returnedCount:        number;
  pendingRequiredCount: number;
  insufficientCount:    number;
  /** 必須書類充足率 (0–100) */
  completionRate:       number;
}

export interface ParticipantDocumentSummary {
  participantId:     string;
  caseId:            string;
  totalRequirements: number;
  requiredCount:     number;
  approvedCount:     number;
  returnedCount:     number;
  insufficientCount: number;
  completionRate:    number;
}

// ------------------------------------------------------------
// API I/O 型
// ------------------------------------------------------------

/** 署名付きアップロードURL取得リクエスト */
export interface GetUploadUrlRequest {
  caseId:               string;
  organizationId:       string;
  documentTypeId:       string;
  participantId?:       string;
  documentRequirementId?: string;
  originalFilename:     string;
  mimeType:             string;
  fileSize:             number;
}

/** 署名付きアップロードURL取得レスポンス */
export interface GetUploadUrlResponse {
  uploadUrl:     string;
  storagePath:   string;
  token:         string;   // アップロード完了確認用トークン
}

/** アップロード完了通知リクエスト */
export interface ConfirmUploadRequest {
  storagePath:          string;
  originalFilename:     string;
  mimeType:             string;
  fileSize:             number;
  caseId:               string;
  organizationId:       string;
  documentTypeId:       string;
  participantId?:       string;
  documentRequirementId?: string;
  replacedDocumentId?:  string;
}

/** 差戻しリクエスト */
export interface ReturnDocumentRequest {
  documentId:    string;
  returnReason:  ReturnReason;
  returnReasonDetail?: string;
}

/** 承認リクエスト */
export interface ApproveDocumentRequest {
  documentId:           string;
  requirementId?:       string;
}

/** 署名付き閲覧URL取得レスポンス */
export interface GetSignedUrlResponse {
  signedUrl:   string;
  expiresAt:   string;
}
