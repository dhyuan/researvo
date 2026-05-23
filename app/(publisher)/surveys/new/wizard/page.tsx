import { CreationWizard } from "@/components/wizard/CreationWizard";
import { requirePublisher } from "@/lib/auth/currentUser";
import { getLatestSurveyVersion } from "@/lib/persistence/repositories";
import { getOrCreateActiveCreationDraft } from "@/lib/wizard/creationDraftService";

export default async function NewSurveyWizardPage() {
  const user = await requirePublisher();
  const draft = await getOrCreateActiveCreationDraft(user.id);
  const latestVersion = draft.createdSurveyId ? await getLatestSurveyVersion(draft.createdSurveyId) : null;

  return (
    <CreationWizard
      initialDraft={{
        constraints: draft.constraints,
        createdSurveyId: draft.createdSurveyId,
        description: draft.description,
        id: draft.id,
        questionDescription: draft.questionDescription,
        publicUrl: latestVersion ? `/public/s/${latestVersion.publicId}` : null,
        researchGoal: draft.researchGoal,
        schema: draft.schema,
        title: draft.title,
      }}
    />
  );
}
