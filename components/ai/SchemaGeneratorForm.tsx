"use client";

import { useState } from "react";

type SchemaGeneratorFormProps = {
  onGenerated: (schema: unknown, validationReport: unknown) => void;
};

export function SchemaGeneratorForm({ onGenerated }: SchemaGeneratorFormProps) {
  const [researchGoal, setResearchGoal] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [model, setModel] = useState("llama3.1");
  const [apiKey, setApiKey] = useState("local");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/ai/generate-schema", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ researchGoal, baseUrl, model, apiKey }),
    });
    const payload = (await response.json()) as { schema?: unknown; validationReport?: unknown; error?: unknown };

    setIsLoading(false);

    if (!response.ok || !payload.schema) {
      setError(typeof payload.error === "string" ? payload.error : "AI generation failed");
      return;
    }

    onGenerated(payload.schema, payload.validationReport);
  };

  return (
    <div className="space-y-3">
      <textarea
        className="h-24 w-full rounded border border-slate-300 p-3 text-sm"
        placeholder="Research goal"
        value={researchGoal}
        onChange={(event) => setResearchGoal(event.target.value)}
      />
      <div className="grid gap-2 md:grid-cols-3">
        <input className="rounded border border-slate-300 p-2 text-sm" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        <input className="rounded border border-slate-300 p-2 text-sm" value={model} onChange={(event) => setModel(event.target.value)} />
        <input className="rounded border border-slate-300 p-2 text-sm" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={generate} disabled={isLoading}>
        {isLoading ? "Generating..." : "Generate schema"}
      </button>
    </div>
  );
}
