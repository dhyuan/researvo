import { NextResponse } from "next/server";
import { generateSurveySchema } from "@/lib/ai/openaiCompatibleProvider";
import { validateSurveySchema } from "@/lib/validation/schemaValidator";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    researchGoal?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };

  if (!body.researchGoal || !body.baseUrl || !body.apiKey || !body.model) {
    return NextResponse.json({ error: "INVALID_AI_REQUEST" }, { status: 400 });
  }

  const result = await generateSurveySchema({
    researchGoal: body.researchGoal,
    baseUrl: body.baseUrl,
    apiKey: body.apiKey,
    model: body.model,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    schema: result.schema,
    validationReport: validateSurveySchema(result.schema),
  });
}
