import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient, mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { deleteOrganization } from "@/server/repositories/organizations";

function makeCountBuilder(result: { count: number | null; error: { message: string } | null }) {
  const is = vi.fn(async () => result);
  const eq = vi.fn(() => ({ is }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, is };
}

function makeUpdateBuilder(result: { error: { message: string } | null }) {
  const payloads: Record<string, unknown>[] = [];
  const is = vi.fn(async () => result);
  const eq = vi.fn(() => ({ is }));
  const update = vi.fn((payload: Record<string, unknown>) => {
    payloads.push(payload);
    return { eq };
  });

  return { update, eq, is, payloads };
}

describe("deleteOrganization", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockCreateAdminClient.mockReset();
  });

  it("案件が紐付いている企業は削除しない", async () => {
    const casesBuilder = makeCountBuilder({
      count: 1,
      error: null,
    });

    const contactsBuilder = makeUpdateBuilder({ error: null });
    const organizationsBuilder = makeUpdateBuilder({ error: null });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cases") return casesBuilder;
        if (table === "organization_contacts") return contactsBuilder;
        if (table === "organizations") return organizationsBuilder;
        throw new Error(`unexpected table: ${table}`);
      }),
    });

    await expect(deleteOrganization("org-1")).rejects.toThrow(
      "案件が紐付いている企業は削除できません。先に案件を削除または移管してください。"
    );

    expect(contactsBuilder.update).not.toHaveBeenCalled();
    expect(organizationsBuilder.update).not.toHaveBeenCalled();
  });

  it("案件未紐付けなら連絡先と企業を同じ deleted_at で論理削除する", async () => {
    const casesBuilder = makeCountBuilder({
      count: 0,
      error: null,
    });

    const contactsBuilder = makeUpdateBuilder({ error: null });
    const organizationsBuilder = makeUpdateBuilder({ error: null });

    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "cases") return casesBuilder;
        if (table === "organization_contacts") return contactsBuilder;
        if (table === "organizations") return organizationsBuilder;
        throw new Error(`unexpected table: ${table}`);
      }),
    });

    await expect(deleteOrganization("org-1")).resolves.toBeUndefined();

    expect(contactsBuilder.update).toHaveBeenCalledTimes(1);
    expect(organizationsBuilder.update).toHaveBeenCalledTimes(1);

    const contactDeletedAt = contactsBuilder.payloads[0]?.["deleted_at"];
    const organizationDeletedAt = organizationsBuilder.payloads[0]?.["deleted_at"];

    expect(typeof contactDeletedAt).toBe("string");
    expect(contactDeletedAt).toBe(organizationDeletedAt);
    expect(contactsBuilder.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(organizationsBuilder.eq).toHaveBeenCalledWith("id", "org-1");
  });
});
