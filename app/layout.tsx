import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";

import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Researvo",
    template: "%s | Researvo",
  },
  description: "Schema-first research data collection workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.className}>
      <body>
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
