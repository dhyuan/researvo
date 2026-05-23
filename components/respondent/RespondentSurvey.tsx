"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { QuestionNode, SurveySchema } from "@/lib/schema/surveySchema";
import { getChoiceOptions } from "@/lib/runtime/questionInput";
import { getNextNode } from "@/lib/runtime/runtimeEngine";

type RespondentSurveyProps = {
  schema: SurveySchema;
} & (
  | {
      previewMode?: false;
      publicId: string;
      sessionId: string;
    }
  | {
      previewMode: true;
      publicId?: never;
      sessionId?: never;
    }
);

const answerKey = (node: QuestionNode) => node.variableName ?? node.id;

export function RespondentSurvey(props: RespondentSurveyProps) {
  const { schema } = props;
  const entryNode = useMemo(
    () => schema.nodes.find((node) => node.id === schema.survey.entryNodeId) ?? schema.nodes[0],
    [schema],
  );
  const [currentNode, setCurrentNode] = useState<QuestionNode | null>(entryNode ?? null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [shownNodeIds, setShownNodeIds] = useState<string[]>(entryNode ? [entryNode.id] : []);
  const [branchPath, setBranchPath] = useState<string[]>(entryNode ? [entryNode.id] : []);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const setAnswer = (node: QuestionNode, value: unknown) => {
    setAnswers((current) => ({ ...current, [answerKey(node)]: value }));
  };

  const currentAnswer = currentNode ? answers[answerKey(currentNode)] : undefined;

  const validateCurrent = () => {
    if (!currentNode?.required) {
      return true;
    }

    if (currentAnswer === undefined || currentAnswer === null || currentAnswer === "") {
      setError("This question is required.");
      return false;
    }

    if (Array.isArray(currentAnswer) && currentAnswer.length === 0) {
      setError("This question is required.");
      return false;
    }

    return true;
  };

  const submit = async () => {
    if (props.previewMode) {
      setIsComplete(true);
      return;
    }

    const response = await fetch(`/api/public/s/${props.publicId}/submissions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: props.sessionId, answers, shownNodeIds, branchPath }),
    });

    if (!response.ok) {
      setError("Unable to submit response.");
      return;
    }

    setIsComplete(true);
  };

  const advance = async () => {
    setError(null);

    if (!currentNode) {
      return;
    }

    if (currentNode.type === "terminal") {
      await submit();
      return;
    }

    if (!validateCurrent()) {
      return;
    }

    const result = getNextNode({
      schema,
      currentNodeId: currentNode.id,
      answers,
    });

    if (!result.ok) {
      setError(result.code);
      return;
    }

    if (!result.nextNode) {
      await submit();
      return;
    }

    const nextNode = result.nextNode;

    setCurrentNode(nextNode);
    setShownNodeIds((current) => [...new Set([...current, nextNode.id])]);
    setBranchPath((current) => [...current, nextNode.id]);
  };

  const goBack = () => {
    setError(null);

    if (branchPath.length <= 1) {
      return;
    }

    const previousNodeId = branchPath[branchPath.length - 2];
    const previousNode = schema.nodes.find((node) => node.id === previousNodeId);

    if (!previousNode) {
      return;
    }

    setCurrentNode(previousNode);
    setBranchPath((current) => current.slice(0, -1));
  };

  if (isComplete) {
    return (
      <div className="rounded border border-slate-200 p-6">
        <h1 className="text-2xl font-semibold text-slate-950">{props.previewMode ? "Preview complete" : "Response submitted"}</h1>
        <p className="mt-2 text-slate-700">{props.previewMode ? "This run was local only and was not recorded." : "Thank you for participating."}</p>
      </div>
    );
  }

  if (!currentNode) {
    return <p className="text-sm text-red-600">Survey has no entry node.</p>;
  }

  const renderInput = () => {
    const choiceOptions = getChoiceOptions(currentNode);

    switch (currentNode.type) {
      case "consent":
        return <p className="text-sm leading-6 text-slate-700">{schema.consent?.body ?? currentNode.body}</p>;
      case "single_choice":
      case "likert":
        return (
          <div className="space-y-2">
            {choiceOptions.map((option) => (
              <label key={option.id} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name={currentNode.id}
                  checked={currentAnswer === option.value}
                  onChange={() => setAnswer(currentNode, option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        );
      case "multiple_choice":
        return (
          <div className="space-y-2">
            {choiceOptions.map((option) => {
              const selected = Array.isArray(currentAnswer) ? currentAnswer.includes(option.value) : false;

              return (
                <label key={option.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => {
                      const current = Array.isArray(currentAnswer) ? currentAnswer : [];
                      setAnswer(
                        currentNode,
                        event.target.checked
                          ? [...current, option.value]
                          : current.filter((value) => value !== option.value),
                      );
                    }}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        );
      case "number":
        return (
          <input
            className="w-full rounded border border-slate-300 p-2"
            type="number"
            value={typeof currentAnswer === "number" ? currentAnswer : ""}
            onChange={(event) => setAnswer(currentNode, event.target.value === "" ? "" : Number(event.target.value))}
          />
        );
      case "short_text":
      case "long_text":
        return (
          <textarea
            className="h-28 w-full rounded border border-slate-300 p-2"
            value={typeof currentAnswer === "string" ? currentAnswer : ""}
            onChange={(event) => setAnswer(currentNode, event.target.value)}
          />
        );
      case "terminal":
        return <p className="text-sm text-slate-700">You have reached the end of the survey.</p>;
    }
  };

  return (
    <div className="rounded border border-slate-200 p-6">
      <p className="text-xs uppercase text-slate-500">{currentNode.type}</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">{currentNode.title}</h1>
      <div className="mt-5">{renderInput()}</div>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 flex justify-end gap-3">
        <Button disabled={branchPath.length <= 1} onClick={goBack} variant="secondary">
          Back
        </Button>
        <Button onClick={advance}>{currentNode.type === "terminal" ? "Submit" : "Continue"}</Button>
      </div>
    </div>
  );
}
