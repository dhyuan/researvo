import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Researvo",
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
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-CMKPF2B2RL" />
        <Script
          id="google-analytics"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-CMKPF2B2RL');
            `,
          }}
        />
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
