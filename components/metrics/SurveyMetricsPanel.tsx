"use client";

type SurveyMetrics = {
  startedCount: number;
  completedCount: number;
  completionRate: number;
  averageCompletionSeconds: number | null;
};

type SurveyMetricsPanelProps = {
  metrics: SurveyMetrics | null;
  onRefresh: () => void;
};

export function SurveyMetricsPanel({ metrics, onRefresh }: SurveyMetricsPanelProps) {
  return (
    <div className="space-y-3">
      <button className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900" onClick={onRefresh}>
        Refresh metrics
      </button>
      {metrics ? (
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-slate-500">Started</dt>
            <dd className="text-lg font-semibold">{metrics.startedCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Completed</dt>
            <dd className="text-lg font-semibold">{metrics.completedCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Completion</dt>
            <dd className="text-lg font-semibold">{Math.round(metrics.completionRate * 100)}%</dd>
          </div>
          <div>
            <dt className="text-slate-500">Avg seconds</dt>
            <dd className="text-lg font-semibold">{metrics.averageCompletionSeconds ?? "-"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-slate-500">Metrics not loaded.</p>
      )}
    </div>
  );
}
