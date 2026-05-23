import { afterEach, describe, expect, it, vi } from "vitest";

import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";

const mockFindFirst = vi.fn();
const mockCreateDraft = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();
const mockSurveyCreate = vi.fn();
const mockSurveyUpdate = vi.fn();
const mockSurveyDraftCreate = vi.fn();
const mockSurveyDraftFindFirst = vi.fn();
const mockSurveyDraftUpdate = vi.fn();
const mockSurveyVersionFindFirst = vi.fn();
const mockTransaction = vi.fn(async (callback) =>
  callback({
    surveyCreationDraft: {
      findFirst: mockFindFirst,
      create: mockCreateDraft,
      updateMany: mockUpdateMany,
      update: mockUpdate,
    },
    survey: {
      create: mockSurveyCreate,
      update: mockSurveyUpdate,
    },
    surveyDraft: {
      create: mockSurveyDraftCreate,
      findFirst: mockSurveyDraftFindFirst,
      update: mockSurveyDraftUpdate,
    },
    surveyVersion: {
      findFirst: mockSurveyVersionFindFirst,
    },
  }),
);

vi.mock("@/lib/persistence/repositories", () => ({
  prisma: {
    $transaction: mockTransaction,
    surveyCreationDraft: {
      findFirst: mockFindFirst,
      create: mockCreateDraft,
      updateMany: mockUpdateMany,
      update: mockUpdate,
    },
    survey: {
      create: mockSurveyCreate,
      update: mockSurveyUpdate,
    },
    surveyDraft: {
      create: mockSurveyDraftCreate,
      findFirst: mockSurveyDraftFindFirst,
      update: mockSurveyDraftUpdate,
    },
    surveyVersion: {
      findFirst: mockSurveyVersionFindFirst,
    },
  },
}));

