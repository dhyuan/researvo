import type { Option, QuestionNode } from "@/lib/schema/surveySchema";

export const getChoiceOptions = (node: QuestionNode): Option[] => {
  if (node.options?.length) {
    return node.options;
  }

  if (node.type !== "likert") {
    return [];
  }

  return (
    node.scale?.anchors?.map((anchor) => ({
      id: `${node.id}_${anchor.value}`,
      label: anchor.label,
      value: anchor.value,
    })) ?? []
  );
};
