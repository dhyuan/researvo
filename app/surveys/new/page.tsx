import type { Metadata } from "next";

import { NewSurveyStarter } from "@/components/survey/NewSurveyStarter";

export const metadata: Metadata = {
  title: {
    absolute: "Create Survey | Researvo",
  },
};

export default function NewSurveyPage() {
  return <NewSurveyStarter />;
}