describe("creationDraftService", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does not update converted or non-owned drafts", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const { updateCreationDraft } = await import("@/lib/wizard/creationDraftService");

    await expect(updateCreationDraft("owner_1", "draft_1", { title: "Late autosave" })).resolves.toBeNull();
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "draft_1", ownerId: "owner_1", status: "draft" },
      data: { title: "Late autosave" },
    });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("rejects non-JSON schema values before updating", async () => {
    const { updateCreationDraft } = await import("@/lib/wizard/creationDraftService");

    await expect(updateCreationDraft("owner_1", "draft_1", { schema: new Date() })).rejects.toThrow(
      "schema must be JSON-safe",
    );
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("starts a new creation draft when the active draft already has a published survey", async () => {
    mockFindFirst.mockResolvedValue({
      id: "draft_published",
      ownerId: "owner_1",
      status: "draft",
      schema: exampleSurveySchema,
      title: "Old title",
      description: "Old description",
      createdSurveyId: "survey_1",
    });
    mockSurveyVersionFindFirst.mockResolvedValue({ id: "version_1", surveyId: "survey_1" });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockCreateDraft.mockResolvedValue({
      id: "draft_new",
      ownerId: "owner_1",
      status: "draft",
      schema: null,
      title: null,
      description: null,
      createdSurveyId: null,
    });

    const { getOrCreateActiveCreationDraft } = await import("@/lib/wizard/creationDraftService");

    await expect(getOrCreateActiveCreationDraft("owner_1")).resolves.toMatchObject({
      id: "draft_new",
      createdSurveyId: null,
    });
    expect(mockSurveyVersionFindFirst).toHaveBeenCalledWith({
      where: { surveyId: "survey_1" },
      orderBy: { version: "desc" },
    });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { ownerId: "owner_1", createdSurveyId: "survey_1", status: "draft" },
      data: { status: "converted" },
    });
    expect(mockCreateDraft).toHaveBeenCalledWith({
      data: { ownerId: "owner_1" },
    });
  });

  it("creates a draft survey as soon as a valid imported schema is saved", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindFirst.mockResolvedValue({
      id: "draft_1",
      ownerId: "owner_1",
      status: "draft",
      schema: exampleSurveySchema,
      title: "Imported title",
      description: "Imported description",
      createdSurveyId: null,
    });
    mockSurveyCreate.mockResolvedValue({ id: "survey_1" });
    mockSurveyDraftCreate.mockResolvedValue({ id: "survey_draft_1" });
    mockUpdate.mockResolvedValue({
      id: "draft_1",
      ownerId: "owner_1",
      status: "draft",
      schema: exampleSurveySchema,
      title: "Imported title",
      description: "Imported description",
      createdSurveyId: "survey_1",
    });

    const { updateCreationDraft } = await import("@/lib/wizard/creationDraftService");

    await expect(updateCreationDraft("owner_1", "draft_1", { schema: exampleSurveySchema })).resolves.toMatchObject({
      createdSurveyId: "survey_1",
      status: "draft",
    });
    expect(mockSurveyCreate).toHaveBeenCalledWith({
      data: {
        ownerId: "owner_1",
        title: "Imported title",
      },
    });
    expect(mockSurveyDraftCreate).toHaveBeenCalledWith({
      data: {
        surveyId: "survey_1",
        schema: expect.objectContaining({
          survey: expect.objectContaining({
            title: "Imported title",
            description: "Imported description",
          }),
        }),
      },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: { createdSurveyId: "survey_1" },
    });
  });

  it("updates the existing draft survey when a valid imported schema changes", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindFirst.mockResolvedValue({
      id: "draft_1",
      ownerId: "owner_1",
      status: "draft",
      schema: exampleSurveySchema,
      title: null,
      description: null,
      createdSurveyId: "survey_1",
    });
    mockSurveyDraftFindFirst.mockResolvedValue({ id: "survey_draft_1" });

    const { updateCreationDraft } = await import("@/lib/wizard/creationDraftService");

    await expect(updateCreationDraft("owner_1", "draft_1", { schema: exampleSurveySchema })).resolves.toMatchObject({
      createdSurveyId: "survey_1",
    });
    expect(mockSurveyCreate).not.toHaveBeenCalled();
    expect(mockSurveyUpdate).toHaveBeenCalledWith({
      where: { id: "survey_1" },
      data: { title: exampleSurveySchema.survey.title },
    });
    expect(mockSurveyDraftUpdate).toHaveBeenCalledWith({
      where: { id: "survey_draft_1" },
      data: {
        schema: expect.objectContaining({
          survey: expect.objectContaining({ title: exampleSurveySchema.survey.title }),
        }),
      },
    });
  });

  it("returns INVALID_SCHEMA when finalizing a draft with invalid schema", async () => {
    mockFindFirst.mockResolvedValue({
      id: "draft_1",
      ownerId: "owner_1",
      status: "draft",
      schema: { schemaVersion: "0.0.2" },
      title: null,
      description: null,
      createdSurveyId: null,
    });

    const { finalizeCreationDraft } = await import("@/lib/wizard/creationDraftService");

    await expect(finalizeCreationDraft("owner_1", "draft_1")).resolves.toMatchObject({
      ok: false,
      error: "INVALID_SCHEMA",
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockSurveyCreate).not.toHaveBeenCalled();
  });

  it("returns an existing createdSurveyId idempotently", async () => {
    mockFindFirst.mockResolvedValue({
      id: "draft_1",
      ownerId: "owner_1",
      status: "converted",
      schema: exampleSurveySchema,
      title: null,
      description: null,
      createdSurveyId: "survey_1",
    });

    const { finalizeCreationDraft } = await import("@/lib/wizard/creationDraftService");

    await expect(finalizeCreationDraft("owner_1", "draft_1")).resolves.toEqual({
      ok: true,
      surveyId: "survey_1",
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockSurveyCreate).not.toHaveBeenCalled();
  });

  it("claims a draft before creating survey records during finalize", async () => {
    mockFindFirst.mockResolvedValue({
      id: "draft_1",
      ownerId: "owner_1",
      status: "draft",
      schema: exampleSurveySchema,
      title: "Override title",
      description: "Override description",
      createdSurveyId: null,
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockSurveyCreate.mockResolvedValue({ id: "survey_1" });
    mockSurveyDraftCreate.mockResolvedValue({ id: "survey_draft_1" });
    mockUpdate.mockResolvedValue({ id: "draft_1", createdSurveyId: "survey_1", status: "converted" });

    const { finalizeCreationDraft } = await import("@/lib/wizard/creationDraftService");

    await expect(finalizeCreationDraft("owner_1", "draft_1")).resolves.toEqual({
      ok: true,
      surveyId: "survey_1",
    });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "draft_1", ownerId: "owner_1", status: "draft", createdSurveyId: null },
      data: { status: "finalizing" },
    });
    expect(mockSurveyCreate).toHaveBeenCalledWith({
      data: {
        ownerId: "owner_1",
        title: "Override title",
      },
    });
    expect(mockSurveyDraftCreate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: {
        createdSurveyId: "survey_1",
        status: "converted",
      },
    });
  });

  it("completes the active creation draft for a survey after publish", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const { completeCreationDraftForSurvey } = await import("@/lib/wizard/creationDraftService");

    await expect(completeCreationDraftForSurvey("owner_1", "survey_1")).resolves.toEqual({ count: 1 });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { ownerId: "owner_1", createdSurveyId: "survey_1", status: "draft" },
      data: { status: "converted" },
    });
  });
});
