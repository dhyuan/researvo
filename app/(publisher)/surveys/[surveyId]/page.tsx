import type { Metadata } from "next";

import { SurveyMaintenanceClient } from "@/components/survey/SurveyMaintenanceClient";

export const metadata: Metadata = {
  title: {
    absolute: "Survey Editor | Researvo",
  },
};

type SurveyPageProps = {
  params: Promise<{ surveyId: string }>;
};

export default async function SurveyPage({ params }: SurveyPageProps) {
  const { surveyId } = await params;

  return <SurveyMaintenanceClient surveyId={surveyId} />;
}
