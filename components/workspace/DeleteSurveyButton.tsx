"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmSurveyActionButton } from "@/components/workspace/ConfirmSurveyActionButton";

export function DeleteSurveyButton({ surveyId, surveyTitle }: { surveyId: string; surveyTitle: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteSurvey = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/surveys/${surveyId}`, { method: "DELETE" });

      if (response.ok) {
        router.refresh();
        return true;
      }

      toast.error("Delete failed. Please refresh and try again.");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmSurveyActionButton
      actionLabel={`Delete ${surveyTitle}`}
      confirmLabel="Delete permanently"
      description={`This permanently deletes "${surveyTitle}" and its drafts, published versions, sessions, and submissions. This cannot be undone.`}
      icon={<Trash2 aria-hidden="true" className="size-3.5" strokeWidth={1.8} />}
      isPending={isDeleting}
      onConfirm={deleteSurvey}
      pendingLabel="Deleting..."
      title="Delete survey?"
      variant="danger"
    >
      Delete
    </ConfirmSurveyActionButton>
  );
}
