import { describe, expect, it } from "vitest";
import type { QuestionNode } from "@/lib/schema/surveySchema";
import { getChoiceOptions } from "@/lib/runtime/questionInput";

describe("question input helpers", () => {
  it("uses scale anchors as choices for likert nodes without explicit options", () => {
    const node: QuestionNode = {
      id: "q_equal_effort",
      type: "likert",
      title: "Do respondents have choices?",
      variableName: "equal_effort",
      scale: {
        min: 1,
        max: 5,
        step: 1,
        anchors: [
          { value: 1, label: "完全一样" },
          { value: 3, label: "视情况而定" },
          { value: 5, label: "非常不一样" },
        ],
      },
    };

    expect(getChoiceOptions(node)).toEqual([
      { id: "q_equal_effort_1", label: "完全一样", value: 1 },
      { id: "q_equal_effort_3", label: "视情况而定", value: 3 },
      { id: "q_equal_effort_5", label: "非常不一样", value: 5 },
    ]);
  });
});
