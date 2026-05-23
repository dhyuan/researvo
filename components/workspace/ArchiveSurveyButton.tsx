"use client";

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmSurveyActionButton } from "@/components/workspace/ConfirmSurveyActionButton";

export function ArchiveSurveyButton({ surveyId, surveyTitle }: { surveyId: string; surveyTitle: string }) {
  const router = useRouter();
  const [isArchiving, setIsArchiving] = useState(false);

  const archive = async () => {
    setIsArchiving(true);

    try {
      const response = await fetch(`/api/surveys/${surveyId}/archive`, { method: "POST" });

      if (response.ok) {
        router.refresh();
        return true;
      }

      toast.error("Archive failed. Please refresh and try again.");
      return false;
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <ConfirmSurveyActionButton
      actionLabel={`Archive ${surveyTitle}`}
      confirmLabel="Archive survey"
      description={`Archive "${surveyTitle}" and hide it from the default workspace list. You can still find it from the Archived tab.`}
      icon={<Archive aria-hidden="true" className="size-3.5" strokeWidth={1.8} />}
      isPending={isArchiving}
      onConfirm={archive}
      pendingLabel="Archiving..."
      title="Archive survey?"
      variant="secondary"
    >
      Archive
    </ConfirmSurveyActionButton>
  );
}
