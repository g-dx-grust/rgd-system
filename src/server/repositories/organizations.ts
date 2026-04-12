/**
 * 顧客企業 リポジトリ
 */

import { createClient } from "@/lib/supabase/server";

export interface OrganizationRow {
  id: string;
  legalName: string;
  corporateNumber: string | null;
  postalCode: string | null;
  address: string | null;
  industry: string | null;
  employeeSize: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** アクティブな案件数（JOIN結果） */
  activeCaseCount?: number;
}

export interface OrganizationContactRow {
  id: string;
  organizationId: string;
  name: string;
  department: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface CreateOrganizationInput {
  legalName: string;
  corporateNumber?: string;
  postalCode?: string;
  address?: string;
  industry?: string;
  employeeSize?: string;
  notes?: string;
  createdBy: string;
}

export interface UpdateOrganizationInput {
  legalName?: string;
  corporateNumber?: string;
  postalCode?: string;
  address?: string;
  industry?: string;
  employeeSize?: string;
  notes?: string;
}

export interface CreateContactInput {
  organizationId: string;
  name: string;
  department?: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

// ---------------------------------------------------------------
// 企業一覧
// ---------------------------------------------------------------
export async function listOrganizations(): Promise<OrganizationRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, legal_name, corporate_number, postal_code, address, industry, employee_size, notes, created_at, updated_at")
    .is("deleted_at", null)
    .order("legal_name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapOrganization);
}

// ---------------------------------------------------------------
// 企業詳細
// ---------------------------------------------------------------
export async function getOrganization(id: string): Promise<OrganizationRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, legal_name, corporate_number, postal_code, address, industry, employee_size, notes, created_at, updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return mapOrganization(data);
}

// ---------------------------------------------------------------
// 担当者一覧
// ---------------------------------------------------------------
export async function listContacts(organizationId: string): Promise<OrganizationContactRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_contacts")
    .select("id, organization_id, name, department, title, email, phone, is_primary, created_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapContact);
}

// ---------------------------------------------------------------
// 企業作成
// ---------------------------------------------------------------
export async function createOrganization(input: CreateOrganizationInput): Promise<OrganizationRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      legal_name:       input.legalName,
      corporate_number: input.corporateNumber ?? null,
      postal_code:      input.postalCode ?? null,
      address:          input.address ?? null,
      industry:         input.industry ?? null,
      employee_size:    input.employeeSize ?? null,
      notes:            input.notes ?? null,
      created_by:       input.createdBy,
    })
    .select("id, legal_name, corporate_number, postal_code, address, industry, employee_size, notes, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "企業の作成に失敗しました");
  return mapOrganization(data);
}

// ---------------------------------------------------------------
// 企業更新
// ---------------------------------------------------------------
export async function updateOrganization(id: string, input: UpdateOrganizationInput): Promise<void> {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.legalName      !== undefined) updates["legal_name"]       = input.legalName;
  if (input.corporateNumber !== undefined) updates["corporate_number"] = input.corporateNumber;
  if (input.postalCode      !== undefined) updates["postal_code"]      = input.postalCode;
  if (input.address         !== undefined) updates["address"]          = input.address;
  if (input.industry        !== undefined) updates["industry"]         = input.industry;
  if (input.employeeSize    !== undefined) updates["employee_size"]    = input.employeeSize;
  if (input.notes           !== undefined) updates["notes"]            = input.notes;

  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------
// 担当者作成
// ---------------------------------------------------------------
export async function createContact(input: CreateContactInput): Promise<OrganizationContactRow> {
  const supabase = await createClient();

  // isPrimary を true にする場合、既存の primary を外す
  if (input.isPrimary) {
    await supabase
      .from("organization_contacts")
      .update({ is_primary: false })
      .eq("organization_id", input.organizationId)
      .is("deleted_at", null);
  }

  const { data, error } = await supabase
    .from("organization_contacts")
    .insert({
      organization_id: input.organizationId,
      name:       input.name,
      department: input.department ?? null,
      title:      input.title ?? null,
      email:      input.email ?? null,
      phone:      input.phone ?? null,
      is_primary: input.isPrimary ?? false,
    })
    .select("id, organization_id, name, department, title, email, phone, is_primary, created_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "担当者の作成に失敗しました");
  return mapContact(data);
}

// ---------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------
function mapOrganization(row: Record<string, unknown>): OrganizationRow {
  return {
    id:              String(row["id"]),
    legalName:       String(row["legal_name"]),
    corporateNumber: row["corporate_number"] != null ? String(row["corporate_number"]) : null,
    postalCode:      row["postal_code"] != null ? String(row["postal_code"]) : null,
    address:         row["address"] != null ? String(row["address"]) : null,
    industry:        row["industry"] != null ? String(row["industry"]) : null,
    employeeSize:    row["employee_size"] != null ? String(row["employee_size"]) : null,
    notes:           row["notes"] != null ? String(row["notes"]) : null,
    createdAt:       String(row["created_at"]),
    updatedAt:       String(row["updated_at"]),
  };
}

function mapContact(row: Record<string, unknown>): OrganizationContactRow {
  return {
    id:             String(row["id"]),
    organizationId: String(row["organization_id"]),
    name:           String(row["name"]),
    department:     row["department"] != null ? String(row["department"]) : null,
    title:          row["title"] != null ? String(row["title"]) : null,
    email:          row["email"] != null ? String(row["email"]) : null,
    phone:          row["phone"] != null ? String(row["phone"]) : null,
    isPrimary:      Boolean(row["is_primary"]),
    createdAt:      String(row["created_at"]),
  };
}
