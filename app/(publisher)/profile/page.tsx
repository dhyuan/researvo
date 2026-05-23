import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PublisherProfileForm } from "@/components/profile/PublisherProfileForm";
import { requirePublisher } from "@/lib/auth/currentUser";
import { getPublisherProfile, updatePublisherProfile, type PublisherProfileInput } from "@/lib/profile/profileService";

export const metadata: Metadata = {
  title: {
    absolute: "Profile | Researvo",
  },
};

function readOptionalString(formData: FormData, key: keyof PublisherProfileInput) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function ProfilePage() {
  const user = await requirePublisher();
  const profile = await getPublisherProfile(user.id);

  async function saveProfile(formData: FormData) {
    "use server";

    const currentUser = await requirePublisher();
    const input: PublisherProfileInput = {
      displayName: readOptionalString(formData, "displayName"),
      industry: readOptionalString(formData, "industry"),
      researchField: readOptionalString(formData, "researchField"),
      organization: readOptionalString(formData, "organization"),
      intendedUse: readOptionalString(formData, "intendedUse"),
      region: readOptionalString(formData, "region"),
    };

    await updatePublisherProfile(currentUser.id, input);
    redirect("/profile");
  }

  return <PublisherProfileForm action={saveProfile} profile={profile} />;
}
