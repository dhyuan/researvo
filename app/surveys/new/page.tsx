"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { exampleSurveySchema } from "@/lib/schema/exampleSurvey";

export default function NewSurveyPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSurvey = async () => {
    setIsCreating(true);
    setError(null);

    const response = await fetch("/api/surveys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: exampleSurveySchema.survey.title,
        schema: exampleSurveySchema,
      }),
    });
    const payload = (await response.json()) as { survey?: { id: string }; error?: string };

    setIsCreating(false);

    if (!response.ok || !payload.survey) {
      setError(payload.error ?? "Unable to create survey");
      return;
    }

    router.push(`/surveys/${payload.survey.id}`);
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-slate-950">Create survey</h1>
      <p className="mt-3 text-slate-700">Start with the research-grade example schema and edit from there.</p>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <button className="mt-6 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={createSurvey} disabled={isCreating}>
        {isCreating ? "Creating..." : "Create example survey"}
      </button>
    </main>
  );
}
