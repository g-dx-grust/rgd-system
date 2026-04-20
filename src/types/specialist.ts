/**
 * 社労士専用画面 型定義
 *
 * specialist_cases / deficiency_requests / specialist_comments テーブルに対応。
 */

// ------------------------------------------------------------
// Enum 相当
// ------------------------------------------------------------

export type DeficiencyStatus = 'open' | 'responded' | 'resolved';

// ------------------------------------------------------------
// SpecialistCase
// ------------------------------------------------------------

export interface SpecialistCase {
  id:                string;
  caseId:            string;
  specialistUserId:  string;
  sharedBy:          string | null;
  sharedAt:          string;
  isActive:          boolean;
  note:              string | null;
  createdAt:         string;
  updatedAt:         string;
}

// ------------------------------------------------------------
// DeficiencyRequest
// ------------------------------------------------------------

export interface RequiredFileItem {
  label: string;
  note:  string;
}

export interface DeficiencyRequest {
  id:            string;
  caseId:        string;
  createdBy:     string | null;
  description:   string;
  requiredFiles: RequiredFileItem[];
  deadline:      string | null;
  status:        DeficiencyStatus;
  respondedAt:   string | null;
  respondedBy:   string | null;
  resolvedAt:    string | null;
  resolvedBy:    string | null;
  deletedAt:     string | null;
  createdAt:     string;
  updatedAt:     string;
}

// ------------------------------------------------------------
// SpecialistComment
// ------------------------------------------------------------

export interface SpecialistComment {
  id:               string;
  caseId:           string;
  authorId:         string;
  body:             string;
  isFromSpecialist: boolean;
  parentId:         string | null;
  deletedAt:        string | null;
  createdAt:        string;
  updatedAt:        string;
  // 結合フィールド
  authorName?:      string | null;
}

// ------------------------------------------------------------
// 入力型
// ------------------------------------------------------------

export interface CreateSpecialistCaseInput {
  caseId:           string;
  specialistUserId: string;
  note?:            string;
}

export interface UpdateSpecialistCaseInput {
  isActive?: boolean;
  note?:     string;
}

export interface CreateDeficiencyRequestInput {
  caseId:        string;
  description:   string;
  requiredFiles: RequiredFileItem[];
  deadline?:     string;
}

export interface UpdateDeficiencyRequestInput {
  status?:       DeficiencyStatus;
  respondedAt?:  string;
  resolvedAt?:   string;
}

export interface CreateSpecialistCommentInput {
  caseId:           string;
  body:             string;
  isFromSpecialist: boolean;
  parentId?:        string;
}
