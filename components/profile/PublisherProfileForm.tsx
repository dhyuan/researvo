import type { PublisherProfile } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PublisherProfileFormProps = {
  action: (formData: FormData) => Promise<void>;
  profile: PublisherProfile;
};

const fields = [
  { name: "displayName", label: "Display name", placeholder: "Dr. Ada Lee" },
  { name: "organization", label: "Organization", placeholder: "Signal Labs" },
  { name: "industry", label: "Industry", placeholder: "Healthcare" },
  { name: "researchField", label: "Research field", placeholder: "Patient experience" },
  { name: "intendedUse", label: "Intended use", placeholder: "Longitudinal research" },
  { name: "region", label: "Region", placeholder: "North America" },
] as const;

export function PublisherProfileForm({ action, profile }: PublisherProfileFormProps) {
  return (
    <Panel className="max-w-3xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Publisher profile</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--hs-muted)]">
            Keep your research identity and workspace context up to date.
          </p>
        </div>
        <StatusBadge tone={profile.onboardingCompleted ? "success" : "warning"}>
          {profile.onboardingCompleted ? "Onboarding complete" : "Onboarding pending"}
        </StatusBadge>
      </div>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label className="grid gap-2 text-sm font-medium text-slate-800" key={field.name}>
            {field.label}
            <input
              className="rounded border border-[var(--hs-border)] bg-white px-3 py-2 text-sm font-normal text-slate-950 shadow-sm"
              defaultValue={profile[field.name] ?? ""}
              name={field.name}
              placeholder={field.placeholder}
            />
          </label>
        ))}
        <div className="sm:col-span-2">
          <Button type="submit">Save profile</Button>
        </div>
      </form>
    </Panel>
  );
}
