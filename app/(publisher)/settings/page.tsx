import type { Metadata } from "next";

import { SettingsPanels } from "@/components/settings/SettingsPanels";

export const metadata: Metadata = {
  title: {
    absolute: "Settings | Researvo",
  },
};

export default function SettingsPage() {
  return <SettingsPanels />;
}
