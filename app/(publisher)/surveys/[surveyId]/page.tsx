import { SurveyMaintenanceClient } from "@/components/survey/SurveyMaintenanceClient";

type SurveyPageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function SurveyPage({ params }: SurveyPageProps) {
  const { surveyId } = await params;

  return <SurveyMaintenanceClient surveyId={surveyId} />;
}
