import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  applicationName: "Researvo Feedback Admin",
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Researvo Admin",
  },
  icons: {
    apple: [{ url: "/admin/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#202d28",
};

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
