import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/providers/ThemeProvider";
import { SmoothScrollProvider } from "@/providers/SmoothScrollProvider";
import { UploadProgressProvider } from "@/providers/UploadProgressProvider";
import { SiteNav } from "@/components/SiteNav";
import { GooeyToastProvider } from "@/components/GooeyToastProvider";
import { DevPointerCaptureGuard } from "@/components/DevPointerCaptureGuard";
import "./globals.css";
import "goey-toast/styles.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getCurrentUser } from "@/lib/server-auth";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const sfPro = localFont({
  src: [
    {
      path: "../../public/fonts/SFPRODISPLAYREGULAR.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYMEDIUM.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/SFPRODISPLAYBOLD.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sf-pro",
});

export const metadata: Metadata = {
  title: "Sutie Xù Xì ",
  description: "Nơi lưu giữ những bản dịch thuật của Sutie Xù Xì.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getCurrentUser();

  return (
    <html lang="vi" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body
        className={`${sfPro.variable} font-sans antialiased bg-background text-foreground relative`}
        suppressHydrationWarning
      >
        <div className="fixed top-14 inset-x-0 bottom-0 pointer-events-none z-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,theme(colors.primary)_1px,transparent_0)] bg-[size:28px_28px] opacity-[0.08] dark:opacity-[0.06] mix-blend-screen" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,theme(colors.foreground)_1px,transparent_1px),linear-gradient(theme(colors.foreground)_1px,transparent_1px)] bg-[size:180px_180px] opacity-[0.035] dark:opacity-[0.05] mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/0 to-background/35 dark:to-background/55" />
        </div>
        <div className="relative z-10 flex flex-col min-h-screen">
          <DevPointerCaptureGuard />
          <Providers initialUser={initialUser}>
            <UploadProgressProvider>
              <SmoothScrollProvider>
              <SiteNav />
              {children}
              <GooeyToastProvider />
            </SmoothScrollProvider>
          </UploadProgressProvider>
          </Providers>
        </div>
        <SpeedInsights />
      </body>
    </html>
  );
}
