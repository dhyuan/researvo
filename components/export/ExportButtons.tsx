"use client";

type ExportButtonsProps = {
  surveyId: string;
};

export function ExportButtons({ surveyId }: ExportButtonsProps) {
  const exportUrl = (format: string) => `/api/surveys/${surveyId}/exports?format=${format}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900" href={exportUrl("csv")}>
        Export CSV
      </a>
      <a className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900" href={exportUrl("json")}>
        Export JSON
      </a>
      <a className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900" href={exportUrl("schema")}>
        Export schema
      </a>
      <a className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900" href={exportUrl("zip")}>
        Download package
      </a>
    </div>
  );
}
