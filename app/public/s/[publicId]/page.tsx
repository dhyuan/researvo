import type { Metadata } from "next";

import { PublicSurveyClient } from "@/components/respondent/PublicSurveyClient";
import { getSurveyVersionByPublicId } from "@/lib/persistence/repositories";

type PublicSurveyPageProps = {
  params: Promise<{ publicId: string }>;
};

export async function generateMetadata({ params }: PublicSurveyPageProps): Promise<Metadata> {
  const { publicId } = await params;
  const version = await getSurveyVersionByPublicId(publicId);

  return {
    title: {
      absolute: version?.survey.title ? `${version.survey.title} | Researvo` : "Survey | Researvo",
    },
  };
}

export default async function PublicSurveyPage({ params }: PublicSurveyPageProps) {
  const { publicId } = await params;

  return <PublicSurveyClient publicId={publicId} />;
}
