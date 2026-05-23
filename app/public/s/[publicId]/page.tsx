"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RespondentSurvey } from "@/components/respondent/RespondentSurvey";
import type { SurveySchema } from "@/lib/schema/surveySchema";

type SessionPayload = {
  session?: { id: string };
  schema?: SurveySchema;
  error?: string;
};

export default function PublicSurveyPage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;
  const [payload, setPayload] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const startSession = async () => {
      const response = await fetch(`/api/public/s/${publicId}/sessions`, { method: "POST" });
      const data = (await response.json()) as SessionPayload;

      setPayload(response.ok ? data : { error: data.error ?? "Unable to start survey" });
      setIsLoading(false);
    };

    void startSession();
  }, [publicId]);

  if (isLoading) {
    return <main className="mx-auto max-w-2xl px-6 py-12 text-slate-700">Loading survey...</main>;
  }

  if (!payload?.session || !payload.schema) {
    return <main className="mx-auto max-w-2xl px-6 py-12 text-red-600">{payload?.error ?? "Survey unavailable"}</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <RespondentSurvey publicId={publicId} sessionId={payload.session.id} schema={payload.schema} />
    </main>
  );
}
