import { listSurveysForOwner } from "@/lib/persistence/repositories";

function latestDate(...dates: Array<Date | null | undefined>) {
  return dates.reduce<Date>((latest, date) => {
    if (!date) {
      return latest;
    }

    return date.getTime() > latest.getTime() ? date : latest;
  }, new Date(0));
}

export async function getWorkspaceSurveys(ownerId: string, filter: "all" | "published" | "archived" = "all") {
  const surveys = await listSurveysForOwner(ownerId);

  return surveys
    .map((survey) => {
      const latestDraft = survey.drafts[0] ?? null;
      const latestVersion = survey.versions[0] ?? null;
      const updatedAt = latestDate(survey.updatedAt, latestDraft?.updatedAt, latestVersion?.createdAt);
      const isArchived = Boolean(survey.archivedAt);

      return {
        id: survey.id,
        title: survey.title,
        updatedAt,
        status: isArchived ? "archived" : latestVersion ? "published" : "draft",
        publicUrl: latestVersion ? `/public/s/${latestVersion.publicId}` : null,
        version: latestVersion?.version ?? null,
        participantCount: latestVersion?._count.sessions ?? 0,
        archivedAt: survey.archivedAt,
      };
    })
    .filter((survey) => {
      if (filter === "archived") {
        return Boolean(survey.archivedAt);
      }

      if (filter === "published") {
        return !survey.archivedAt && survey.status === "published";
      }

      return !survey.archivedAt;
    })
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}
