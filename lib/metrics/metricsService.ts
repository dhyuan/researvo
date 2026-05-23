export type SurveySessionForMetrics = {
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
};

export type SurveyMetrics = {
  startedCount: number;
  completedCount: number;
  completionRate: number;
  averageCompletionSeconds: number | null;
};

export const calculateSurveyMetrics = (sessions: SurveySessionForMetrics[]): SurveyMetrics => {
  const startedCount = sessions.length;
  const completedDurations = sessions.flatMap((session) => {
    if (session.status !== "completed" || !session.submittedAt) {
      return [];
    }

    return [(session.submittedAt.getTime() - session.startedAt.getTime()) / 1000];
  });

  const completedCount = completedDurations.length;
  const completionRate = startedCount === 0 ? 0 : completedCount / startedCount;
  const averageCompletionSeconds =
    completedCount === 0 ? null : completedDurations.reduce((total, duration) => total + duration, 0) / completedCount;

  return {
    startedCount,
    completedCount,
    completionRate,
    averageCompletionSeconds,
  };
};
