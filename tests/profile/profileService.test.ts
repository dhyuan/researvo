import { afterEach, describe, expect, it, vi } from "vitest";

const mockPublisherProfileUpsert = vi.fn();

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    publisherProfile: {
      upsert: mockPublisherProfileUpsert,
    },
  },
}));

describe("profileService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates an empty publisher profile when fetching a missing profile", async () => {
    const profile = {
      id: "profile_1",
      userId: "user_1",
      displayName: null,
      industry: null,
      researchField: null,
      organization: null,
      intendedUse: null,
      region: null,
      onboardingCompleted: false,
    };
    mockPublisherProfileUpsert.mockResolvedValue(profile);

    const { getPublisherProfile } = await import("@/lib/profile/profileService");

    await expect(getPublisherProfile("user_1")).resolves.toEqual(profile);
    expect(mockPublisherProfileUpsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      create: { userId: "user_1" },
      update: {},
    });
  });

  it("marks onboarding complete when updating a publisher profile", async () => {
    const input = {
      displayName: "Dr. Ada Lee",
      industry: "Healthcare",
      researchField: "Patient experience",
      organization: "Signal Labs",
      intendedUse: "Longitudinal research",
      region: "North America",
    };
    const profile = {
      id: "profile_1",
      userId: "user_1",
      ...input,
      onboardingCompleted: true,
    };
    mockPublisherProfileUpsert.mockResolvedValue(profile);

    const { updatePublisherProfile } = await import("@/lib/profile/profileService");

    await expect(updatePublisherProfile("user_1", input)).resolves.toEqual(profile);
    expect(mockPublisherProfileUpsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      create: {
        userId: "user_1",
        ...input,
        onboardingCompleted: true,
      },
      update: {
        ...input,
        onboardingCompleted: true,
      },
    });
  });
});
