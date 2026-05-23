import { afterEach, describe, expect, it, vi } from "vitest";

const mockUpsert = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    user: {
      upsert: mockUpsert,
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => null),
}));

describe("getCurrentUser", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses an explicitly trusted test user outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_TRUST_TEST_USER", "true");
    vi.stubEnv("AUTH_TEST_USER_EMAIL", "publisher@example.com");

    const publisher = {
      id: "user_test",
      email: "publisher@example.com",
      role: "publisher",
    };
    mockUpsert.mockResolvedValue(publisher);

    const { getCurrentUser } = await import("@/lib/auth/currentUser");

    await expect(getCurrentUser()).resolves.toEqual(publisher);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { email: "publisher@example.com" },
      create: { email: "publisher@example.com", role: "publisher" },
      update: {},
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("ignores the trusted test user bypass in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_TRUST_TEST_USER", "true");
    vi.stubEnv("AUTH_TEST_USER_EMAIL", "publisher@example.com");

    const { getCurrentUser } = await import("@/lib/auth/currentUser");

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
